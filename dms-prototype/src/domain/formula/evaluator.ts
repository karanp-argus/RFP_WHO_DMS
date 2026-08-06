/**
 * AST evaluator.
 *
 * Takes a parsed expression and a **resolver closure** `(code, year) => value`,
 * which is the whole reason `domain/` can stay free of data access: the engine
 * never knows whether a value came from the seeded hash, from xMart, or from an
 * unsaved workbook edit.
 *
 * Three behaviours are load-bearing and are the reason this is a hand-written
 * evaluator rather than `eval` over a substituted string:
 *
 *  1. **Nulls are a first-class value, not a zero.** How a missing input
 *     behaves is decided by the formula's `NullPolicy` (see `nullPolicy.ts`),
 *     and a failed guard yields blank.
 *  2. **Every read is recorded.** The Setup inspector lists exactly which
 *     variable, at which year, produced which number — the evidence behind a
 *     computed indicator, which is what makes the engine demonstrable.
 *  3. **Division by zero is blank, not Infinity.** `DOM%CHE` for a country with
 *     no CHE is unknown, and `Infinity` would reach an export.
 */

import { applyValueFunction, SERIES_FUNCTIONS } from './functions'
import { coerceMissing, guardPasses, missingInputs, type InputRead } from './nullPolicy'
import {
  buildSeries,
  extrapolateAt,
  growthPercent,
  interpolateAt,
  type ExtrapolationDirection,
  type ExtrapolationMethod,
} from './series'
import { FormulaError } from './errors'
import type { AstNode, CallNode, RefNode } from './ast'
import type { NullPolicy } from '../types'

export interface EvaluationContext {
  /** The year the expression is evaluated at. `[year-1]` shifts from here. */
  year: number
  /** Years the series functions may read. Usually the full reporting span. */
  years: readonly number[]
  /** Value of a code at a year, or null when there is none. */
  resolve: (code: string, year: number) => number | null
  /** How a code's value was obtained. Cosmetic — drives the inspector only. */
  originOf?: (code: string) => InputRead['origin']
  policy: NullPolicy
}

export interface EvaluationTrace {
  value: number | null
  guard: 'passed' | 'failed' | 'not-applicable'
  /** Every value read, in the order the expression read it. */
  reads: InputRead[]
  /** The reads responsible for a failed guard. */
  missing: InputRead[]
}

/** Blank out anything that is not a real, finite number. */
function finite(value: number | null): number | null {
  return value != null && Number.isFinite(value) ? value : null
}

