/**
 * Observation derivation.
 *
 * Observations are **derived on demand**, not materialised up front. A value is
 * a pure function of `(iso3, year, variableCode)` via the seeded hash, so:
 *
 *  · nothing is stored — 194 countries × 25 years × ~200 reported codes is
 *    ~970,000 potential observations, and we never hold more than the slice a
 *    workbook or report actually asked for;
 *  · the same slice is byte-identical on every machine and every reload;
 *  · the mock client can answer any query instantly, which is what makes the
 *    UC057 "up to 25 million rows" conversation honest rather than hand-waved.
 *
 * Realism comes from structure rather than noise: each country gets a spending
 * level and a growth trajectory, each variable a stable share of its parent, and
 * the year-on-year wobble is small and smooth. Aggregates are NOT generated —
 * they are computed by the formula engine from these leaves, which is what makes
 * the engine visible in the demo.
 */

import {
  DEMO_NOW,
  LAST_YEAR,
  type DimensionCode,
  type WbIncome,
} from '@/domain/constants'
import { observationKey, surveyFk } from '@/domain/keys'
import type { Dimensions, Observation, ObservationMetadata, SysFields } from '@/domain/types'
import { CLASSIFICATION_VARIABLES, VARIABLE_BY_CODE } from '../seed/classifications'
import { COUNTRY_BY_ISO3 } from '../seed/countries'
import { CURRENCY_BY_CODE } from '../seed/currencies'
import { chance, gaussian, int, pick, range, unit } from './seedRandom'
import { defectFor } from './defects'

/* --------------------------------------------------------------------------
   Country-level economics
   -------------------------------------------------------------------------- */

/** Income group → rough GDP per capita in US$, to anchor magnitudes. */
const GDP_PER_CAPITA: Record<string, [number, number]> = {
  LIC: [400, 1_200],
  LMC: [1_200, 4_500],
  UMC: [4_500, 13_000],
  HIC: [13_000, 90_000],
}

/** Income group → current health expenditure as a share of GDP. */
const CHE_SHARE: Record<string, [number, number]> = {
  LIC: [0.03, 0.07],
  LMC: [0.035, 0.075],
  UMC: [0.04, 0.09],
  HIC: [0.06, 0.135],
}

/**
 * Country economics.
 *
 * **Every series is anchored at `LAST_YEAR`, not `FIRST_YEAR`.** The seed data
 * we have — population, exchange rate, GDP per capita band — describes the
 * present, so anchoring at 2000 and compounding 24 years of growth forward
 * inflated everything (India reached 2.7 billion people, Canada a $619k GDP per
 * capita). Series therefore grow *backwards* from the anchor:
 *
 *     value(year) = anchor × (1 + growth) ^ (year − LAST_YEAR)
 *
 * which is a division for every historical year and an identity at the anchor.
 */
interface CountryProfile {
  iso3: string
  /** GDP in NCU millions at LAST_YEAR. */
  gdpAnchor: number
  /** Annual nominal GDP growth. */
  gdpGrowth: number
  /** CHE as a share of GDP at LAST_YEAR. */
  cheShare: number
  /** Annual drift in the CHE share, so the ratio moves over time. */
  cheShareDrift: number
  /** General government expenditure as a share of GDP. */
  ggeShare: number
  /** Government health expenditure as a share of CHE. */
  gghedShare: number
  /** Population at LAST_YEAR, persons. */
  popAnchor: number
  /** Annual population growth. */
  popGrowth: number
  /** NCU per US$ at LAST_YEAR. */
  exrAnchor: number
  /** Annual currency depreciation. */
  exrDrift: number
}

const PROFILE_CACHE = new Map<string, CountryProfile>()

