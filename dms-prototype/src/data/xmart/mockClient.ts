/**
 * In-memory XMartClient.
 *
 * Answers every query by *deriving* the requested slice from the seeded hash and
 * then layering local edits over it. Nothing is materialised, so a query for one
 * country-year costs microseconds and a query for everything is bounded only by
 * the page size — which is what makes the Annex 3 paging story real rather than
 * simulated.
 *
 * Artificial latency and an API-log entry per call are deliberate: the modules
 * above must exercise genuine loading and error states, and the Dev drawer must
 * be able to show that DMS talks to a warehouse it does not own.
 */

import { DEMO_NOW, DIMENSIONS, SOURCE_FORMATS, type DimensionCode } from '@/domain/constants'
import type { SyncStatus } from '@/domain/integration'
import { dimsKey, observationKey } from '@/domain/keys'
import type {
  Classification,
  Cross,
  DmsUser,
  Formula,
  ImportBatch,
  MetadataFieldDef,
  Observation,
  ObservationVersion,
  ReportingContact,
  Variable,
} from '@/domain/types'
import { getEdit, nextBatchId } from '../db'
import { buildCrossObservation, buildObservation } from '../generators/observations'
import { int, pick, range, shuffled } from '../generators/seedRandom'
import { buildVersions } from '../generators/versions'
import { CLASSIFICATIONS, CLASSIFICATION_VARIABLES, VARIABLE_BY_CODE } from '../seed/classifications'
import { COUNTRIES } from '../seed/countries'
import { CROSS_BY_CODE, SEED_CROSSES } from '../seed/crosses'
import { CURRENCIES } from '../seed/currencies'
import { FORMULA_COUNTRY_OVERRIDES, LEGACY_FORMULAS, PREDEFINED_FORMULAS } from '../seed/formulas'
import { METADATA_FIELD_DEFS } from '../seed/metadataFields'
import { REPORTING_CONTACTS } from '../seed/reportingFollowUp'
import { buildSyncStatuses } from '../seed/syncStatus'
import { SEED_USERS } from '../seed/users'
import { buildRequestUrl, logApiCall } from './apiLog'
import {
  DATASET_AS_OF_MAX_SCAN,
  DEFAULT_PAGE_SIZE,
  MOCK_LATENCY_MS,
  type DatasetAsOfChange,
  type DatasetAsOfResult,
  type ObservationChange,
  type ObservationPage,
  type ObservationQuery,
  type PutResult,
  type XMartClient,
} from './client'

/* --------------------------------------------------------------------------
   Call plumbing
   -------------------------------------------------------------------------- */

function latency(): number {
  const [lo, hi] = MOCK_LATENCY_MS
  return lo + Math.random() * (hi - lo)
}

/**
 * Run an operation with realistic latency and log it.
 *
 * `Math.random()` is fine here — latency is presentation, not data. Everything
 * that affects a *value* uses the seeded hash instead.
 */
async function call<T>(
  method: string,
  direction: 'pull' | 'push',
  path: string,
  params: Record<string, unknown>,
  op: () => T,
  countRows: (result: T) => number,
): Promise<T> {
  const started = performance.now()
  const wait = latency()
  await new Promise((r) => setTimeout(r, wait))

  try {
    const result = op()
    logApiCall({
      direction,
      method,
      request: `${direction === 'pull' ? 'GET' : 'POST'} ${buildRequestUrl(path, params)}`,
      params,
      rowCount: countRows(result),
      durationMs: Math.round(performance.now() - started),
      status: 'ok',
    })
    return result
  } catch (e) {
    logApiCall({
      direction,
      method,
      request: `${direction === 'pull' ? 'GET' : 'POST'} ${buildRequestUrl(path, params)}`,
      params,
      rowCount: 0,
      durationMs: Math.round(performance.now() - started),
      status: 'error',
      error: e instanceof Error ? e.message : String(e),
    })
    throw e
  }
}

/* --------------------------------------------------------------------------
   Observation derivation + edit overlay
   -------------------------------------------------------------------------- */

