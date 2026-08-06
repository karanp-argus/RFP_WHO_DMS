/**
 * Phase 3 — formula engine unit tests.
 *
 * These exercise the engine against a **synthetic** variable set rather than the
 * seeded corpus, so a failure here points at the parser or the evaluator and
 * never at the data. The 16 real formulas over a real country-year are asserted
 * separately in `src/data/__tests__/phase3.test.ts`.
 */

import { describe, expect, it } from 'vitest'
import {
  astOutline,
  buildDependencyGraph,
  createFormulaEngine,
  cyclesInvolving,
  evaluationChain,
  extrapolateAt,
  fillSeries,
  formatNode,
  FormulaError,
  growthPercent,
  guardPasses,
  interpolateAt,
  parseExpression,
  referencedCodes,
  tokenize,
  transitiveDependents,
  tryParseExpression,
  type AstNode,
  type EngineFormula,
  type SeriesPoint,
} from '..'

/* --------------------------------------------------------------------------
   A small world to test against
   -------------------------------------------------------------------------- */

/**
 * Codes chosen to include every character class the real corpus contains:
 * dots, a `%`, a `$`, a `-`, an `_` and — in `HF TOT` — a space.
 */
const BASE_VARIABLES = [
  'HF.1.1',
  'HF.1.2',
  'HF.2',
  'HF.3',
  'HF.4',
  'HF.nec',
  'GDP',
  'POP',
  'EXR',
  'GGHE-D',
]

const AGGREGATES = new Map<string, readonly string[]>([
  ['HF.1', ['HF.1.1', 'HF.1.2']],
  ['HF TOT', ['HF.1', 'HF.2', 'HF.3', 'HF.4', 'HF.nec']],
])

const KNOWN = new Set<string>([
  ...BASE_VARIABLES,
  ...AGGREGATES.keys(),
  'CHE',
  'CHE%GDP_SHA2011',
  'GGHE-D_pc_US$_SHA2011',
])

const parse = (src: string): AstNode => parseExpression(src, { knownCodes: KNOWN })

/** Reported data for one fictional country, deliberately full of holes. */
const DATA: Record<string, Record<number, number>> = {
  'HF.1.1': { 2018: 100, 2019: 110, 2020: 120, 2021: 130, 2022: 140 },
  'HF.1.2': { 2018: 50, 2019: 55, 2020: 60, 2021: 65, 2022: 70 },
  'HF.2': { 2018: 20, 2019: 22, 2020: 24, 2021: 26, 2022: 28 },
  'HF.3': { 2018: 30, 2019: 33, 2020: 36, 2021: 39, 2022: 42 },
  // HF.4 is reported only at the ends, so interpolation has something to do.
  'HF.4': { 2018: 10, 2022: 30 },
  'HF.nec': { 2018: 1, 2019: 1, 2020: 1, 2021: 1, 2022: 1 },
  GDP: { 2018: 2000, 2019: 2100, 2020: 2200, 2021: 2300, 2022: 2400 },
  POP: { 2018: 10, 2019: 10, 2020: 10, 2021: 10, 2022: 10 },
  EXR: { 2018: 2, 2019: 2, 2020: 2, 2021: 2, 2022: 2 },
  'GGHE-D': { 2018: 80, 2019: 88, 2020: 96, 2021: 104, 2022: 112 },
}

/** A country with no GDP at all — the null-guard subject. */
const NO_GDP = 'XXX'

const YEARS = [2018, 2019, 2020, 2021, 2022]

function reported(iso3: string, year: number, code: string): number | null {
  if (iso3 === NO_GDP && code === 'GDP') return null
  return DATA[code]?.[year] ?? null
}

const FORMULAS: EngineFormula[] = [
  { code: 'CHE', expression: 'HF.1 + HF.2 + HF.3 + HF.4 + HF.nec', nullPolicy: 'any-not-null' },
  { code: 'CHE%GDP_SHA2011', expression: 'CHE / GDP * 100', nullPolicy: 'all-not-null' },
  {
    code: 'GGHE-D_pc_US$_SHA2011',
    expression: 'GGHE-D / POP / EXR',
    nullPolicy: 'all-not-null',
  },
  // The FR's own identity case: an indicator listed among the formulas whose
  // expression is just its own sourced code.
  { code: 'GGHE-D', expression: 'GGHE-D', nullPolicy: 'any-not-null' },
]

