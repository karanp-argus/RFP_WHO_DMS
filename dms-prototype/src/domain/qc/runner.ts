/**
 * The quality-check runner.
 *
 * Pure: it reads every value through the `QcDataAccess` closure it is handed,
 * exactly as the formula engine reads through `resolveReported`. That is what
 * lets the same runner serve the QC module (a scope of countries pulled from
 * xMart), the Workbook's inline check (UC052 — the cells currently on screen)
 * and the unit tests (a hand-built fixture), with no branch anywhere for which
 * of the three it is.
 *
 * One evaluator per rule type, each returning findings. They are deliberately
 * written as separate functions rather than one parameterised sweep: the
 * comparisons genuinely differ — a growth rule walks pairs of years, a
 * continuity rule walks the whole series once, an outlier rule needs every
 * country in the scope before it can judge any of them — and folding them into
 * a single loop would make each one harder to read than all ten are apart.
 *
 * **Nothing is silently capped.** A run has a check budget, and a rule that hits
 * it comes back with `truncated: true` so the report can say what it did not
 * reach. A quality tool that quietly stops early is worse than one that refuses
 * to start.
 */

import { growthPercent } from '../formula/series'
import {
  QC_DEVIATION_UNITS,
  type QcDeviationUnit,
  type QcFinding,
  type QcGroupAttribute,
  type QcRule,
  type QcRuleStat,
  type QcRunResult,
  type QcRunScope,
  type QcSeverity,
} from './ruleTypes'
import { severityFor, thresholdsFor, type QcThresholdSet } from './thresholds'

/* ==========================================================================
   THE DATA DOOR
   ========================================================================== */

export interface QcVersionPoint {
  versionNumber: number
  value: number | null
  commitDateUtc: string
  author: string
}

/**
 * Everything the runner may ask about the corpus.
 *
 * Deliberately narrow and value-shaped: no query objects, no promises. The
 * caller does the fetching and hands over a synchronous view, so a run is a
 * pure function of its inputs and a test fixture is a few `Map`s.
 */
export interface QcDataAccess {
  /** Value at a coordinate — reported, aggregated or computed. */
  valueOf(iso3: string, year: number, code: string): number | null
  /** The cell a finding rings in a workbook (UC052). */
  observationKeyOf(iso3: string, year: number, code: string): string
  /** Children of an aggregate code; empty for a leaf. */
  childrenOf(code: string): readonly string[]
  labelOf(code: string): string
  countryName(iso3: string): string
  attributeOf(iso3: string, attribute: QcGroupAttribute): string
  /** Prior versions, oldest first. Empty when the observation has none. */
  versionsOf(iso3: string, year: number, code: string): readonly QcVersionPoint[]
  /**
   * The observation's comment. For a seeded defect this is the note from
   * `generators/defects.ts`, which is what makes every demo finding traceable
   * to a sentence someone wrote about why the data looks like that.
   */
  noteOf(iso3: string, year: number, code: string): string | undefined
  /** Current health expenditure, for `share-of-che` normalisation. */
  cheOf(iso3: string, year: number): number | null
}

export interface QcRunRequest {
  rules: readonly QcRule[]
  scope: QcRunScope
  thresholds: QcThresholdSet
  data: QcDataAccess
  /** Identity stamped on the run summary. */
  runBy: string
  /** ISO timestamp — derived from `DEMO_NOW` by the caller, never `Date.now()`. */
  runUtc: string
  runId: string
  /** Upper bound on value reads. Exceeding it flags the rule, never hides it. */
  maxChecks?: number
}

/** Generous enough that no realistic demo scope reaches it, low enough to bound a mistake. */
export const DEFAULT_MAX_CHECKS = 400_000

/* ==========================================================================
   SMALL HELPERS
   ========================================================================== */