/** Apply any local edit on top of a derived observation. */
function withEdit(o: Observation): Observation {
  const key = observationKey(o.iso3, o.year, o.dims)
  const edit = getEdit(key)
  if (!edit) return o

  return {
    ...o,
    value: 'value' in edit ? (edit.value ?? null) : o.value,
    formula: 'formula' in edit ? (edit.formula ?? undefined) : o.formula,
    metadata: { ...o.metadata, ...edit.metadata },
    publishingStatus: edit.publishingStatus ?? o.publishingStatus,
    sys: {
      ...o.sys,
      // An edited row is newly modified — this is what makes Annex 3's
      // `modifiedSince` filter behave correctly after a demo edit.
      Sys_CommitDateUtc: edit.editedUtc,
      Sys_IsDeleted: edit.isDeleted ?? o.sys.Sys_IsDeleted,
    },
  }
}

/** Resolve which years a query covers. */
function resolveYears(q: ObservationQuery): number[] {
  if (q.years?.length) return [...q.years]
  const from = q.yearFrom ?? 2000
  const to = q.yearTo ?? 2024
  const out: number[] = []
  for (let y = from; y <= to; y++) out.push(y)
  return out
}

/** Resolve which countries a query covers — empty means all (Annex 3). */
function resolveCountries(q: ObservationQuery): string[] {
  if (q.countries?.length) return [...q.countries]
  return COUNTRIES.map((c) => c.CODE_ISO_3)
}

/**
 * Variables to derive. Defaults to every reported (non-calculated) code —
 * aggregates and indicators are the formula engine's job, not the warehouse's.
 */
function resolveVariables(q: ObservationQuery): Variable[] {
  if (q.variables?.length) {
    return q.variables
      .map((c) => VARIABLE_BY_CODE.get(c))
      .filter((v): v is Variable => v != null)
  }
  return CLASSIFICATION_VARIABLES.filter((v) => !v.isCalculated)
}

function generate(q: ObservationQuery): Observation[] {
  const countries = resolveCountries(q)
  const years = resolveYears(q)
  const variables = resolveVariables(q)
  const crosses = (q.crosses ?? [])
    .map((c) => CROSS_BY_CODE.get(c))
    .filter((c): c is Cross => c != null)

  const rows: Observation[] = []
  const cutoff = q.modifiedSince ? Date.parse(q.modifiedSince) : null

  for (const iso3 of countries) {
    for (const year of years) {
      for (const v of variables) {
        if (v.dimension == null) continue
        const o = buildObservation(iso3, year, v.dimension as DimensionCode, v.code)
        if (o) rows.push(withEdit(o))
      }
      for (const x of crosses) {
        // A custom cross only exists for the countries it is scoped to (UC026).
        if (x.scope === 'custom' && !x.countryScope.includes(iso3)) continue
        const o = buildCrossObservation(iso3, year, x.members)
        if (o) rows.push(withEdit(o))
      }
    }
  }

  // Annex 3 filters, applied after derivation so edits are respected.
  return rows.filter((o) => {
    if (!q.includeDeleted && o.sys.Sys_IsDeleted) return false
    if (cutoff != null && Date.parse(o.sys.Sys_CommitDateUtc) < cutoff) return false
    return true
  })
}

/**
 * Prior versions of one observation, rebuilt from its key.
 *
 * Shared by `getVersions` and `getVersionsBulk` so the single-key and bulk
 * forms can never disagree about an observation's history — which they would,
 * eventually, if the bulk form re-derived it independently.
 */
function versionsForKey(key: string): readonly ObservationVersion[] {
  // Rebuild the current observation so versions walk back from the real value.
  const hash = key.indexOf('#')
  if (hash < 0) return []
  const head = key.slice(0, hash)
  const [iso3, yearStr] = head.split('-')
  if (!iso3 || !yearStr) return []
  const year = Number(yearStr)

  const dimsPart = key.slice(hash + 1)
  const dims: Record<string, string> = {}
  for (const pair of dimsPart.split('|')) {
    const eq = pair.indexOf('=')
    if (eq > 0) dims[pair.slice(0, eq)] = pair.slice(eq + 1)
  }
  const entries = Object.entries(dims)
  const first = entries[0]
  if (!first) return []

  const current =
    entries.length === 1
      ? buildObservation(iso3, year, first[0] as DimensionCode, first[1])
      : buildCrossObservation(iso3, year, dims)

  if (!current) return []
  const edited = withEdit(current)
  return buildVersions(key, edited.value, edited.metadata)
}

