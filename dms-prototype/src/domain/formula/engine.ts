/**
 * The engine — the piece the rest of the application talks to.
 *
 * It ties the tokeniser, parser, dependency graph, null policies and evaluator
 * together behind three methods: `evaluate`, `validate` and `astFor`. Nothing
 * above this file needs to know a parser exists.
 *
 * **Resolution order for a code at (country, year).** This is the part that
 * makes the seeded corpus work, and it is worth stating plainly because two of
 * the three levels are invisible in the FR:
 *
 *  1. **A formula**, if one is defined for the code — with the country's UC029
 *     override substituted when there is one.
 *  2. **An aggregate variable**, if the code is a parent or a total. Per
 *     CLAUDE.md aggregates are never generated: `HF.1` is the sum of `HF.1.1`,
 *     `HF.1.2` and `HF.1.3`, computed here, which is exactly what makes the
 *     engine visible in the demo rather than a claim on a slide.
 *  3. **A cell formula**, if the user typed one into that reported cell
 *     (UC031). It replaces the cell's reported value and is re-evaluated like
 *     any other formula, so it follows its inputs instead of freezing the
 *     number it had when it was typed.
 *  4. **A reported value**, from the resolver the caller supplied.
 *
 * A formula whose expression names its own code — the FR lists `GGHE-D` that
 * way, because it is sourced rather than derived — resolves at level 2 or 3 on
 * the inner reference. That is an identity, not a cycle; see `dependencies.ts`.
 */

import { referencedCodes, type AstNode } from './ast'
import {
  buildDependencyGraph,
  cyclesInvolving,
  evaluationChain,
  transitiveDependents,
  type DependencyGraph,
} from './dependencies'
import { cycleError, FormulaError } from './errors'
import { evaluateAst, type EvaluationContext, type EvaluationTrace } from './evaluator'
import { fnSum } from './functions'
import type { InputRead } from './nullPolicy'
import { parseExpression, tryParseExpression } from './parser'
import type { NullPolicy } from '../types'

/** The minimum a formula must offer the engine. `Formula` from `types.ts` fits. */
export interface EngineFormula {
  code: string
  expression: string
  nullPolicy: NullPolicy
  /** UC029 — ISO3 → an expression that replaces the standard one. */
  countryOverrides?: Record<string, string>
  /** Legacy old-DMS formulas (UC060) are reference text and are never parsed. */
  isLegacy?: boolean
}

export interface EngineOptions {
  formulas: readonly EngineFormula[]
  /**
   * Aggregate variable → its child codes. Parents and totals are summed from
   * reported leaves rather than stored.
   */
  aggregates?: ReadonlyMap<string, readonly string[]>
  /** Codes that can carry a reported value. Used for identity self-references. */
  baseVariables?: Iterable<string>
  /** Years the series functions may read. */
  years: readonly number[]
  /** Reported value lookup — the engine's only door to data. */
  resolveReported: (iso3: string, year: number, code: string) => number | null
  /**
   * UC031 — the expression (without its `=`) a user typed into the reported
   * cell at (country, year, code), or null when the cell holds a plain value.
   */
  cellFormulaFor?: (iso3: string, year: number, code: string) => string | null
}

/** The reported cell a typed formula sits in. */
export interface CellAddress {
  iso3: string
  year: number
  code: string
}

export type ValueSource = 'formula' | 'aggregate' | 'reported' | 'unknown'

export interface EvaluationResult {
  code: string
  iso3: string
  year: number
  value: number | null
  /** True when there is deliberately no value — a failed guard or no data. */
  blank: boolean
  source: ValueSource
  /** The expression actually used, override included. Null for non-formulas. */
  expression: string | null
  usesCountryOverride: boolean
  ast: AstNode | null
  guard: EvaluationTrace['guard']
  policy: NullPolicy | null
  reads: readonly InputRead[]
  missing: readonly InputRead[]
  /** Formulas evaluated to reach this one, in dependency order, this one last. */
  chain: readonly string[]
  error: FormulaError | null
}

export interface ValidationResult {
  ok: boolean
  ast: AstNode | null
  error: FormulaError | null
  /** Referenced codes matching no known variable or formula. */
  unknownCodes: readonly string[]
  /** The cycle this expression would create, if any. */
  cycle: readonly string[] | null
}

