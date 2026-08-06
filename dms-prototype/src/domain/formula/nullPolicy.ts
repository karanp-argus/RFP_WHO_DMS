/**
 * Null-guard policies.
 *
 * Every one of the 16 seeded formulas carries a condition from the FR's own
 * table — "at least one component not null", "CHE and GDP not null" — and the
 * two behave differently. This file is that difference, isolated, because
 * getting it wrong is invisible on screen and obvious in an export.
 *
 * | Policy | Missing input | Guard fails when |
 * |---|---|---|
 * | `any-not-null` | treated as **0** | every input is missing |
 * | `all-not-null` | makes the result **blank** | any input is missing |
 *
 * **A failed guard yields blank, never 0.** `CHE%GDP` for a country that never
 * reported GDP is not "0% of GDP" — it is unknown, and an export that writes 0
 * there has stated something false about a Member State's health spending.
 *
 * The `any-not-null` substitution is what makes `CHE = HF.1 + … + HF.nec`
 * behave the way health accountants expect: a country that reports three of the
 * five financing schemes has a CHE equal to those three, not a blank.
 */

import type { NullPolicy } from '../types'

/** One value the evaluator read while walking an expression. */
export interface InputRead {
  code: string
  year: number
  value: number | null
  /** Where the value came from — shown in the formula inspector. */
  origin: 'reported' | 'aggregate' | 'formula' | 'series'
}

export const NULL_POLICY_LABELS: Record<NullPolicy, string> = {
  'any-not-null': 'ANY',
  'all-not-null': 'ALL',
}

export const NULL_POLICY_DESCRIPTIONS: Record<NullPolicy, string> = {
  'any-not-null':
    'Evaluates if at least one input has a value; missing inputs are treated as zero. Blank only when every input is missing.',
  'all-not-null':
    'Every input must have a value. If any is missing the result is blank, not zero.',
}

/**
 * What a missing input becomes during arithmetic.
 *
 * Under `all-not-null` a missing input stays null and propagates through every
 * operator, so the whole expression collapses to blank without needing a
 * separate pre-pass. Under `any-not-null` it becomes 0 and the "was anything
 * present at all?" question is answered afterwards from the recorded reads.
 */
export function coerceMissing(policy: NullPolicy, value: number | null): number | null {
  if (value != null) return value
  return policy === 'any-not-null' ? 0 : null
}

/**
 * Whether the guard passes for a set of reads.
 *
 * An expression with no references at all (a constant) passes trivially — there
 * is nothing that could be missing.
 */
export function guardPasses(policy: NullPolicy, reads: readonly InputRead[]): boolean {
  if (reads.length === 0) return true
  return policy === 'any-not-null'
    ? reads.some((r) => r.value != null)
    : reads.every((r) => r.value != null)
}

/** The inputs responsible for a failed guard — named in the inspector. */
export function missingInputs(policy: NullPolicy, reads: readonly InputRead[]): InputRead[] {
  if (guardPasses(policy, reads)) return []
  return policy === 'any-not-null' ? [...reads] : reads.filter((r) => r.value == null)
}