function makeEngine(formulas: EngineFormula[] = FORMULAS) {
  return createFormulaEngine({
    formulas,
    aggregates: AGGREGATES,
    baseVariables: BASE_VARIABLES,
    years: YEARS,
    resolveReported: reported,
  })
}

/* ==========================================================================
   Tokeniser — greedy matching against the known-code set
   ========================================================================== */

describe('tokenizer', () => {
  const lex = (src: string) => tokenize(src, { knownCodes: KNOWN })

  it('reads a code containing % , $ , - and _ as one reference', () => {
    const tokens = lex('GGHE-D_pc_US$_SHA2011')
    expect(tokens).toHaveLength(1)
    expect(tokens[0]?.type).toBe('ref')
    expect(tokens[0]?.text).toBe('GGHE-D_pc_US$_SHA2011')
  })

  it('reads a code containing a space as one reference (HF TOT)', () => {
    const tokens = lex('HF TOT / GDP')
    expect(tokens.map((t) => t.text)).toEqual(['HF TOT', '/', 'GDP'])
  })

  it('does not mistake the minus in GGHE-D for subtraction', () => {
    expect(lex('GGHE-D / GDP').map((t) => t.text)).toEqual(['GGHE-D', '/', 'GDP'])
  })

  it('still reads subtraction between two known codes', () => {
    expect(lex('GDP - POP').map((t) => t.text)).toEqual(['GDP', '-', 'POP'])
  })

  it('prefers the longest known code at a position', () => {
    // `HF.1` and `HF.1.1` both exist; the longer one wins.
    expect(lex('HF.1.1 + HF.1').map((t) => t.text)).toEqual(['HF.1.1', '+', 'HF.1'])
  })

  it('separates a number from an adjacent operator', () => {
    expect(lex('CHE / GDP * 100').map((t) => t.type)).toEqual([
      'ref',
      'op',
      'ref',
      'op',
      'number',
    ])
  })

  it('flags a reference that matches no known code', () => {
    const tokens = lex('NOT_A_CODE + GDP')
    expect(tokens[0]?.known).toBe(false)
    expect(tokens[2]?.known).toBe(true)
  })

  it('reads a [year-1] offset onto the reference', () => {
    const tokens = lex('HF.2[year-1]')
    expect(tokens[0]?.yearOffset).toBe(-1)
    expect(lex('HF.2[year+2]')[0]?.yearOffset).toBe(2)
    expect(lex('HF.2[year]')[0]?.yearOffset).toBe(0)
  })
})

/* ==========================================================================
   Parser
   ========================================================================== */

