/**
 * UC054 — *"As an administrator, I need to be able to configure the criteria to
 * consider the status of a quality check as pass, fail or warning."*
 *
 * The point of the use case is that these numbers are **not** hardcoded, so they
 * live in one table with one lookup function and every rule reads through it.
 * A rule may carry its own pair, which overrides the global one for that rule
 * only — an administrator who wants a tighter growth check on out-of-pocket
 * spending should not have to loosen it for everything else.
 *
 * `warnAt` and `failAt` are both floors on the same measure. Pass is the absence
 * of the other two, which is why there is no `passAt`: a third number could
 * contradict the first two and there would be no principled way to resolve it.
 */

import type { QcRuleType, QcSeverity, QcThresholdPair } from './ruleTypes'

export type QcThresholdSet = Record<QcRuleType, QcThresholdPair>

/**
 * The delivered defaults.
 *
 * Each is a judgement about health accounts data, not a round number picked to
 * look tidy, and the reasoning is recorded here because an administrator
 * changing one deserves to know what it was set against:
 *
 *  · **Year-on-year relative growth 40 / 80 %.** Health expenditure moves with
 *    GDP and inflation; a 40% jump in one year is unusual outside a currency
 *    redenomination, and 80% is almost always a scale or units error.
 *  · **Year-on-year absolute growth 5,000 / 25,000 NCU millions.** Deliberately
 *    country-size dependent, which is the point: the absolute rule is what a
 *    large-economy analyst wants and it is meaningless for a small one. UC048's
 *    country exclusions exist for exactly this, and this rule is the one that
 *    demonstrates why.
 *  · **Version growth 10 / 20 %.** A resubmission that moves a figure by a fifth
 *    is a different number, not a revision.
 *  · **Continuity 1 / 5 years.** One year of silence is worth a look; five years
 *    of established reporting stopping dead is a reporting failure.
 *  · **Category share break 30 / 60 %.** Spending mixes drift; they do not
 *    halve. Set from the measured spread over the seeded corpus rather than
 *    guessed — at 18/40 the rule reported a fifth of all country-years, which
 *    is a rule nobody reads twice.
 *  · **Table reconciliation 5 / 10 %.** Real submissions never reconcile exactly
 *    across classifications, and demanding they do would bury the real breaks.
 *  · **Atypical entry 1 / 2.** A score, not a magnitude: 1 is an exact zero
 *    against a positive parent, 2 is a negative value. UC053 explicitly wants
 *    this category to be able to raise *either* an error or a warning, and this
 *    is the pair that lets an administrator move the line between them.
 *  · **Outlier 8 / 15 robust sigma.** Median-and-MAD rather than mean-and-
 *    standard-deviation, because a mean computed over a group that contains the
 *    outlier is dragged toward it and hides what it is being asked to find. The
 *    numbers look large for a sigma because the delivered outlier rules compare
 *    *year-on-year movement* in a share, and a peer group holds that movement
 *    to a fraction of a percentage point — so the spread the ratio is taken
 *    against is very small and ordinary noise already lands at two or three.
 *    Both figures are read off the measured distribution over the seeded
 *    corpus; an administrator retuning them for real data should expect to.
 */
export const DEFAULT_THRESHOLDS: QcThresholdSet = {
  'yoy-absolute': { warnAt: 5_000, failAt: 25_000 },
  'yoy-relative': { warnAt: 40, failAt: 80 },
  'version-growth': { warnAt: 10, failAt: 20 },
  'new-observation': { warnAt: 1, failAt: 5 },
  'disappeared-observation': { warnAt: 1, failAt: 5 },
  'missing-observation': { warnAt: 1, failAt: 3 },
  'category-consistency': { warnAt: 30, failAt: 60 },
  'table-consistency': { warnAt: 5, failAt: 10 },
  'atypical-entry': { warnAt: 1, failAt: 2 },
  'group-outlier': { warnAt: 8, failAt: 15 },
}

/** The global set with any administrator overrides applied. */
export function effectiveThresholds(
  overrides: Partial<Record<QcRuleType, QcThresholdPair>> = {},
): QcThresholdSet {
  const out = { ...DEFAULT_THRESHOLDS }
  for (const [type, pair] of Object.entries(overrides)) {
    if (pair) out[type as QcRuleType] = pair
  }
  return out
}

/**
 * The pair one rule is judged against: its own if it carries one, else the
 * global set's entry for its type.
 */
export function thresholdsFor(
  rule: { type: QcRuleType; thresholds: QcThresholdPair | null },
  set: QcThresholdSet,
): QcThresholdPair {
  return rule.thresholds ?? set[rule.type]
}

/**
 * Pass / warning / fail for one measured deviation.
 *
 * `null` is a pass. The order matters — `failAt` is tested first — because an
 * administrator is free to configure `warnAt` above `failAt`, and when they do,
 * the more severe verdict should win rather than the one that happens to be
 * checked first.
 */
export function severityFor(deviation: number, pair: QcThresholdPair): QcSeverity | null {
  if (!Number.isFinite(deviation)) return null
  if (deviation >= pair.failAt) return 'error'
  if (deviation >= pair.warnAt) return 'warning'
  return null
}