/* --------------------------------------------------------------------------
   Dataset-level as-of (UC044)
   -------------------------------------------------------------------------- */

/**
 * What a slice looked like on a past date.
 *
 * The rule is *"the version that was current on that date"* — the newest
 * version whose commit stamp is at or before the as-of instant. An observation
 * with no such version is skipped rather than treated as null: its history
 * simply does not reach back that far, and restoring it to "nothing" would
 * delete data on the strength of missing evidence.
 */
function datasetAsOf(query: ObservationQuery, asOfUtc: string): DatasetAsOfResult {
  const rows = generate(query)
  const cutoff = Date.parse(asOfUtc)
  const changes: DatasetAsOfChange[] = []

  const budget = Math.min(rows.length, DATASET_AS_OF_MAX_SCAN)
  let withHistory = 0

  for (let i = 0; i < budget; i++) {
    const o = rows[i]
    if (!o) continue
    const key = observationKey(o.iso3, o.year, o.dims)
    const versions = versionsForKey(key)
    if (versions.length === 0) continue
    withHistory++

    // Versions are chronological, so the last one at or before the cutoff is
    // the one that was current.
    let asOf: ObservationVersion | undefined
    for (const v of versions) {
      if (Date.parse(v.commitDateUtc) <= cutoff) asOf = v
      else break
    }
    if (!asOf) continue
    if (asOf.value === o.value) continue

    changes.push({
      observationKey: key,
      iso3: o.iso3,
      year: o.year,
      code: Object.values(o.dims).join(' × '),
      currentValue: o.value,
      asOfValue: asOf.value,
      asOfCommitDateUtc: asOf.commitDateUtc,
      asOfAuthor: asOf.author,
    })
  }

  return {
    asOfUtc,
    scanned: budget,
    withHistory,
    changes,
    truncated: rows.length > budget,
  }
}

/* --------------------------------------------------------------------------
   Import batches (UC039)
   -------------------------------------------------------------------------- */

function importBatchesFor(iso3: string): ImportBatch[] {
  // HLR17: "Each country can send data sets for a maximum of 10 times a year".
  const n = int(`ib.n|${iso3}`, 1, 6)
  const out: ImportBatch[] = []

  for (let i = 0; i < n; i++) {
    const k = `${iso3}|${i}`
    const daysBack = int(`ib.d|${k}`, 10, 640)
    const format = pick(`ib.f|${k}`, SOURCE_FORMATS)
    const yearTo = 2024 - int(`ib.yt|${k}`, 0, 2)
    out.push({
      batchId: int(`ib.b|${k}`, 860_000, 889_999),
      iso3,
      series: `${2026 - Math.floor(daysBack / 365)} round`,
      format,
      receivedUtc: new Date(DEMO_NOW.getTime() - daysBack * 86_400_000).toISOString(),
      rowCount: int(`ib.r|${k}`, 240, 26_000),
      yearsCovered: [2000, yearTo],
      status:
        range(`ib.s|${k}`, 0, 1) < 0.82
          ? 'processed'
          : range(`ib.s2|${k}`, 0, 1) < 0.7
            ? 'processed-with-warnings'
            : 'failed',
      origin:
        format === 'JHAQ'
          ? 'eDamis (sftp)'
          : format === 'HAPT'
            ? 'HAPT API'
            : format === 'LongFormat'
              ? 'Manual upload'
              : 'Shared folder (OneDrive)',
    })
  }
  return out.sort((a, b) => b.receivedUtc.localeCompare(a.receivedUtc))
}

/* --------------------------------------------------------------------------
   The client
   -------------------------------------------------------------------------- */