export interface FormulaEngine {
  /** Every code the tokeniser will match greedily — variables and formulas. */
  readonly knownCodes: ReadonlySet<string>
  readonly graph: DependencyGraph
  /** Topological order of the formula set: dependencies first. */
  readonly order: readonly string[]
  /** Cycles found across the whole set. Empty when the set is sound. */
  readonly cycles: readonly (readonly string[])[]
  astFor(code: string, iso3?: string): AstNode | null
  expressionFor(code: string, iso3?: string): string | null
  parse(expression: string): AstNode
  /**
   * `code` checks the expression as that code's formula; `cell` checks it as a
   * formula typed into that reported cell, including loops that run through an
   * aggregate (`HF.1.2.1 = HF.1`, where `HF.1` sums `HF.1.2.1`).
   */
  validate(expression: string, options?: { code?: string; cell?: CellAddress }): ValidationResult
  evaluate(code: string, iso3: string, year: number): EvaluationResult
  /** Just the number — `evaluate(...).value` without the trace. */
  valueOf(code: string, iso3: string, year: number): number | null
  /** Codes to recompute after `code` changes (Phase 4's grid refresh). */
  dependentsOf(code: string): readonly string[]
  /** Drop the memo — call after an edit changes reported data. */
  invalidate(): void
}