describe('parser', () => {
  it('gives * and / higher precedence than + and -', () => {
    const ast = parse('HF.2 + HF.3 * 2')
    expect(ast.kind).toBe('binary')
    if (ast.kind !== 'binary') return
    expect(ast.op).toBe('+')
    expect(ast.right.kind).toBe('binary')
  })

  it('honours parentheses', () => {
    const ast = parse('(HF.2 + HF.3) * 2')
    expect(ast.kind === 'binary' && ast.op).toBe('*')
  })

  it('left-associates same-precedence operators', () => {
    const ast = parse('HF.2 - HF.3 - HF.4')
    // ((HF.2 - HF.3) - HF.4), not (HF.2 - (HF.3 - HF.4)).
    expect(ast.kind === 'binary' && ast.left.kind).toBe('binary')
  })

  it('parses unary minus', () => {
    expect(parse('-GDP').kind).toBe('unary')
  })

  it('round-trips through formatNode without changing meaning', () => {
    for (const src of [
      'HF.1 + HF.2 + HF.3 + HF.4 + HF.nec',
      '(HF.1 + HF.2) / CHE * 100',
      'GDP - (POP - EXR)',
      'IF(GDP > 0, CHE / GDP * 100, 0)',
      'EXTRAPOLATE(GDP, \'forward\', \'cagr\')',
      'PREV(HF.2, 2)',
    ]) {
      expect(parse(formatNode(parse(src)))).toEqual(parse(src))
    }
  })

  it('re-inserts only the parentheses precedence needs', () => {
    expect(formatNode(parse('HF.2 + HF.3 * 2'))).toBe('HF.2 + HF.3 * 2')
    expect(formatNode(parse('(HF.2 + HF.3) * 2'))).toBe('(HF.2 + HF.3) * 2')
    expect(formatNode(parse('GDP - (POP - EXR)'))).toBe('GDP - (POP - EXR)')
  })

  it('lists referenced codes in first-appearance order, deduplicated', () => {
    expect(referencedCodes(parse('CHE / GDP * 100 + CHE'))).toEqual(['CHE', 'GDP'])
  })

  it('renders an AST outline for the inspector', () => {
    const rows = astOutline(parse('CHE / GDP * 100'))
    expect(rows[0]).toEqual({ depth: 0, label: 'operator', detail: '*' })
    expect(rows.some((r) => r.label === 'ref' && r.detail === 'CHE')).toBe(true)
  })

  it('reports an unknown function by name', () => {
    const { error } = tryParseExpression('TOTAL(HF.1)', { knownCodes: KNOWN })
    expect(error?.kind).toBe('unknown-function')
    expect(error?.message).toContain('TOTAL')
  })

  it('reports wrong arity', () => {
    const { error } = tryParseExpression('ABS(1, 2)', { knownCodes: KNOWN })
    expect(error?.kind).toBe('arity')
  })

  it('requires a bare reference for the series functions', () => {
    const { error } = tryParseExpression('PREV(HF.1 + HF.2)', { knownCodes: KNOWN })
    expect(error?.kind).toBe('reference-required')
  })

  it('reports an unbalanced parenthesis with a position', () => {
    const { error } = tryParseExpression('(HF.1 + HF.2', { knownCodes: KNOWN })
    expect(error?.kind).toBe('syntax')
    expect(error?.position).not.toBeNull()
  })

  it('rejects an empty expression', () => {
    expect(() => parse('   ')).toThrow(FormulaError)
  })
})

/* ==========================================================================
   Null policy
   ========================================================================== */

describe('null policy', () => {
  const reads = (values: (number | null)[]) =>
    values.map((value, i) => ({ code: `C${i}`, year: 2022, value, origin: 'reported' as const }))

  it('any-not-null passes when one input has a value', () => {
    expect(guardPasses('any-not-null', reads([null, 5, null]))).toBe(true)
    expect(guardPasses('any-not-null', reads([null, null]))).toBe(false)
  })

  it('all-not-null fails when any input is missing', () => {
    expect(guardPasses('all-not-null', reads([1, 2, 3]))).toBe(true)
    expect(guardPasses('all-not-null', reads([1, null, 3]))).toBe(false)
  })

  it('passes trivially when the expression reads nothing', () => {
    expect(guardPasses('all-not-null', [])).toBe(true)
  })
})

/* ==========================================================================
   Series
   ========================================================================== */