export function countryProfile(iso3: string): CountryProfile {
  const cached = PROFILE_CACHE.get(iso3)
  if (cached) return cached

  const country = COUNTRY_BY_ISO3.get(iso3)
  if (!country) throw new Error(`Unknown country: ${iso3}`)

  const income = country.GRP_WB_INCOME
  const [pcLo, pcHi] = GDP_PER_CAPITA[income] ?? [1_000, 5_000]
  const [shLo, shHi] = CHE_SHARE[income] ?? [0.04, 0.08]
  const pop = country.POP_SMALL

  /**
   * The country's real reference rate, used as-is at the anchor year.
   *
   * This must be the actual rate, not a random draw: an HA economist reads the
   * per-capita US$ indicators, and CHE/POP/EXR is only plausible if EXR is
   * roughly right. It is also what makes the currency selector meaningful — the
   * same expenditure reads in millions of JPY and thousands of GBP.
   */
  const currency = CURRENCY_BY_CODE.get(country.CURRENCY_ISO_3)
  const isUsd = country.CURRENCY_ISO_3 === 'USD'
  const exrAnchor = currency?.USD_RATE ?? 1

  // GDP per capita in US$ at the anchor year, converted to NCU millions.
  const gdpPerCapitaUsd = range(`gdppc|${iso3}`, pcLo, pcHi)

  const profile: CountryProfile = {
    iso3,
    gdpAnchor: (gdpPerCapitaUsd * pop * exrAnchor) / 1e6,
    gdpGrowth: range(`gdpg|${iso3}`, 0.02, 0.09),
    cheShare: range(`chesh|${iso3}`, shLo, shHi),
    cheShareDrift: range(`chedr|${iso3}`, -0.0008, 0.0022),
    ggeShare: range(`ggesh|${iso3}`, 0.16, 0.45),
    gghedShare: range(`gghed|${iso3}`, 0.15, 0.78),
    popAnchor: pop,
    popGrowth: range(`popg|${iso3}`, -0.002, 0.028),
    exrAnchor,
    // A US$-denominated economy has no exchange rate to drift.
    exrDrift: isUsd ? 0 : range(`exrd|${iso3}`, -0.005, 0.045),
  }
  PROFILE_CACHE.set(iso3, profile)
  return profile
}

/* --------------------------------------------------------------------------
   MACRO series
   -------------------------------------------------------------------------- */

function macroValue(iso3: string, year: number, code: string): number | null {
  const p = countryProfile(iso3)
  // Negative for every historical year — series grow backwards from the anchor.
  const t = year - LAST_YEAR
  // A small smooth wobble on top of the trend, so series look measured rather
  // than modelled.
  const wob = 1 + gaussian(`wob|${iso3}|${code}|${year}`) * 0.02

  switch (code) {
    case 'GDP':
      return gdpAt(iso3, year) * wob
    case 'GGE':
      return gdpAt(iso3, year) * p.ggeShare * wob
    case 'POP':
      return p.popAnchor * Math.pow(1 + p.popGrowth, t)
    case 'EXR':
      // Exact at the anchor year; drifts smoothly backwards.
      return (
        p.exrAnchor *
        Math.pow(1 + p.exrDrift, t) *
        (1 + gaussian(`exw|${iso3}|${year}`) * (p.exrDrift === 0 ? 0 : 0.03))
      )
    case 'PPP':
      return p.exrAnchor * Math.pow(1 + p.exrDrift * 0.6, t) * range(`ppp|${iso3}`, 0.3, 0.9)
    case 'GGHE-D': {
      const che = cheTotal(iso3, year)
      return che == null ? null : che * p.gghedShare * wob
    }
    default:
      return null
  }
}

/** GDP in NCU millions, grown backwards from the anchor year. */
function gdpAt(iso3: string, year: number): number {
  const p = countryProfile(iso3)
  return p.gdpAnchor * Math.pow(1 + p.gdpGrowth, year - LAST_YEAR)
}

/** Total current health expenditure for a country-year, in NCU millions. */
function cheTotal(iso3: string, year: number): number | null {
  const p = countryProfile(iso3)
  // The CHE/GDP ratio drifts over time, measured from the anchor.
  const share = Math.max(0.015, p.cheShare + p.cheShareDrift * (year - LAST_YEAR))
  return gdpAt(iso3, year) * share * (1 + gaussian(`chew|${iso3}|${year}`) * 0.025)
}

/* --------------------------------------------------------------------------
   Classification leaves
   -------------------------------------------------------------------------- */

/**
 * Codes that are structurally rare — real but reported by only a few countries.
 *
 * `HF.1.3` (Compulsory Medical Savings Accounts) is essentially a Singapore and
 * China instrument; treating it as a normal leaf gave Canada a larger CMSA than
 * its whole government scheme, which an HA reviewer would spot instantly.
 */
const RARE_CODES: ReadonlySet<string> = new Set(['HF.1.3', 'HCR.1', 'HCR.2', 'HK.3'])

/**
 * Codes that are residual buckets. `X.nec` means "not elsewhere classified" and
 * must stay a rounding error against the main categories — never the largest
 * component, which is what an unweighted random share produced.
 */
function isResidual(code: string): boolean {
  return code.endsWith('.nec') || code.endsWith('.9') || code.endsWith('.RI')
}

/**
 * Codes that essentially every country reports.
 *
 * Government schemes and household out-of-pocket are the two universals of
 * health accounting. Letting the ordinary 18% sparsity apply to them produced
 * Kenya with zero out-of-pocket spending — implausible enough that an HA
 * reviewer would discount the whole dataset.
 */