export function createFormulaEngine(options: EngineOptions): FormulaEngine {
  const { years, resolveReported } = options
  const aggregates = options.aggregates ?? new Map<string, readonly string[]>()
  const baseVariables = new Set(options.baseVariables ?? [])

  const formulaByCode = new Map<string, EngineFormula>()
  for (const f of options.formulas) {
    if (f.isLegacy) continue
    formulaByCode.set(f.code, f)
  }

  /**
   * The greedy-match set: every code the tokeniser may recognise. Built once,
   * from formulas, aggregates and base variables together, because a formula
   * expression legitimately references all three kinds.
   */
  const knownCodes = new Set<string>([
    ...formulaByCode.keys(),
    ...aggregates.keys(),
    ...baseVariables,
  ])

  /* --- parsing, cached ---------------------------------------------------- */

  const astCache = new Map<string, AstNode | FormulaError>()

  function parse(expression: string): AstNode {
    return parseExpression(expression, { knownCodes })
  }

  function parseCached(expression: string): AstNode | FormulaError {
    const hit = astCache.get(expression)
    if (hit) return hit
    let result: AstNode | FormulaError
    try {
      result = parse(expression)
    } catch (e) {
      result = e instanceof FormulaError ? e : new FormulaError('syntax', String(e))
    }
    astCache.set(expression, result)
    return result
  }

  function expressionFor(code: string, iso3?: string): string | null {
    const f = formulaByCode.get(code)
    if (!f) return null
    const override = iso3 ? f.countryOverrides?.[iso3] : undefined
    return override ?? f.expression
  }

  function astFor(code: string, iso3?: string): AstNode | null {
    const expression = expressionFor(code, iso3)
    if (expression == null) return null
    const parsed = parseCached(expression)
    return parsed instanceof FormulaError ? null : parsed
  }

  /* --- the dependency graph over the standard (non-override) set ---------- */

  const asts = new Map<string, AstNode>()
  for (const [code, f] of formulaByCode) {
    const parsed = parseCached(f.expression)
    if (!(parsed instanceof FormulaError)) asts.set(code, parsed)
  }

  const graph = buildDependencyGraph(asts, {
    isBaseVariable: (code) => baseVariables.has(code) || aggregates.has(code),
  })

  /* --- resolution --------------------------------------------------------- */

  let memo = new Map<string, number | null>()

  /*
   * Cell formulas can loop through aggregates and through each other, which the
   * static graph cannot see: aggregates are leaves there, and cell formulas are
   * data rather than definitions. So they are checked while resolving. `trail`
   * is the path being resolved, `activeCells` the cell formulas currently open,
   * and `detectedCycle` survives a formula swallowing the error on its way up.
   */
  const trail: string[] = []
  const trailKeys: string[] = []
  const activeCells = new Set<string>()
  let detectedCycle: readonly string[] | null = null
  let trialCell: { key: string; expression: string } | null = null

  function cellFormulaAt(iso3: string, year: number, code: string): string | null {
    const key = `${iso3}|${year}|${code}`
    if (trialCell?.key === key) return trialCell.expression
    return options.cellFormulaFor?.(iso3, year, code) ?? null
  }

  function resolveCellFormula(
    expression: string,
    key: string,
    iso3: string,
    year: number,
    stack: readonly string[],
  ): number | null {
    if (activeCells.has(key)) {
      const path = [...trail.slice(trailKeys.indexOf(key))]
      detectedCycle = path
      throw cycleError(path)
    }
    const parsed = parseCached(expression)
    if (parsed instanceof FormulaError) return null

    activeCells.add(key)
    try {
      // `all-not-null`: a user who typed `=HF.1+HF.2` and is missing HF.2
      // should see blank, not a half-total presented as the whole.
      return evaluateAst(parsed, {
        year,
        years,
        policy: 'all-not-null',
        resolve: (c, y) => resolveCode(c, iso3, y, stack),
      }).value
    } catch (e) {
      // A loop already stored (entered before this check existed, or loaded
      // from elsewhere) blanks this cell only. Letting it propagate would blank
      // every parent and indicator above it too. `detectedCycle` still records
      // it, which is how `validate` sees it.
      if (e instanceof FormulaError && e.kind === 'cycle') return null
      throw e
    } finally {
      activeCells.delete(key)
    }
  }

  function sourceOf(code: string, resolvingAsFormula: boolean): ValueSource {
    if (formulaByCode.has(code) && !resolvingAsFormula) return 'formula'
    if ((aggregates.get(code)?.length ?? 0) > 0) return 'aggregate'
    if (baseVariables.has(code)) return 'reported'
    return 'unknown'
  }

  /**
   * Resolve one code, walking down through formulas and aggregates.
   *
   * `stack` holds the formula codes currently being evaluated. It is both the
   * cycle backstop — a cycle throws instead of recursing forever, even if the
   * static graph somehow missed it — and the mechanism that lets a formula
   * reference its own code as an identity onto the underlying variable.
   */
  function resolveCode(code: string, iso3: string, year: number, stack: readonly string[]): number | null {
    const memoKey = `${iso3}|${year}|${code}`
    const cached = memo.get(memoKey)
    if (cached !== undefined) return cached

    trail.push(code)
    trailKeys.push(memoKey)
    try {
      return resolveUncached(code, iso3, year, stack, memoKey)
    } finally {
      trail.pop()
      trailKeys.pop()
    }
  }

  function resolveUncached(
    code: string,
    iso3: string,
    year: number,
    stack: readonly string[],
    memoKey: string,
  ): number | null {
    const selfReferencing = stack.includes(code)
    const formula = formulaByCode.get(code)

    if (formula && !selfReferencing) {
      const trace = evaluateFormula(formula, iso3, year, stack)
      // A value computed from inside a loop is only valid inside it. Cached, it
      // would blank every later reader of this formula, depending on which cell
      // happened to render first.
      if (trace.error?.kind !== 'cycle') memo.set(memoKey, trace.value)
      return trace.value
    }

    if (formula && selfReferencing && !baseVariables.has(code) && !aggregates.has(code)) {
      // Self-reference onto something with no data behind it is a real cycle.
      const from = stack.indexOf(code)
      throw cycleError([...stack.slice(from < 0 ? 0 : from), code])
    }

    const children = aggregates.get(code)
    if (children && children.length > 0) {
      const parts = children.map((child) => resolveCode(child, iso3, year, stack))
      // Aggregates behave as `any-not-null`: a country reporting three of five
      // financing schemes has a total equal to those three, not a blank.
      const total = fnSum(parts)
      if (!selfReferencing) memo.set(memoKey, total)
      return total
    }

    const cellExpression = cellFormulaAt(iso3, year, code)
    if (cellExpression != null) {
      const value = resolveCellFormula(cellExpression, memoKey, iso3, year, stack)
      if (!selfReferencing) memo.set(memoKey, value)
      return value
    }

    const reported = resolveReported(iso3, year, code)
    if (!selfReferencing) memo.set(memoKey, reported)
    return reported
  }

  function evaluateFormula(
    formula: EngineFormula,
    iso3: string,
    year: number,
    stack: readonly string[],
  ): EvaluationTrace & { ast: AstNode | null; expression: string; error: FormulaError | null } {
    const expression = expressionFor(formula.code, iso3) ?? formula.expression
    const parsed = parseCached(expression)

    if (parsed instanceof FormulaError) {
      return {
        value: null,
        guard: 'not-applicable',
        reads: [],
        missing: [],
        ast: null,
        expression,
        error: parsed,
      }
    }

    const nextStack = [...stack, formula.code]
    const ctx: EvaluationContext = {
      year,
      years,
      policy: formula.nullPolicy,
      resolve: (c, y) => resolveCode(c, iso3, y, nextStack),
      originOf: (c) => {
        if (formulaByCode.has(c) && c !== formula.code) return 'formula'
        if ((aggregates.get(c)?.length ?? 0) > 0) return 'aggregate'
        return 'reported'
      },
    }

    try {
      const trace = evaluateAst(parsed, ctx)
      return { ...trace, ast: parsed, expression, error: null }
    } catch (e) {
      if (e instanceof FormulaError) {
        return {
          value: null,
          guard: 'not-applicable',
          reads: [],
          missing: [],
          ast: parsed,
          expression,
          error: e,
        }
      }
      throw e
    }
  }

  /* --- public surface ----------------------------------------------------- */

  function evaluate(code: string, iso3: string, year: number): EvaluationResult {
    const formula = formulaByCode.get(code)

    if (formula) {
      const cycles = cyclesInvolving(graph, code)
      const firstCycle = cycles[0]
      if (firstCycle) {
        return {
          code,
          iso3,
          year,
          value: null,
          blank: true,
          source: 'formula',
          expression: expressionFor(code, iso3),
          usesCountryOverride: formula.countryOverrides?.[iso3] != null,
          ast: astFor(code, iso3),
          guard: 'not-applicable',
          policy: formula.nullPolicy,
          reads: [],
          missing: [],
          chain: [...firstCycle],
          error: cycleError(firstCycle),
        }
      }

      const result = evaluateFormula(formula, iso3, year, [])
      if (result.error?.kind !== 'cycle') memo.set(`${iso3}|${year}|${code}`, result.value)
      return {
        code,
        iso3,
        year,
        value: result.value,
        blank: result.value == null,
        source: 'formula',
        expression: result.expression,
        usesCountryOverride: formula.countryOverrides?.[iso3] != null,
        ast: result.ast,
        guard: result.guard,
        policy: formula.nullPolicy,
        reads: result.reads,
        missing: result.missing,
        chain: evaluationChain(graph, code),
        error: result.error,
      }
    }

    // Not a formula: an aggregate or a reported variable.
    let value: number | null = null
    let error: FormulaError | null = null
    try {
      value = resolveCode(code, iso3, year, [])
    } catch (e) {
      if (!(e instanceof FormulaError)) throw e
      error = e
    }

    return {
      code,
      iso3,
      year,
      value,
      blank: value == null,
      source: sourceOf(code, false),
      expression: null,
      usesCountryOverride: false,
      ast: null,
      guard: 'not-applicable',
      policy: null,
      reads: [],
      missing: [],
      chain: [],
      error,
    }
  }

  /**
   * Resolve `cell` as if it held `expression`, on a scratch memo so the trial
   * leaves no values behind, and report the loop it runs into, if any. Tried
   * rather than traced statically because series functions read other years:
   * `PREV(HF.1)` in HF.1.2.1 names its own parent and is still not a cycle.
   */
  function trialCycle(expression: string, cell: CellAddress): readonly string[] | null {
    const savedMemo = memo
    memo = new Map()
    trialCell = { key: `${cell.iso3}|${cell.year}|${cell.code}`, expression }
    detectedCycle = null
    try {
      resolveCode(cell.code, cell.iso3, cell.year, [])
    } catch (e) {
      if (!(e instanceof FormulaError)) throw e
    } finally {
      memo = savedMemo
      trialCell = null
    }
    const found = detectedCycle
    detectedCycle = null
    return found
  }

  function validate(expression: string, opts: { code?: string; cell?: CellAddress } = {}): ValidationResult {
    const { ast, error } = tryParseExpression(expression, { knownCodes })
    if (!ast) {
      return { ok: false, ast: null, error, unknownCodes: [], cycle: null }
    }

    const unknownCodes = referencedCodes(ast).filter((c) => !knownCodes.has(c))

    let cycle: readonly string[] | null = null
    if (opts.code) {
      const candidate = new Map(asts)
      candidate.set(opts.code, ast)
      const candidateGraph = buildDependencyGraph(candidate, {
        isBaseVariable: (c) => baseVariables.has(c) || aggregates.has(c),
      })
      cycle = cyclesInvolving(candidateGraph, opts.code)[0] ?? null
    }
    if (!cycle && opts.cell && unknownCodes.length === 0) {
      cycle = trialCycle(expression, opts.cell)
    }

    return {
      ok: unknownCodes.length === 0 && cycle == null,
      ast,
      error: cycle ? cycleError(cycle) : null,
      unknownCodes,
      cycle,
    }
  }

  return {
    knownCodes,
    graph,
    order: graph.order,
    cycles: graph.cycles,
    astFor,
    expressionFor,
    parse,
    validate,
    evaluate,
    valueOf: (code, iso3, year) => evaluate(code, iso3, year).value,
    dependentsOf: (code) => transitiveDependents(graph, code),
    invalidate: () => memo.clear(),
  }
}