function fmt(value: number | null, decimals = 1): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${fmt(value)}`
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? null
  const lo = sorted[mid - 1]
  const hi = sorted[mid]
  return lo == null || hi == null ? null : (lo + hi) / 2
}

/**
 * Median absolute deviation, scaled to be comparable with a standard deviation.
 *
 * Used instead of mean-and-σ because the group being measured *contains* the
 * outlier the rule is looking for: a mean is dragged toward it and a σ is
 * inflated by it, so the naive z-score of a genuine outlier is systematically
 * too small. The 1.4826 factor makes MAD estimate σ for normally distributed
 * data, so a threshold expressed in "sigma" keeps its usual meaning.
 */
export function robustSigma(values: readonly number[]): number | null {
  const m = median(values)
  if (m == null) return null
  const mad = median(values.map((v) => Math.abs(v - m)))
  if (mad == null || mad === 0) {
    // A group whose members are identical has no spread to measure against.
    // Falling back to the standard deviation keeps the rule usable rather than
    // returning a divide-by-zero sigma of Infinity for every member.
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
    const sd = Math.sqrt(variance)
    return sd > 0 ? sd : null
  }
  return mad * 1.4826
}

/** Signed measure → the magnitude the threshold is applied to, per comparison. */
function deviationFor(measure: number, comparison: QcRule['comparison']): number {
  switch (comparison) {
    case 'above':
      return measure
    case 'below':
      return -measure
    default:
      return Math.abs(measure)
  }
}

function yearsFor(rule: QcRule, scope: QcRunScope): number[] {
  const from = Math.max(rule.yearFrom ?? scope.yearFrom, scope.yearFrom)
  const to = Math.min(rule.yearTo ?? scope.yearTo, scope.yearTo)
  const out: number[] = []
  for (let y = from; y <= to; y++) out.push(y)
  return out
}

/* ==========================================================================
   ONE FINDING
   ========================================================================== */

interface FindingDraft {
  iso3: string
  year: number
  code: string
  severity: QcSeverity
  expected: number | null
  actual: number | null
  deviation: number
  message: string
}

function buildFinding(rule: QcRule, data: QcDataAccess, draft: FindingDraft): QcFinding {
  const note = data.noteOf(draft.iso3, draft.year, draft.code)
  return {
    id: `${rule.id}|${draft.iso3}|${draft.year}|${draft.code}`,
    ruleId: rule.id,
    ruleName: rule.name,
    ruleType: rule.type,
    ruleOrigin: rule.origin,
    iso3: draft.iso3,
    countryName: data.countryName(draft.iso3),
    year: draft.year,
    code: draft.code,
    variableLabel: data.labelOf(draft.code),
    observationKey: data.observationKeyOf(draft.iso3, draft.year, draft.code),
    severity: draft.severity,
    expected: draft.expected,
    actual: draft.actual,
    deviation: draft.deviation,
    deviationUnit: QC_DEVIATION_UNITS[rule.type].unit as QcDeviationUnit,
    message: draft.message,
    ...(note ? { note } : {}),
  }
}

/* ==========================================================================
   THE EVALUATORS
   ========================================================================== */

interface EvalContext {
  rule: QcRule
  data: QcDataAccess
  countries: readonly string[]
  years: readonly number[]
  pair: { warnAt: number; failAt: number }
  /** Increment per value read; returns false once the budget is spent. */
  spend: (n: number) => boolean
}

type Evaluator = (ctx: EvalContext) => FindingDraft[]

/* --- growth ------------------------------------------------------------- */

const evaluateYoy =
  (mode: 'absolute' | 'relative'): Evaluator =>
  ({ rule, data, countries, years, pair, spend }) => {
    const out: FindingDraft[] = []
    for (const iso3 of countries) {
      for (const code of rule.variables) {
        for (const year of years) {
          if (!spend(2)) return out
          const previous = data.valueOf(iso3, year - 1, code)
          const current = data.valueOf(iso3, year, code)
          if (previous == null || current == null) continue

          const measure =
            mode === 'absolute' ? current - previous : growthPercent(current, previous)
          if (measure == null) continue

          const deviation = deviationFor(measure, rule.comparison)
          const severity = severityFor(deviation, pair)
          if (!severity) continue

          out.push({
            iso3,
            year,
            code,
            severity,
            expected: previous,
            actual: current,
            deviation,
            message:
              mode === 'absolute'
                ? `${code} moved by ${signed(measure)} between ${year - 1} and ${year} (${fmt(previous)} → ${fmt(current)}).`
                : `${code} changed by ${signed(measure)}% between ${year - 1} and ${year} (${fmt(previous)} → ${fmt(current)}).`,
          })
        }
      }
    }
    return out
  }

/**
 * UC053's *"growth between two data versions"*.
 *
 * The two versions compared are the **earliest retained** one and the current
 * value — that is, how far a figure has travelled since the submission it
 * started from. Comparing against the immediately preceding version instead was
 * the first implementation and it reported nothing: consecutive resubmissions
 * differ by a few percent each, so a threshold set where a reviewer would want
 * it never sees a single step. The distance that matters, and the one a
 * reviewer is asked to defend, is the cumulative one.
 *
 * The step-by-step history is not lost — it is exactly what the UC043/UC044
 * compare screen shows, reachable from any finding by right-clicking the cell.
 */
const evaluateVersionGrowth: Evaluator = ({ rule, data, countries, years, pair, spend }) => {
  const out: FindingDraft[] = []
  for (const iso3 of countries) {
    for (const code of rule.variables) {
      for (const year of years) {
        if (!spend(2)) return out
        const current = data.valueOf(iso3, year, code)
        if (current == null) continue
        const versions = data.versionsOf(iso3, year, code)
        const origin = versions[0]
        if (!origin || origin.value == null) continue

        const measure = growthPercent(current, origin.value)
        if (measure == null) continue
        const deviation = deviationFor(measure, rule.comparison)
        const severity = severityFor(deviation, pair)
        if (!severity) continue

        out.push({
          iso3,
          year,
          code,
          severity,
          expected: origin.value,
          actual: current,
          deviation,
          message: `${code} has moved ${signed(measure)}% across ${versions.length} revision${versions.length === 1 ? '' : 's'} since version ${origin.versionNumber}, committed ${origin.commitDateUtc.slice(0, 10)} by ${origin.author}.`,
        })
      }
    }
  }
  return out
}

/* --- reporting continuity ------------------------------------------------ */

/**
 * The years in which a country reported *anything* the rule looks at.
 *
 * This is what "vs prior reporting" is measured against. Without it, a country
 * whose whole submission history starts in 2006 would raise a "new observation"
 * for every code it reports — which is true in the narrowest sense and useless
 * in every other, because nothing about that code is new.
 */
function activeYears(ctx: EvalContext, iso3: string): Set<number> {
  const active = new Set<number>()
  for (const year of ctx.years) {
    for (const code of ctx.rule.variables) {
      if (!ctx.spend(1)) return active
      if (ctx.data.valueOf(iso3, year, code) != null) {
        active.add(year)
        break
      }
    }
  }
  return active
}

/** Years in which one code has a value, ascending. */
function reportedYears(ctx: EvalContext, iso3: string, code: string): number[] {
  const out: number[] = []
  for (const year of ctx.years) {
    if (!ctx.spend(1)) return out
    if (ctx.data.valueOf(iso3, year, code) != null) out.push(year)
  }
  return out
}

const evaluateNewObservation: Evaluator = (ctx) => {
  const { rule, data, countries, pair } = ctx
  const out: FindingDraft[] = []
  for (const iso3 of countries) {
    const active = activeYears(ctx, iso3)
    for (const code of rule.variables) {
      const reported = reportedYears(ctx, iso3, code)
      const first = reported[0]
      if (first == null) continue
      // Years the country was reporting other variables but not this one.
      const silence = [...active].filter((y) => y < first).length
      if (silence === 0) continue

      const severity = severityFor(silence, pair)
      if (!severity) continue

      out.push({
        iso3,
        year: first,
        code,
        severity,
        expected: null,
        actual: data.valueOf(iso3, first, code),
        deviation: silence,
        message: `${code} is reported for the first time in ${first}, after ${silence} year${silence === 1 ? '' : 's'} in which this country reported other variables but not this one.`,
      })
    }
  }
  return out
}

const evaluateDisappeared: Evaluator = (ctx) => {
  const { rule, data, countries, years, pair } = ctx
  const lastYear = years[years.length - 1]
  const out: FindingDraft[] = []
  if (lastYear == null) return out

  for (const iso3 of countries) {
    const active = activeYears(ctx, iso3)
    for (const code of rule.variables) {
      const reported = reportedYears(ctx, iso3, code)
      const last = reported[reported.length - 1]
      if (last == null || last >= lastYear) continue
      // Only a disappearance if the country carried on reporting afterwards.
      if (![...active].some((y) => y > last)) continue

      // How established the series was: the unbroken run ending at `last`.
      let run = 0
      for (let i = reported.length - 1; i > 0; i--) {
        const here = reported[i]
        const before = reported[i - 1]
        if (here == null || before == null || here - before !== 1) break
        run++
      }
      const established = run + 1

      const severity = severityFor(established, pair)
      if (!severity) continue

      out.push({
        iso3,
        year: last,
        code,
        severity,
        expected: data.valueOf(iso3, last, code),
        actual: null,
        deviation: established,
        message: `${code} was reported for ${established} consecutive years up to ${last} and is absent from ${last + 1} onward, while the country continued to report other variables.`,
      })
    }
  }
  return out
}

const evaluateMissing: Evaluator = (ctx) => {
  const { rule, data, countries, pair } = ctx
  const out: FindingDraft[] = []
  for (const iso3 of countries) {
    for (const code of rule.variables) {
      const reported = reportedYears(ctx, iso3, code)
      if (reported.length < 2) continue

      for (let i = 1; i < reported.length; i++) {
        const before = reported[i - 1]
        const after = reported[i]
        if (before == null || after == null) continue
        const gap = after - before - 1
        if (gap <= 0) continue

        const severity = severityFor(gap, pair)
        if (!severity) continue

        // Anchored at the first missing year, so the finding rings the cell a
        // user would go to in order to fix it.
        out.push({
          iso3,
          year: before + 1,
          code,
          severity,
          expected: data.valueOf(iso3, before, code),
          actual: null,
          deviation: gap,
          message: `${code} has no value for ${gap === 1 ? `${before + 1}` : `${before + 1}–${after - 1}`}, but is reported in ${before} and again in ${after}.`,
        })
      }
    }
  }
  return out
}

/* --- consistency --------------------------------------------------------- */

/**
 * UC053's *"inconsistency between categories"*, as a break in the category mix.
 *
 * The obvious reading — sum the children and compare with the parent — is
 * identically zero on this corpus and would be theatre: CLAUDE.md's rule is that
 * **aggregates are never generated**, so every parent here *is* the sum of its
 * children by construction and the difference can only ever be 0. What is
 * genuinely checkable, and what an HA reviewer actually looks for, is whether
 * one category's share of its parent has broken away from the share that
 * country has held over the period. A category that has been a third of its
 * parent for twenty years and is suddenly a fifth means the categories no
 * longer reconcile the way they did, whichever side moved.
 *
 * The comparison is against the **median** share rather than the mean, so the
 * offending year cannot drag the baseline toward itself.
 */
const evaluateCategoryConsistency: Evaluator = ({
  rule,
  data,
  countries,
  years,
  pair,
  spend,
}) => {
  const out: FindingDraft[] = []
  for (const parent of rule.variables) {
    const children = data.childrenOf(parent)
    if (children.length === 0) continue

    for (const iso3 of countries) {
      for (const child of children) {
        const shares: { year: number; share: number }[] = []
        for (const year of years) {
          if (!spend(2)) return out
          const parentValue = data.valueOf(iso3, year, parent)
          const childValue = data.valueOf(iso3, year, child)
          if (parentValue == null || childValue == null || parentValue === 0) continue
          shares.push({ year, share: (childValue / parentValue) * 100 })
        }
        // Fewer than five observed years is not a baseline, it is a coincidence.
        if (shares.length < 5) continue

        const baseline = median(shares.map((s) => s.share))
        if (baseline == null || baseline === 0) continue

        for (const { year, share } of shares) {
          const measure = ((share - baseline) / baseline) * 100
          const deviation = deviationFor(measure, rule.comparison)
          const severity = severityFor(deviation, pair)
          if (!severity) continue

          out.push({
            iso3,
            year,
            code: child,
            severity,
            expected: baseline,
            actual: share,
            deviation,
            message: `${child} is ${fmt(share)}% of ${parent} in ${year}, against a ${fmt(baseline)}% median across the period — a ${signed(measure)}% break in the category mix.`,
          })
        }
      }
    }
  }
  return out
}

/**
 * UC053's *"inconsistency between tables"*.
 *
 * Each ICHA classification is a different partition of the *same* spending —
 * HF by scheme, HC by function, FS by revenue source — so their totals must
 * reconcile. Expressed as two arbitrary sets of codes rather than two dimension
 * totals, because the same comparison covers the other reconciliation an HA
 * reviewer makes: a macro series against the revenues that are supposed to add
 * up to it.
 */
const evaluateTableConsistency: Evaluator = ({ rule, data, countries, years, pair, spend }) => {
  const out: FindingDraft[] = []
  const anchor = rule.leftCodes[0]
  if (!anchor || rule.rightCodes.length === 0) return out

  const leftLabel = rule.leftCodes.join(' + ')
  const rightLabel = rule.rightCodes.join(' + ')

  for (const iso3 of countries) {
    for (const year of years) {
      if (!spend(rule.leftCodes.length + rule.rightCodes.length)) return out

      let left = 0
      let leftSeen = 0
      for (const code of rule.leftCodes) {
        const v = data.valueOf(iso3, year, code)
        if (v != null) {
          left += v
          leftSeen++
        }
      }
      let right = 0
      let rightSeen = 0
      for (const code of rule.rightCodes) {
        const v = data.valueOf(iso3, year, code)
        if (v != null) {
          right += v
          rightSeen++
        }
      }
      // Both sides must be fully present. A partial side would produce a
      // reconciliation error that is really a reporting gap, and the continuity
      // rules are the ones that should say so.
      if (leftSeen !== rule.leftCodes.length || rightSeen !== rule.rightCodes.length) continue
      if (right === 0) continue

      const measure = ((left - right) / Math.abs(right)) * 100
      const deviation = deviationFor(measure, rule.comparison)
      const severity = severityFor(deviation, pair)
      if (!severity) continue

      out.push({
        iso3,
        year,
        code: anchor,
        severity,
        expected: right,
        actual: left,
        deviation,
        message: `${leftLabel} (${fmt(left, 0)}) and ${rightLabel} (${fmt(right, 0)}) disagree by ${signed(measure)}% in ${year} — the same spending partitioned two ways should reconcile.`,
      })
    }
  }
  return out
}

/* --- plausibility -------------------------------------------------------- */

/**
 * UC053's *"atypical entries"*, which the FR is explicit may raise **either** an
 * error or a warning. The deviation is therefore a two-point score rather than a
 * magnitude, and the threshold pair is what moves the line between the two: at
 * the delivered 1/2 a negative value fails and a zero warns, and an
 * administrator who sets both to 1 makes zeros fail as well.
 */
const evaluateAtypical: Evaluator = ({ rule, data, countries, years, pair, spend }) => {
  const out: FindingDraft[] = []
  for (const iso3 of countries) {
    for (const code of rule.variables) {
      for (const year of years) {
        if (!spend(1)) return out
        const value = data.valueOf(iso3, year, code)
        if (value == null) continue

        let score = 0
        let message = ''
        if (value < 0) {
          score = 2
          message = `${code} is negative in ${year} (${fmt(value)}). Health expenditure cannot be negative.`
        } else if (value === 0) {
          // A zero is only atypical where the country reports the surrounding
          // total: a genuine "this country spends nothing here" is a blank.
          if (!spend(1)) return out
          const che = data.cheOf(iso3, year)
          if (che == null || che <= 0) continue
          score = 1
          message = `${code} is reported as exactly zero in ${year} while total health expenditure is ${fmt(che, 0)}. A category with no spending is normally left blank.`
        } else {
          continue
        }

        const severity = severityFor(score, pair)
        if (!severity) continue

        out.push({
          iso3,
          year,
          code,
          severity,
          expected: null,
          actual: value,
          deviation: score,
          message,
        })
      }
    }
  }
  return out
}

/**
 * UC053's *"outliers across country groups"*.
 *
 * Countries are compared inside a peer group taken from a groupable country
 * attribute (UC022) — WHO region, World Bank income group, OECD membership.
 * Raw expenditure would only ever report that large economies are large, so the
 * default normalisation is the variable's share of that country's own current
 * health expenditure, which is the form in which two countries are comparable
 * at all.
 *
 * A group needs at least five members before it is judged. Below that, "far
 * from the median" is a statement about the group's size rather than about the
 * country, and a rule that fires on a group of two would be read once and then
 * ignored forever.
 */
const MIN_GROUP_SIZE = 5

const evaluateGroupOutlier: Evaluator = ({ rule, data, countries, years, pair, spend }) => {
  const out: FindingDraft[] = []
  const attribute = rule.groupBy
  if (!attribute) return out

  for (const code of rule.variables) {
    for (const year of years) {
      // Group members and their normalised values, in one pass over the scope.
      const byGroup = new Map<string, { iso3: string; value: number; raw: number }[]>()

      for (const iso3 of countries) {
        if (!spend(2)) return out
        const raw = data.valueOf(iso3, year, code)
        if (raw == null) continue

        let value = raw
        if (rule.normalise !== 'raw') {
          const che = data.cheOf(iso3, year)
          if (che == null || che <= 0) continue
          const share = (raw / che) * 100

          if (rule.normalise === 'share-of-che-change') {
            if (!spend(2)) return out
            const priorRaw = data.valueOf(iso3, year - 1, code)
            const priorChe = data.cheOf(iso3, year - 1)
            if (priorRaw == null || priorChe == null || priorChe <= 0) continue
            // Percentage *points* of movement, not percent of the share: a
            // share going 4% → 8% and one going 40% → 44% are the same 4-point
            // move, and only the first is a doubling. Points are what a peer
            // group's spread is meaningfully measured in.
            value = share - (priorRaw / priorChe) * 100
          } else {
            value = share
          }
        }
        if (!Number.isFinite(value)) continue

        const group = data.attributeOf(iso3, attribute)
        const list = byGroup.get(group)
        if (list) list.push({ iso3, value, raw })
        else byGroup.set(group, [{ iso3, value, raw }])
      }

      for (const [group, members] of byGroup) {
        if (members.length < MIN_GROUP_SIZE) continue
        const values = members.map((m) => m.value)
        const centre = median(values)
        const sigma = robustSigma(values)
        if (centre == null || sigma == null || sigma === 0) continue

        for (const member of members) {
          const measure = (member.value - centre) / sigma
          const deviation = deviationFor(measure, rule.comparison)
          const severity = severityFor(deviation, pair)
          if (!severity) continue

          out.push({
            iso3: member.iso3,
            year,
            code,
            severity,
            expected: centre,
            actual: member.value,
            deviation,
            message:
              rule.normalise === 'share-of-che-change'
                ? `${code} moved ${signed(member.value)} percentage points of health expenditure in ${year}, while the ${group} median moved ${fmt(centre)} across ${members.length} countries — ${fmt(deviation)} robust deviations away.`
                : `${code} is ${fmt(member.value)} ${rule.normalise === 'share-of-che' ? '% of CHE' : 'NCU millions'} in ${year}, against a ${fmt(centre)} median for ${group} (${members.length} countries) — ${fmt(deviation)} robust deviations away.`,
          })
        }
      }
    }
  }
  return out
}

const EVALUATORS: Record<QcRule['type'], Evaluator> = {
  'yoy-absolute': evaluateYoy('absolute'),
  'yoy-relative': evaluateYoy('relative'),
  'version-growth': evaluateVersionGrowth,
  'new-observation': evaluateNewObservation,
  'disappeared-observation': evaluateDisappeared,
  'missing-observation': evaluateMissing,
  'category-consistency': evaluateCategoryConsistency,
  'table-consistency': evaluateTableConsistency,
  'atypical-entry': evaluateAtypical,
  'group-outlier': evaluateGroupOutlier,
}

/* ==========================================================================
   THE RUN
   ========================================================================== */

/**
 * Run a set of rules over a scope.
 *
 * Findings come back sorted most-serious first and then by country, year and
 * rule, because that is the order the report table shows and sorting once here
 * keeps every consumer — the table, the .xlsx, the workbook's inline panel —
 * showing the same thing in the same sequence.
 */
export function runQc(request: QcRunRequest): QcRunResult {
  const { rules, scope, thresholds, data, maxChecks = DEFAULT_MAX_CHECKS } = request

  let spent = 0
  const findings: QcFinding[] = []
  const ruleStats: QcRuleStat[] = []

  for (const rule of rules) {
    if (!rule.isEnabled) continue

    // UC048 — excluded countries never reach the evaluator, so an exclusion is
    // an absence of checks rather than findings quietly filtered afterwards.
    const excluded = new Set(rule.excludedCountries)
    const countries = scope.countries.filter((iso3) => !excluded.has(iso3))
    const years = yearsFor(rule, scope)
    const pair = thresholdsFor(rule, thresholds)

    const before = spent
    let truncated = false
    const spend = (n: number) => {
      spent += n
      if (spent > maxChecks) {
        truncated = true
        return false
      }
      return true
    }

    const drafts =
      countries.length === 0 || years.length === 0
        ? []
        : EVALUATORS[rule.type]({ rule, data, countries, years, pair, spend })

    let errors = 0
    let warnings = 0
    for (const draft of drafts) {
      if (draft.severity === 'error') errors++
      else warnings++
      findings.push(buildFinding(rule, data, draft))
    }

    ruleStats.push({
      ruleId: rule.id,
      ruleName: rule.name,
      ruleType: rule.type,
      ruleOrigin: rule.origin,
      checked: spent - before,
      errors,
      warnings,
      excluded: scope.countries.length - countries.length,
      truncated,
    })
  }

  findings.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
    if (a.iso3 !== b.iso3) return a.iso3.localeCompare(b.iso3)
    if (a.year !== b.year) return b.year - a.year
    return a.ruleName.localeCompare(b.ruleName)
  })

  const errors = findings.filter((f) => f.severity === 'error').length

  return {
    summary: {
      id: request.runId,
      runUtc: request.runUtc,
      runBy: request.runBy,
      scope,
      ruleIds: rules.filter((r) => r.isEnabled).map((r) => r.id),
      observationsChecked: spent,
      errors,
      warnings: findings.length - errors,
      countriesWithFindings: new Set(findings.map((f) => f.iso3)).size,
    },
    findings,
    ruleStats,
  }
}

/** Findings keyed by observation key — what UC052 rings in the grid. */
export function findingsByObservation(
  findings: readonly QcFinding[],
): Map<string, QcFinding> {
  const out = new Map<string, QcFinding>()
  for (const f of findings) {
    const existing = out.get(f.observationKey)
    // An error outranks a warning on the same cell: one ring, the worse verdict.
    if (!existing || (existing.severity === 'warning' && f.severity === 'error')) {
      out.set(f.observationKey, f)
    }
  }
  return out
}