const ALWAYS_REPORTED: ReadonlySet<string> = new Set([
  'HF.1.1',
  'HF.3.1',
  'FS.1',
  'HC.1.1',
  'HC.1.3',
  'HP.1.1',
])

/** Whether a country reports a given leaf code at all. */
function reportsCode(iso3: string, code: string): boolean {
  if (ALWAYS_REPORTED.has(code)) return true
  // Rare instruments are reported by only a handful of countries.
  if (RARE_CODES.has(code)) return chance(`rare|${iso3}|${code}`, 0.12)
  // ~18% of ordinary leaf codes are never reported by a given country.
  return !chance(`rep|${iso3}|${code}`, 0.18)
}

/**
 * External-financing codes: transfers from abroad, and rest-of-world schemes.
 *
 * These scale inversely with income. A high-income country funds essentially
 * none of its health spending externally, whereas for a low-income country it
 * can be a third or more — and Canada showing 14% rest-of-world financing is
 * exactly the sort of thing that would undermine the demo.
 */
const EXTERNAL_CODES: ReadonlySet<string> = new Set(['HF.4', 'FS.2', 'FS.7'])

const EXTERNAL_WEIGHT: Record<WbIncome, [number, number]> = {
  HIC: [0.0, 0.012],
  UMC: [0.005, 0.05],
  LMC: [0.03, 0.22],
  LIC: [0.12, 0.55],
}

/**
 * Household out-of-pocket payment, which also tracks income — inversely.
 *
 * Rich countries pool risk and OOP sits near 10–20% of CHE; in lower-income
 * countries households carry a third or more directly. Left income-blind, Canada
 * came out at 42% OOP, which reads as obviously wrong to anyone who works with
 * this data. `OOPS%CHE_SHA2011` is one of the 16 seeded indicators, so this
 * shows up on screen.
 */
const OOP_CODES: ReadonlySet<string> = new Set(['HF.3.1', 'HF.3.2'])

const OOP_MULTIPLIER: Record<WbIncome, [number, number]> = {
  HIC: [0.25, 0.5],
  UMC: [0.6, 1.0],
  LMC: [1.1, 1.7],
  LIC: [1.0, 1.5],
}

/** Unnormalised weight of a leaf within its dimension. */
function rawWeight(iso3: string, code: string): number {
  // Residuals are small by definition — `X.nec` must never be a main category.
  if (isResidual(code)) return range(`sh|${iso3}|${code}`, 0.002, 0.03)

  if (EXTERNAL_CODES.has(code)) {
    const income = COUNTRY_BY_ISO3.get(iso3)?.GRP_WB_INCOME ?? 'LMC'
    const [lo, hi] = EXTERNAL_WEIGHT[income]
    return range(`ext|${iso3}|${code}`, lo, hi)
  }

  const base = range(`sh|${iso3}|${code}`, 0.05, 1.0)
  // Deeper codes are smaller — a level-3 category is a slice of a level-2 one.
  const depth = code.split('.').length
  const weight = base / Math.pow(1.9, Math.max(0, depth - 2))

  if (OOP_CODES.has(code)) {
    const income = COUNTRY_BY_ISO3.get(iso3)?.GRP_WB_INCOME ?? 'LMC'
    const [lo, hi] = OOP_MULTIPLIER[income]
    return weight * range(`oopm|${iso3}|${code}`, lo, hi)
  }
  return weight
}

/**
 * How much of CHE a dimension's reported leaves account for in total.
 *
 * Each classification is a different *partition of the same spending*: HF by
 * scheme, HC by function, HP by provider. So each should sum to roughly all of
 * CHE — deliberately not exactly, because real HA submissions do not reconcile
 * perfectly and the QC between-category rules need genuine small discrepancies
 * on top of the planted ones. Breakdown dimensions (DIS, AGE, GEN) cover only
 * part of spending in practice.
 */
function dimensionCoverage(iso3: string, dim: string): number {
  switch (dim) {
    case 'HF':
    case 'FS':
      return range(`cov|${iso3}|${dim}`, 0.94, 1.01)
    case 'HC':
    case 'HP':
      return range(`cov|${iso3}|${dim}`, 0.88, 0.99)
    case 'FP':
    case 'HK':
      return range(`cov|${iso3}|${dim}`, 0.25, 0.55)
    default:
      // DIS / AGE / GEN / reporting items: partial breakdowns.
      return range(`cov|${iso3}|${dim}`, 0.30, 0.75)
  }
}