describe('series', () => {
  const series: SeriesPoint[] = [
    { year: 2018, value: 10 },
    { year: 2019, value: null },
    { year: 2020, value: null },
    { year: 2021, value: 40 },
    { year: 2022, value: null },
  ]

  it('interpolates linearly between the nearest reported years', () => {
    expect(interpolateAt(series, 2019)).toBe(20)
    expect(interpolateAt(series, 2020)).toBe(30)
  })

  it('returns the reported value untouched on a year that has one', () => {
    expect(interpolateAt(series, 2021)).toBe(40)
  })

  it('refuses to interpolate with a known point on only one side', () => {
    expect(interpolateAt(series, 2022)).toBeNull()
  })

  it('extrapolates forward and backward on the trend of the nearest two points', () => {
    const dense: SeriesPoint[] = [
      { year: 2020, value: 100 },
      { year: 2021, value: 110 },
    ]
    expect(extrapolateAt(dense, 2022, 'forward', 'linear')).toBe(120)
    expect(extrapolateAt(dense, 2019, 'backward', 'linear')).toBe(90)
  })

  it('extrapolates on a compound rate when asked', () => {
    const dense: SeriesPoint[] = [
      { year: 2020, value: 100 },
      { year: 2021, value: 110 },
    ]
    expect(extrapolateAt(dense, 2022, 'forward', 'cagr')).toBeCloseTo(121, 6)
  })

  it('needs two reported points before it will extrapolate at all', () => {
    expect(extrapolateAt([{ year: 2020, value: 100 }], 2021, 'forward')).toBeNull()
  })

  it('tags every filled point with how it was obtained', () => {
    const filled = fillSeries(series, {
      interpolate: true,
      extrapolateForward: true,
      method: 'linear',
    })
    expect(filled.map((p) => p.origin)).toEqual([
      'reported',
      'interpolated',
      'interpolated',
      'reported',
      'extrapolated',
    ])
  })

  it('returns blank rather than infinity when growth has a zero base', () => {
    expect(growthPercent(10, 0)).toBeNull()
    expect(growthPercent(110, 100)).toBeCloseTo(10, 9)
    expect(growthPercent(null, 100)).toBeNull()
  })
})

/* ==========================================================================
   Dependency graph
   ========================================================================== */

describe('dependency graph', () => {
  const graphOf = (specs: Record<string, string>, base: string[] = BASE_VARIABLES) => {
    const asts = new Map<string, AstNode>()
    const known = new Set<string>([...KNOWN, ...Object.keys(specs)])
    for (const [code, expression] of Object.entries(specs)) {
      asts.set(code, parseExpression(expression, { knownCodes: known }))
    }
    return buildDependencyGraph(asts, { isBaseVariable: (c) => base.includes(c) })
  }

  it('orders dependencies before the formulas that read them', () => {
    const graph = graphOf({
      'CHE%GDP_SHA2011': 'CHE / GDP * 100',
      CHE: 'HF.1 + HF.2',
    })
    expect(graph.order.indexOf('CHE')).toBeLessThan(graph.order.indexOf('CHE%GDP_SHA2011'))
    expect(graph.cycles).toEqual([])
  })

  it('records the reverse edges used to recompute after an edit', () => {
    const graph = graphOf({
      'CHE%GDP_SHA2011': 'CHE / GDP * 100',
      CHE: 'HF.1 + HF.2',
      OOP_SHARE: 'HF.3 / CHE * 100',
    })
    expect(transitiveDependents(graph, 'CHE').sort()).toEqual([
      'CHE%GDP_SHA2011',
      'OOP_SHARE',
    ])
  })

  it('detects a two-formula cycle and names the path', () => {
    const graph = graphOf({ A: 'B + 1', B: 'A + 1' })
    expect(graph.cycles).toHaveLength(1)
    const cycle = graph.cycles[0] ?? []
    expect(cycle[0]).toBe(cycle[cycle.length - 1])
    expect(new Set(cycle)).toEqual(new Set(['A', 'B']))
  })

  it('detects a longer cycle', () => {
    const graph = graphOf({ A: 'B + 1', B: 'C + 1', C: 'A + 1' })
    expect(graph.cycles).toHaveLength(1)
    expect(cyclesInvolving(graph, 'B')).toHaveLength(1)
  })

  it('keeps acyclic formulas orderable even when others are circular', () => {
    const graph = graphOf({ A: 'B + 1', B: 'A + 1', CHE: 'HF.1 + HF.2' })
    expect(graph.order).toContain('CHE')
    expect(graph.order).not.toContain('A')
  })

  it('treats a self-reference onto a real variable as an identity, not a cycle', () => {
    const graph = graphOf({ 'GGHE-D': 'GGHE-D' })
    expect(graph.cycles).toEqual([])
  })

  it('treats a self-reference with no variable behind it as a cycle', () => {
    const graph = graphOf({ SOMETHING: 'SOMETHING + 1' }, [])
    expect(graph.cycles).toHaveLength(1)
  })

  it('lists the chain a formula needs, dependencies first', () => {
    const graph = graphOf({
      'CHE%GDP_SHA2011': 'CHE / GDP * 100',
      CHE: 'HF.1 + HF.2',
    })
    expect(evaluationChain(graph, 'CHE%GDP_SHA2011')).toEqual(['CHE', 'CHE%GDP_SHA2011'])
  })
})