export function evaluateAst(node: AstNode, ctx: EvaluationContext): EvaluationTrace {
  const reads: InputRead[] = []
  const originOf = ctx.originOf ?? (() => 'reported' as const)

  /** Read one code at one year, recording it, and apply the policy coercion. */
  function read(code: string, year: number, origin?: InputRead['origin']): number | null {
    const raw = finite(ctx.resolve(code, year))
    reads.push({ code, year, value: raw, origin: origin ?? originOf(code) })
    return coerceMissing(ctx.policy, raw)
  }

  function walk(n: AstNode): number | null {
    switch (n.kind) {
      case 'number':
        return n.value

      case 'text':
        throw new FormulaError(
          'syntax',
          `"${n.value}" is a text option and can only be passed to a function such as EXTRAPOLATE.`,
        )

      case 'ref':
        return read(n.code, ctx.year + n.yearOffset)

      case 'unary': {
        const v = walk(n.operand)
        if (v == null) return null
        return n.op === '-' ? -v : v
      }

      case 'binary': {
        const a = walk(n.left)
        const b = walk(n.right)
        if (a == null || b == null) return null
        switch (n.op) {
          case '+':
            return finite(a + b)
          case '-':
            return finite(a - b)
          case '*':
            return finite(a * b)
          case '/':
            // Blank, not Infinity — this reaches exports.
            return b === 0 ? null : finite(a / b)
        }
        return null
      }

      case 'compare': {
        const a = walk(n.left)
        const b = walk(n.right)
        // An unknown quantity compares neither true nor false.
        if (a == null || b == null) return null
        switch (n.op) {
          case '=':
            return a === b ? 1 : 0
          case '<>':
            return a !== b ? 1 : 0
          case '<':
            return a < b ? 1 : 0
          case '<=':
            return a <= b ? 1 : 0
          case '>':
            return a > b ? 1 : 0
          case '>=':
            return a >= b ? 1 : 0
        }
        return null
      }

      case 'call':
        return SERIES_FUNCTIONS.has(n.name) ? callSeriesFunction(n) : applyValueFunction(n.name, n.args.map(walk))
    }
  }

  /* --- PREV / GROWTH / INTERPOLATE / EXTRAPOLATE -------------------------
     These read the series behind a reference rather than its value, so they
     bypass `walk` for their first argument. The parser has already guaranteed
     it is a bare ref. */
  function callSeriesFunction(n: CallNode): number | null {
    const ref = n.args[0] as RefNode
    const atYear = ctx.year + ref.yearOffset

    switch (n.name) {
      case 'PREV': {
        const back = offsetArgument(n, 1)
        return read(ref.code, atYear - back, 'series')
      }

      case 'GROWTH': {
        const back = offsetArgument(n, 1)
        // Growth is a ratio of two raw readings: coercing a missing base to
        // zero would divide by zero anyway, so the raw values are recorded and
        // used directly.
        const currentRaw = finite(ctx.resolve(ref.code, atYear))
        const previousRaw = finite(ctx.resolve(ref.code, atYear - back))
        reads.push({ code: ref.code, year: atYear, value: currentRaw, origin: 'series' })
        reads.push({ code: ref.code, year: atYear - back, value: previousRaw, origin: 'series' })
        return growthPercent(currentRaw, previousRaw)
      }

      case 'INTERPOLATE':
      case 'EXTRAPOLATE': {
        const series = buildSeries(ctx.years, (y) => ctx.resolve(ref.code, y))
        const filled =
          n.name === 'INTERPOLATE'
            ? interpolateAt(series, atYear)
            : extrapolateAt(
                series,
                atYear,
                textArgument(n, 1, ['auto', 'backward', 'forward']) as ExtrapolationDirection,
                textArgument(n, 2, ['linear', 'cagr']) as ExtrapolationMethod,
              )
        // The filled value is what the guard sees. Recording the underlying
        // hole instead would blank out the very formula written to close it.
        reads.push({ code: ref.code, year: atYear, value: finite(filled), origin: 'series' })
        return coerceMissing(ctx.policy, finite(filled))
      }

      default:
        throw new FormulaError('unknown-function', `${n.name} is not a series function.`)
    }
  }

  /** The `n` in `PREV(ref, n)` — a whole number of years, defaulting to 1. */
  function offsetArgument(n: CallNode, index: number): number {
    const arg = n.args[index]
    if (arg == null) return 1
    const v = walk(arg)
    if (v == null || !Number.isFinite(v)) return 1
    return Math.max(1, Math.round(Math.abs(v)))
  }

  /** A quoted option such as `'backward'`, validated against the allowed set. */
  function textArgument(n: CallNode, index: number, allowed: readonly string[]): string {
    const arg = n.args[index]
    const fallback = allowed[0] ?? ''
    if (arg == null) return fallback
    if (arg.kind !== 'text') {
      throw new FormulaError(
        'syntax',
        `${n.name} expects one of ${allowed.map((a) => `'${a}'`).join(', ')} in position ${index + 1}.`,
        { position: n.position },
      )
    }
    const value = arg.value.toLowerCase()
    if (!allowed.includes(value)) {
      throw new FormulaError(
        'syntax',
        `${n.name} does not accept '${arg.value}'. Use ${allowed.map((a) => `'${a}'`).join(', ')}.`,
        { position: n.position },
      )
    }
    return value
  }

  const raw = walk(node)
  const passed = guardPasses(ctx.policy, reads)

  return {
    value: passed ? finite(raw) : null,
    guard: reads.length === 0 ? 'not-applicable' : passed ? 'passed' : 'failed',
    reads,
    missing: missingInputs(ctx.policy, reads),
  }
}