/**
 * Normalising divisor for one (country, dimension): the sum of raw weights over
 * the leaves this country actually reports.
 *
 * Without this the summed leaves drifted far from the intended CHE share and
 * `CHE%GDP` — the demo's headline indicator — read at 3% for countries whose
 * real figure is 10%. Cached because it is O(leaves) and hit on every cell.
 */
const WEIGHT_SUM_CACHE = new Map<string, number>()

function weightSum(iso3: string, dim: string): number {
  const cacheKey = `${iso3}|${dim}`
  const hit = WEIGHT_SUM_CACHE.get(cacheKey)
  if (hit != null) return hit

  let sum = 0
  for (const v of CLASSIFICATION_VARIABLES) {
    if (v.dimension !== dim || v.isCalculated) continue
    if (!reportsCode(iso3, v.code)) continue
    sum += rawWeight(iso3, v.code)
  }
  const result = sum > 0 ? sum : 1
  WEIGHT_SUM_CACHE.set(cacheKey, result)
  return result
}

/**
 * Stable share of total CHE held by one reported leaf code.
 *
 * Shares are per (country, code), so a country's spending mix stays consistent
 * across years.
 */
function leafShare(iso3: string, code: string, dim: string): number {
  return (rawWeight(iso3, code) / weightSum(iso3, dim)) * dimensionCoverage(iso3, dim)
}

/**
 * The raw derived value for a reported leaf, before defects are applied.
 * Returns null when the country simply does not report this code at all —
 * genuine sparsity, which is what makes the workbook look like real HA data.
 */
function leafValue(iso3: string, year: number, code: string): number | null {
  if (!reportsCode(iso3, code)) return null

  const che = cheTotal(iso3, year)
  if (che == null) return null

  const dim = VARIABLE_BY_CODE.get(code)?.dimension
  if (dim == null) return null

  const share = leafShare(iso3, code, dim)
  // A slow shift in the spending mix over time, measured from the anchor year.
  const drift = 1 + range(`dr|${iso3}|${code}`, -0.012, 0.012) * (year - LAST_YEAR)
  const wob = 1 + gaussian(`lw|${iso3}|${code}|${year}`) * 0.05
  return Math.max(0, che * share * Math.max(0.2, drift) * wob)
}

/**
 * Value for one (country, year, code), with planted defects applied.
 * `code` may be a MACRO series or a reported classification leaf.
 */
export function derivedValue(iso3: string, year: number, code: string): number | null {
  const defect = defectFor(iso3, code, year)

  // Structural defects short-circuit before any value is produced.
  if (defect) {
    if (defect.kind === 'gap') return null
    if (defect.kind === 'disappeared') return null
    if (defect.kind === 'new') {
      // Absent before the defect year, present from it onward.
      if (year < defect.year) return null
    }
  }

  const base = code.startsWith('GDP') || ['GGE', 'POP', 'EXR', 'PPP', 'GGHE-D'].includes(code)
    ? macroValue(iso3, year, code)
    : leafValue(iso3, year, code)

  if (base == null) return null

  if (defect) {
    switch (defect.kind) {
      case 'spike':
      case 'outlier':
      case 'category-mismatch':
        return base * (defect.factor ?? 1)
      case 'atypical-zero':
        return 0
      case 'negative':
        return -Math.abs(base) * 0.4
      default:
        break
    }
  }
  return base
}

/* --------------------------------------------------------------------------
   Metadata, system fields, and full observations
   -------------------------------------------------------------------------- */

const SOURCE_NOTES = [
  'Ministry of Health annual expenditure report',
  'National Health Accounts study',
  'National statistics office — government finance statistics',
  'Ministry of Finance budget execution report',
  'Household health expenditure survey',
  'Social health insurance agency accounts',
  'WHO estimate based on national accounts',
] as const

const COMMENT_NOTES = [
  'Excluding capital expenditure',
  'Break in series following methodology revision',
  'Provisional figure pending audit',
  'Includes donor-funded vertical programmes',
  'Reclassified from previous submission',
  'Derived as residual',
] as const