/* ==========================================================================
   Evaluation
   ========================================================================== */

describe('evaluation', () => {
  it('sums an aggregate variable from its reported children', () => {
    // HF.1 is never reported — it is HF.1.1 + HF.1.2.
    expect(makeEngine().valueOf('HF.1', 'AAA', 2022)).toBe(210)
  })

  it('sums a total from aggregates that are themselves computed', () => {
    // HF TOT → HF.1 (→ HF.1.1 + HF.1.2) + HF.2 + HF.3 + HF.4 + HF.nec
    expect(makeEngine().valueOf('HF TOT', 'AAA', 2022)).toBe(210 + 28 + 42 + 30 + 1)
  })

  it('evaluates a nested formula in dependency order', () => {
    const engine = makeEngine()
    const che = engine.valueOf('CHE', 'AAA', 2022)
    expect(che).toBe(311)
    const share = engine.evaluate('CHE%GDP_SHA2011', 'AAA', 2022)
    expect(share.value).toBeCloseTo((311 / 2400) * 100, 9)
    expect(share.chain).toEqual(['CHE', 'CHE%GDP_SHA2011'])
  })

  it('records every input it read, with the year and the origin', () => {
    const result = makeEngine().evaluate('CHE%GDP_SHA2011', 'AAA', 2022)
    expect(result.reads.map((r) => r.code)).toEqual(['CHE', 'GDP'])
    expect(result.reads[0]?.origin).toBe('formula')
    expect(result.reads[1]?.origin).toBe('reported')
    expect(result.reads.every((r) => r.year === 2022)).toBe(true)
  })

  it('resolves a formula whose expression is its own sourced code', () => {
    // GGHE-D is listed among the indicators but comes from the macro series.
    expect(makeEngine().valueOf('GGHE-D', 'AAA', 2022)).toBe(112)
    expect(makeEngine().valueOf('GGHE-D_pc_US$_SHA2011', 'AAA', 2022)).toBe(112 / 10 / 2)
  })

  /* --- the distinction the RFP cares about ----------------------------- */

  it('yields BLANK, not zero, when an all-not-null guard fails', () => {
    const result = makeEngine().evaluate('CHE%GDP_SHA2011', NO_GDP, 2022)
    expect(result.value).toBeNull()
    expect(result.value).not.toBe(0)
    expect(result.guard).toBe('failed')
    expect(result.missing.map((m) => m.code)).toEqual(['GDP'])
  })

  it('treats a missing input as zero under any-not-null', () => {
    const engine = createFormulaEngine({
      formulas: [{ code: 'CHE', expression: 'HF.1 + HF.2 + HF.3 + HF.4 + HF.nec', nullPolicy: 'any-not-null' }],
      aggregates: AGGREGATES,
      baseVariables: BASE_VARIABLES,
      years: YEARS,
      // Only HF.2 is reported; the rest are missing.
      resolveReported: (_iso3, _year, code) => (code === 'HF.2' ? 28 : null),
    })
    expect(engine.valueOf('CHE', 'AAA', 2022)).toBe(28)
  })

  it('yields blank under any-not-null when every input is missing', () => {
    const engine = createFormulaEngine({
      formulas: [{ code: 'CHE', expression: 'HF.1 + HF.2', nullPolicy: 'any-not-null' }],
      aggregates: AGGREGATES,
      baseVariables: BASE_VARIABLES,
      years: YEARS,
      resolveReported: () => null,
    })
    const result = engine.evaluate('CHE', 'AAA', 2022)
    expect(result.value).toBeNull()
    expect(result.guard).toBe('failed')
  })

  it('yields blank rather than infinity when a denominator is zero', () => {
    const engine = createFormulaEngine({
      formulas: [{ code: 'SHARE', expression: 'HF.2 / GDP * 100', nullPolicy: 'all-not-null' }],
      baseVariables: [...BASE_VARIABLES, 'SHARE'],
      years: YEARS,
      resolveReported: (_i, _y, code) => (code === 'GDP' ? 0 : 50),
    })
    expect(engine.valueOf('SHARE', 'AAA', 2022)).toBeNull()
  })

  /* --- cycles are reported, never entered ------------------------------ */

  it('reports a deliberate cycle instead of hanging', () => {
    const engine = makeEngine([
      { code: 'A', expression: 'B + 1', nullPolicy: 'all-not-null' },
      { code: 'B', expression: 'A + 1', nullPolicy: 'all-not-null' },
    ])
    expect(engine.cycles).toHaveLength(1)

    const result = engine.evaluate('A', 'AAA', 2022)
    expect(result.value).toBeNull()
    expect(result.error?.kind).toBe('cycle')
    expect(result.error?.message).toContain('→')
    expect(result.error?.codes).toContain('B')
  })

  it('rejects a cycle at validation time, before it is saved', () => {
    const engine = makeEngine()
    // CHE%GDP already reads CHE, so making CHE read it back closes the loop.
    const check = engine.validate('CHE%GDP_SHA2011 + HF.2', { code: 'CHE' })
    expect(check.ok).toBe(false)
    expect(check.cycle).not.toBeNull()
    expect(check.error?.kind).toBe('cycle')
  })

  it('reports unknown references at validation time', () => {
    const check = makeEngine().validate('HF.2 + NOT_A_VARIABLE')
    expect(check.ok).toBe(false)
    expect(check.unknownCodes).toEqual(['NOT_A_VARIABLE'])
  })

  it('accepts a sound expression', () => {
    const check = makeEngine().validate('HF.3 / CHE * 100', { code: 'OOP_SHARE' })
    expect(check.ok).toBe(true)
    expect(check.unknownCodes).toEqual([])
    expect(check.cycle).toBeNull()
  })

  /* --- functions -------------------------------------------------------- */

  it('applies the value functions', () => {
    const engine = makeEngine([
      { code: 'F_SUM', expression: 'SUM(HF.2, HF.3, HF.4)', nullPolicy: 'any-not-null' },
      { code: 'F_AVG', expression: 'AVG(HF.2, HF.3)', nullPolicy: 'any-not-null' },
      { code: 'F_MIN', expression: 'MIN(HF.2, HF.3)', nullPolicy: 'any-not-null' },
      { code: 'F_MAX', expression: 'MAX(HF.2, HF.3)', nullPolicy: 'any-not-null' },
      { code: 'F_ABS', expression: 'ABS(HF.2 - HF.3)', nullPolicy: 'all-not-null' },
      { code: 'F_IF', expression: 'IF(GDP > 0, HF.2, 0)', nullPolicy: 'all-not-null' },
    ])
    expect(engine.valueOf('F_SUM', 'AAA', 2022)).toBe(28 + 42 + 30)
    expect(engine.valueOf('F_AVG', 'AAA', 2022)).toBe(35)
    expect(engine.valueOf('F_MIN', 'AAA', 2022)).toBe(28)
    expect(engine.valueOf('F_MAX', 'AAA', 2022)).toBe(42)
    expect(engine.valueOf('F_ABS', 'AAA', 2022)).toBe(14)
    expect(engine.valueOf('F_IF', 'AAA', 2022)).toBe(28)
  })

  it('shifts the year for PREV and a [year-n] reference alike', () => {
    const engine = makeEngine([
      { code: 'F_PREV', expression: 'PREV(HF.2)', nullPolicy: 'all-not-null' },
      { code: 'F_PREV2', expression: 'PREV(HF.2, 2)', nullPolicy: 'all-not-null' },
      { code: 'F_OFFSET', expression: 'HF.2[year-1]', nullPolicy: 'all-not-null' },
    ])
    expect(engine.valueOf('F_PREV', 'AAA', 2022)).toBe(26)
    expect(engine.valueOf('F_PREV2', 'AAA', 2022)).toBe(24)
    expect(engine.valueOf('F_OFFSET', 'AAA', 2022)).toBe(26)
  })

  it('computes GROWTH as a percentage change', () => {
    const engine = makeEngine([
      { code: 'F_GROWTH', expression: 'GROWTH(GDP)', nullPolicy: 'all-not-null' },
    ])
    // 2400 over 2300.
    expect(engine.valueOf('F_GROWTH', 'AAA', 2022)).toBeCloseTo((100 / 2300) * 100, 9)
  })

  it('fills a gap with INTERPOLATE and passes the guard on the filled value', () => {
    const engine = makeEngine([
      { code: 'F_FILL', expression: 'INTERPOLATE(HF.4)', nullPolicy: 'all-not-null' },
    ])
    // HF.4 is 10 in 2018 and 30 in 2022, nothing between.
    expect(engine.valueOf('F_FILL', 'AAA', 2020)).toBe(20)
    const trace = engine.evaluate('F_FILL', 'AAA', 2020)
    expect(trace.guard).toBe('passed')
  })

  it('projects beyond the reported range with EXTRAPOLATE', () => {
    const engine = createFormulaEngine({
      formulas: [
        { code: 'F_EXT', expression: "EXTRAPOLATE(GDP, 'forward', 'linear')", nullPolicy: 'all-not-null' },
      ],
      baseVariables: BASE_VARIABLES,
      // A year beyond the reported data is in range, so there is something to project to.
      years: [...YEARS, 2023],
      resolveReported: reported,
    })
    expect(engine.valueOf('F_EXT', 'AAA', 2023)).toBe(2500)
  })

  /* --- housekeeping ----------------------------------------------------- */

  it('invalidates memoised values when the underlying data changes', () => {
    let gdp = 2400
    const engine = createFormulaEngine({
      formulas: [{ code: 'SHARE', expression: 'HF.2 / GDP * 100', nullPolicy: 'all-not-null' }],
      baseVariables: BASE_VARIABLES,
      years: YEARS,
      resolveReported: (_i, _y, code) => (code === 'GDP' ? gdp : 24),
    })
    const before = engine.valueOf('SHARE', 'AAA', 2022)
    gdp = 1200
    expect(engine.valueOf('SHARE', 'AAA', 2022)).toBe(before)
    engine.invalidate()
    expect(engine.valueOf('SHARE', 'AAA', 2022)).toBeCloseTo((before ?? 0) * 2, 9)
  })

  it('applies a UC029 country override without touching other countries', () => {
    const engine = makeEngine([
      {
        code: 'CHE',
        expression: 'HF.1 + HF.2 + HF.3 + HF.4 + HF.nec',
        nullPolicy: 'any-not-null',
        // Argentina's real override in the seed: capital expenditure excluded.
        countryOverrides: { ARG: 'HF.1 + HF.2 + HF.3 + HF.4' },
      },
    ])
    expect(engine.valueOf('CHE', 'AAA', 2022)).toBe(311)
    expect(engine.valueOf('CHE', 'ARG', 2022)).toBe(310)
    expect(engine.evaluate('CHE', 'ARG', 2022).usesCountryOverride).toBe(true)
    expect(engine.evaluate('CHE', 'AAA', 2022).usesCountryOverride).toBe(false)
  })

  it('never parses a legacy old-DMS formula', () => {
    const engine = makeEngine([
      { code: 'OLD_CHE_TOT', expression: '@SUM(HF1:HF4)+@VAL(HFNEC)', nullPolicy: 'any-not-null', isLegacy: true },
    ])
    expect(engine.astFor('OLD_CHE_TOT')).toBeNull()
    expect(engine.cycles).toEqual([])
  })
})