/** Formulas as xMart holds them, with UC029 country overrides applied. */
function allFormulas(): Formula[] {
  const withOverrides = PREDEFINED_FORMULAS.map((f) => {
    const overrides = FORMULA_COUNTRY_OVERRIDES[f.code]
    return overrides ? { ...f, countryOverrides: overrides } : f
  })
  return [...withOverrides, ...LEGACY_FORMULAS]
}

export const mockXMartClient: XMartClient = {
  getCountries: () =>
    call('getCountries', 'pull', 'COUNTRY_LIST', {}, () => COUNTRIES, (r) => r.length),

  getCurrencies: () =>
    call('getCurrencies', 'pull', 'CURRENCY_LIST', {}, () => CURRENCIES, (r) => r.length),

  getClassifications: () =>
    call(
      'getClassifications',
      'pull',
      'CLASSIFICATION_LIST',
      {},
      () => CLASSIFICATIONS as readonly Classification[],
      (r) => r.length,
    ),

  getVariables: () =>
    call(
      'getVariables',
      'pull',
      'VARIABLE_LIST',
      {},
      () => CLASSIFICATION_VARIABLES,
      (r) => r.length,
    ),

  getCrosses: () =>
    call('getCrosses', 'pull', 'CROSS_LIST', {}, () => SEED_CROSSES, (r) => r.length),

  getFormulas: () =>
    call('getFormulas', 'pull', 'FORMULA_LIST', {}, allFormulas, (r) => r.length),

  getMetadataFields: () =>
    call(
      'getMetadataFields',
      'pull',
      'METADATA_FIELD_LIST',
      {},
      () => METADATA_FIELD_DEFS as readonly MetadataFieldDef[],
      (r) => r.length,
    ),

  getObservations: (query: ObservationQuery) => {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE

    return call(
      'getObservations',
      'pull',
      'HEALTH_EXPENDITURE',
      {
        $filter: [
          query.countries?.length ? `SURVEY_FK startswith (${query.countries.join(',')})` : null,
          query.yearFrom || query.yearTo
            ? `YEAR ge ${query.yearFrom ?? 2000} and YEAR le ${query.yearTo ?? 2024}`
            : null,
          query.modifiedSince ? `Sys_CommitDateUtc ge ${query.modifiedSince}` : null,
          query.includeDeleted ? null : 'Sys_IsDeleted eq false',
        ]
          .filter(Boolean)
          .join(' and '),
        $top: pageSize,
        $skip: (page - 1) * pageSize,
        $format: 'csv',
      },
      (): ObservationPage => {
        const all = generate(query)
        const start = (page - 1) * pageSize
        const rows = all.slice(start, start + pageSize)
        const maxCommit = rows.reduce<string | null>(
          (acc, o) =>
            acc == null || o.sys.Sys_CommitDateUtc > acc ? o.sys.Sys_CommitDateUtc : acc,
          null,
        )
        return {
          rows,
          page,
          pageSize,
          totalCount: all.length,
          hasMore: start + rows.length < all.length,
          maxCommitDateUtc: maxCommit,
        }
      },
      (r) => r.rows.length,
    )
  },

  getVersions: (key: string) =>
    call(
      'getVersions',
      'pull',
      'HEALTH_EXPENDITURE_HISTORY',
      { $filter: `Sys_ID eq '${key}'`, $orderby: 'Sys_CommitDateUtc desc' },
      () => versionsForKey(key),
      (r) => r.length,
    ),

  getVersionsBulk: (keys: readonly string[]) =>
    call(
      'getVersionsBulk',
      'pull',
      'HEALTH_EXPENDITURE_HISTORY',
      {
        // The real request is an `in` filter over the business keys, which is
        // what makes this one round trip rather than `keys.length` of them.
        $filter: `Sys_ID in (${keys.length} keys)`,
        $orderby: 'Sys_ID, Sys_CommitDateUtc desc',
      },
      (): ReadonlyMap<string, readonly ObservationVersion[]> => {
        const out = new Map<string, readonly ObservationVersion[]>()
        for (const key of keys) {
          const versions = versionsForKey(key)
          // Only keys that actually have history: a map with thousands of empty
          // arrays in it costs memory and tells the caller nothing.
          if (versions.length > 0) out.set(key, versions)
        }
        return out
      },
      (r) => {
        let n = 0
        for (const v of r.values()) n += v.length
        return n
      },
    ),

  getDatasetAsOf: (query: ObservationQuery, asOfUtc: string) =>
    call(
      'getDatasetAsOf',
      'pull',
      'HEALTH_EXPENDITURE_HISTORY',
      {
        $filter: [
          query.countries?.length ? `SURVEY_FK startswith (${query.countries.join(',')})` : null,
          `Sys_CommitDateUtc le ${asOfUtc}`,
        ]
          .filter(Boolean)
          .join(' and '),
        $apply: 'groupby((Sys_ID), aggregate(Sys_CommitDateUtc with max as AsOf))',
      },
      () => datasetAsOf(query, asOfUtc),
      (r) => r.changes.length,
    ),

  putObservations: (changes: readonly ObservationChange[]) =>
    call(
      'putObservations',
      'push',
      'HEALTH_EXPENDITURE',
      {
        rows: changes.length,
        // UC046: the payload carries the author of every change.
        authors: [...new Set(changes.map((c) => c.authorId))].join(','),
      },
      (): PutResult => {
        const batchId = nextBatchId()
        const errors: { observationKey: string; reason: string }[] = []

        for (const c of changes) {
          if (!c.observationKey.includes('#')) {
            errors.push({ observationKey: c.observationKey, reason: 'Malformed observation key' })
          }
        }
        return {
          accepted: changes.length - errors.length,
          rejected: errors.length,
          batchId,
          commitDateUtc: new Date(DEMO_NOW.getTime()).toISOString(),
          errors,
        }
      },
      (r) => r.accepted,
    ),

  getImportBatches: (countries?: readonly string[]) =>
    call(
      'getImportBatches',
      'pull',
      'LOAD_BATCH_LIST',
      { $filter: countries?.length ? `ISO3 in (${countries.join(',')})` : '' },
      (): readonly ImportBatch[] => {
        const list = countries?.length ? countries : COUNTRIES.map((c) => c.CODE_ISO_3)
        return list.flatMap(importBatchesFor)
      },
      (r) => r.length,
    ),

  getReportingContacts: () =>
    call(
      'getReportingContacts',
      'pull',
      'REPORTING_FOLLOWUP',
      {},
      () => REPORTING_CONTACTS as readonly ReportingContact[],
      (r) => r.length,
    ),

  getSyncStatus: () =>
    call(
      'getSyncStatus',
      'pull',
      'LOAD_STATUS',
      { $orderby: 'LastSyncUtc desc' },
      (): readonly SyncStatus[] => buildSyncStatuses(),
      (r) => r.length,
    ),

  getUsers: () =>
    call('getUsers', 'pull', 'DMS_USER_LIST', {}, () => SEED_USERS as readonly DmsUser[], (r) => r.length),
}

/* --------------------------------------------------------------------------
   Demo helpers
   -------------------------------------------------------------------------- */

/**
 * A handful of countries with dense, well-behaved data for the demo script.
 * Canada is the §6 walkthrough subject; the rest give the pickers something
 * recognisable at the top of the list.
 */
export const DEMO_COUNTRIES: readonly string[] = ['CAN', 'ARG', 'FRA', 'KEN', 'IDN', 'THA']

/** Deterministic sample of countries, for dashboards that need a spread. */
export function sampleCountries(n: number, seed = 'sample'): string[] {
  return shuffled(seed, COUNTRIES.map((c) => c.CODE_ISO_3)).slice(0, n)
}

/** Dimension codes that actually carry seeded data, for picker defaults. */
export const POPULATED_DIMENSIONS: readonly DimensionCode[] = DIMENSIONS.filter((d) =>
  CLASSIFICATION_VARIABLES.some((v) => v.dimension === d && !v.isCalculated),
)

/** Stable key for an observation, re-exported so modules need one import. */
export { observationKey, dimsKey }