function deriveMetadata(
  iso3: string,
  year: number,
  code: string,
  value: number | null,
): ObservationMetadata {
  const k = `${iso3}|${code}|${year}`
  const md: ObservationMetadata = {}

  if (chance(`md.src|${k}`, 0.55)) md.SOURCES = pick(`md.srcv|${k}`, SOURCE_NOTES)
  if (chance(`md.cmt|${k}`, 0.22)) md.COMMENT = pick(`md.cmtv|${k}`, COMMENT_NOTES)
  if (chance(`md.web|${k}`, 0.08)) {
    md.WEB_LINK = `https://example.org/ha/${iso3.toLowerCase()}/${year}`
  }

  // A defect's note becomes a real comment, so a QC finding always traces back
  // to something a human can read on the cell.
  const defect = defectFor(iso3, code, year)
  if (defect && defect.kind !== 'gap') md.COMMENT = defect.note

  if (value != null) {
    md.EST_METHOD = chance(`md.est|${k}`, 0.7)
      ? 'Reported by country'
      : pick(`md.estv|${k}`, ['Derived as Estimated', 'Derived by WHO', 'Interpolated'] as const)
    md.DATA_TYPE = chance(`md.dt|${k}`, 0.72)
      ? 'Reported'
      : pick(`md.dtv|${k}`, ['Estimated', 'Partially Derived', 'Provisional'] as const)
  } else if (Object.keys(md).length === 0) {
    // FR §1: an observation may legitimately have no value but still carry
    // metadata. Guarantee a few of those exist so the workbook shows them.
    if (chance(`md.only|${k}`, 0.3)) {
      md.COMMENT = 'Not reported for this year'
    }
  }
  return md
}

/**
 * Deterministic system fields. `Sys_CommitDateUtc` derives from DEMO_NOW rather
 * than the wall clock so the Annex 3 `LastModified` filter and the version
 * history are stable across runs.
 */
function deriveSys(iso3: string, year: number, code: string): SysFields {
  const k = `${iso3}|${code}|${year}`
  const batchId = int(`sys.batch|${iso3}|${year}`, 860_000, 890_000)
  // Committed somewhere in the last two years, older for older reference years.
  const daysBack = int(`sys.days|${k}`, 5, 700)
  const commit = new Date(DEMO_NOW.getTime() - daysBack * 86_400_000)

  return {
    Sys_RowId: `${Math.floor(unit(`sys.row|${k}`) * 0xffffffff).toString(16)}`,
    Sys_Origin: `LOAD_HA_${iso3}`,
    Sys_LoadBatchId: batchId,
    Sys_CommitDateUtc: commit.toISOString(),
    Sys_FirstLoadUser: 'xmart.loader@who.int',
    Sys_ID: `${int(`sys.id|${k}`, 40_000, 49_999)}`,
    Sys_BatchId: batchId,
    Sys_FirstBatchID: batchId,
    // A small share of rows are soft-deleted, so Annex 3's IsDeleted filter and
    // "must reflect deleted records" requirement have something to act on.
    Sys_IsDeleted: chance(`sys.del|${k}`, 0.015),
  }
}

/**
 * Build one observation for a single-dimension tuple.
 * Returns null when the country reports neither a value nor metadata for it —
 * per FR §1 an observation requires at least one of the two.
 */
export function buildObservation(
  iso3: string,
  year: number,
  dimension: DimensionCode,
  code: string,
): Observation | null {
  const value = derivedValue(iso3, year, code)
  const metadata = deriveMetadata(iso3, year, code, value)

  if (value == null && Object.keys(metadata).length === 0) return null

  const dims: Dimensions = { [dimension]: code }
  return {
    surveyFk: surveyFk(iso3, year),
    iso3,
    year,
    dims,
    value,
    metadata,
    publishingStatus: chance(`pub|${iso3}|${code}|${year}`, 0.62)
      ? 'ready-to-publish'
      : 'not-publish',
    sys: deriveSys(iso3, year, code),
  }
}

/**
 * Build one observation for a cross (a multi-dimension tuple).
 *
 * A cross value is a share of the smaller of its two member values — a cross
 * cell can never exceed either margin, which is the sort of internal
 * consistency an HA reviewer notices immediately.
 */
export function buildCrossObservation(
  iso3: string,
  year: number,
  dims: Dimensions,
): Observation | null {
  const codes = Object.values(dims).filter((v): v is string => v != null && v !== '')
  if (codes.length < 2) return null

  const margins = codes.map((c) => derivedValue(iso3, year, c))
  if (margins.some((m) => m == null)) return null

  const key = observationKey(iso3, year, dims)
  const smallest = Math.min(...(margins as number[]))
  const value = smallest * range(`cross|${key}`, 0.05, 0.6)

  return {
    surveyFk: surveyFk(iso3, year),
    iso3,
    year,
    dims,
    value,
    metadata: chance(`cross.md|${key}`, 0.3)
      ? { SOURCES: pick(`cross.src|${key}`, SOURCE_NOTES), DATA_TYPE: 'Estimated' }
      : {},
    publishingStatus: chance(`cross.pub|${key}`, 0.5) ? 'ready-to-publish' : 'not-publish',
    sys: deriveSys(iso3, year, key),
  }
}
