/**
 * The ten functions of plan §3.3 — SUM AVG MIN MAX ABS IF PREV GROWTH
 * INTERPOLATE EXTRAPOLATE.
 *
 * Split in two, because they are not the same kind of thing:
 *
 *  · **Value functions** (SUM, AVG, MIN, MAX, ABS, IF) take values and are
 *    implemented here. They skip nulls rather than treating them as zero, and
 *    return null when there is nothing left to work with — `AVG` of nothing is
 *    blank, not 0, which is the same distinction the null policy enforces one
 *    level up.
 *
 *  · **Reference functions** (PREV, GROWTH, INTERPOLATE, EXTRAPOLATE) need the
 *    *series* behind a reference, not its value, so the evaluator handles them
 *    with the resolver in hand and calls into `series.ts`. Their arity and
 *    first-argument constraint are declared here so the parser can reject
 *    `PREV(HF.1 + HF.2)` at parse time.
 */

import type { FunctionName } from './ast'
import { FormulaError } from './errors'

export interface FunctionArity {
  min: number
  max: number
  /** True when argument 0 must be a bare reference (the series functions). */
  firstArgIsRef: boolean
}

export const FUNCTION_ARITY: Record<FunctionName, FunctionArity> = {
  SUM: { min: 1, max: Infinity, firstArgIsRef: false },
  AVG: { min: 1, max: Infinity, firstArgIsRef: false },
  MIN: { min: 1, max: Infinity, firstArgIsRef: false },
  MAX: { min: 1, max: Infinity, firstArgIsRef: false },
  ABS: { min: 1, max: 1, firstArgIsRef: false },
  IF: { min: 3, max: 3, firstArgIsRef: false },
  PREV: { min: 1, max: 2, firstArgIsRef: true },
  GROWTH: { min: 1, max: 2, firstArgIsRef: true },
  INTERPOLATE: { min: 1, max: 1, firstArgIsRef: true },
  EXTRAPOLATE: { min: 1, max: 3, firstArgIsRef: true },
}

/** The four that read a series rather than a value. */
export const SERIES_FUNCTIONS: ReadonlySet<FunctionName> = new Set<FunctionName>([
  'PREV',
  'GROWTH',
  'INTERPOLATE',
  'EXTRAPOLATE',
])

/** One-line descriptions, surfaced in the formula editor's function help. */
export const FUNCTION_HELP: Record<FunctionName, string> = {
  SUM: 'SUM(a, b, …) — total of the arguments that have values.',
  AVG: 'AVG(a, b, …) — mean of the arguments that have values.',
  MIN: 'MIN(a, b, …) — smallest argument that has a value.',
  MAX: 'MAX(a, b, …) — largest argument that has a value.',
  ABS: 'ABS(x) — magnitude of x, sign discarded.',
  IF: 'IF(condition, then, otherwise) — condition uses =, <>, <, <=, > or >=.',
  PREV: 'PREV(ref, n = 1) — the value of ref n years earlier.',
  GROWTH: 'GROWTH(ref, n = 1) — percentage change over n years.',
  INTERPOLATE: 'INTERPOLATE(ref) — fills a gap by straight line between the nearest reported years.',
  EXTRAPOLATE:
    "EXTRAPOLATE(ref, 'auto' | 'backward' | 'forward', 'linear' | 'cagr') — projects beyond the reported range.",
}

/* --------------------------------------------------------------------------
   Value functions
   -------------------------------------------------------------------------- */

function present(values: readonly (number | null)[]): number[] {
  return values.filter((v): v is number => v != null && Number.isFinite(v))
}

export function fnSum(values: readonly (number | null)[]): number | null {
  const xs = present(values)
  if (xs.length === 0) return null
  return xs.reduce((a, b) => a + b, 0)
}

export function fnAvg(values: readonly (number | null)[]): number | null {
  const xs = present(values)
  if (xs.length === 0) return null
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function fnMin(values: readonly (number | null)[]): number | null {
  const xs = present(values)
  return xs.length === 0 ? null : Math.min(...xs)
}

export function fnMax(values: readonly (number | null)[]): number | null {
  const xs = present(values)
  return xs.length === 0 ? null : Math.max(...xs)
}

export function fnAbs(value: number | null): number | null {
  return value == null ? null : Math.abs(value)
}

/**
 * `IF(condition, then, otherwise)`.
 *
 * A null condition is neither true nor false, so the result is blank — the same
 * rule as everywhere else in the engine: absent input, absent answer.
 */
export function fnIf(
  condition: number | null,
  whenTrue: number | null,
  whenFalse: number | null,
): number | null {
  if (condition == null) return null
  return condition !== 0 ? whenTrue : whenFalse
}

/**
 * Apply a value function by name. The evaluator routes SERIES_FUNCTIONS
 * elsewhere, so reaching this with one is a bug rather than user input.
 */
export function applyValueFunction(
  name: FunctionName,
  args: readonly (number | null)[],
): number | null {
  switch (name) {
    case 'SUM':
      return fnSum(args)
    case 'AVG':
      return fnAvg(args)
    case 'MIN':
      return fnMin(args)
    case 'MAX':
      return fnMax(args)
    case 'ABS':
      return fnAbs(args[0] ?? null)
    case 'IF':
      return fnIf(args[0] ?? null, args[1] ?? null, args[2] ?? null)
    default:
      throw new FormulaError(
        'unknown-function',
        `${name} reads a data series and cannot be applied to plain values.`,
      )
  }
}
