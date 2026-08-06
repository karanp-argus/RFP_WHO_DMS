/**
 * Phase 3 acceptance tests — the 16 seeded formulas over real seeded data.
 *
 * The parser and evaluator are exercised against a synthetic world in
 * `src/domain/formula/__tests__/formula.test.ts`. This file asks the other
 * question: does the engine, wired to the actual FR formula table and the
 * actual observation corpus, produce numbers a health accountant would accept?
 *
 * Values reach the engine the same way the application gets them — through
 * `XMartClient.getObservations` — so this also proves the wiring the Setup tab
 * uses, not just the maths.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { FIRST_YEAR, LAST_YEAR, YEARS } from '@/domain/constants'
import {
  aggregatesFromVariables,
  baseVariableCodes,
  createFormulaEngine,
  type EngineFormula,
  type FormulaEngine,
} from '@/domain/formula'
import { CLASSIFICATION_VARIABLES } from '../seed/classifications'
import { FORMULA_COUNTRY_OVERRIDES, PREDEFINED_FORMULAS } from '../seed/formulas'
import { mockXMartClient } from '../xmart/mockClient'
import { resetDemoData } from '../db'

const AGGREGATES = aggregatesFromVariables(CLASSIFICATION_VARIABLES)
const BASE_VARIABLES = baseVariableCodes(CLASSIFICATION_VARIABLES)

/** The formula set as xMart serves it, UC029 overrides applied. */
const SEEDED_FORMULAS: EngineFormula[] = PREDEFINED_FORMULAS.map((f) => ({
  code: f.code,
  expression: f.expression,
  nullPolicy: f.nullPolicy,
  countryOverrides: FORMULA_COUNTRY_OVERRIDES[f.code] ?? f.countryOverrides,
}))

/**
 * Pull one country's whole reported series through the client and index it.
 * This is exactly what `useFormulaEngine` does in the app.
 */
async function reportedFor(iso3: string): Promise<Map<string, number | null>> {
  const page = await mockXMartClient.getObservations({
    countries: [iso3],
    yearFrom: FIRST_YEAR,
    yearTo: LAST_YEAR,
    includeDeleted: false,
    pageSize: 500_000,
  })

  const map = new Map<string, number | null>()
  for (const o of page.rows) {
    const codes = Object.values(o.dims).filter((v): v is string => v != null && v !== '')
    // Crosses are multi-dimension tuples and are not formula inputs.
    if (codes.length !== 1) continue
    const code = codes[0]
    if (code == null) continue
    map.set(`${code}|${o.year}`, o.value)
  }
  return map
}

function engineOver(
  reported: Map<string, number | null>,
  formulas: EngineFormula[] = SEEDED_FORMULAS,
): FormulaEngine {
  return createFormulaEngine({
    formulas,
    aggregates: AGGREGATES,
    baseVariables: BASE_VARIABLES,
    years: YEARS,
    resolveReported: (_iso3, year, code) => reported.get(`${code}|${year}`) ?? null,
  })
}

const YEAR = 2022

let canada: Map<string, number | null>
let argentina: Map<string, number | null>
let engine: FormulaEngine

beforeAll(async () => {
  resetDemoData()
  canada = await reportedFor('CAN')
  argentina = await reportedFor('ARG')
  engine = engineOver(canada)
}, 30_000)

/* ==========================================================================
   The formula set itself
   ========================================================================== */

describe('the seeded formula set', () => {
  it('has all 16 formulas from the FR HLR8 table', () => {
    expect(PREDEFINED_FORMULAS).toHaveLength(16)
  })

  it('parses every one of them against the real variable set', () => {
    for (const f of SEEDED_FORMULAS) {
      const ast = engine.astFor(f.code)
      expect(ast, `${f.code} failed to parse`).not.toBeNull()
    }
  })

  it('resolves every referenced code to a known variable or formula', () => {
    for (const f of SEEDED_FORMULAS) {
      const check = engine.validate(f.expression)
      expect(check.unknownCodes, `${f.code} references unknown codes`).toEqual([])
    }
  })

  it('is acyclic and orders dependencies before dependents', () => {
    expect(engine.cycles).toEqual([])
    // CHE is read by six other indicators; it must be evaluated before them.
    const order = engine.order
    for (const dependent of [
      'CHE%GDP_SHA2011',
      'CHE_pc_US$_SHA2011',
      'DOM%CHE_SHA2011',
      'OOPS%CHE_SHA2011',
      'EXT%CHE_SHA2011',
    ]) {
      expect(order.indexOf('CHE')).toBeLessThan(order.indexOf(dependent))
    }
    // EXT feeds EXT%CHE, and PVT-D feeds two more.
    expect(order.indexOf('EXT')).toBeLessThan(order.indexOf('EXT%CHE_SHA2011'))
    expect(order.indexOf('PVT-D')).toBeLessThan(order.indexOf('PVT-D%CHE_SHA2011'))
  })

  it('knows what to recompute when CHE changes', () => {
    expect(engine.dependentsOf('CHE')).toEqual(
      expect.arrayContaining([
        'CHE%GDP_SHA2011',
        'CHE_pc_US$_SHA2011',
        'DOM%CHE_SHA2011',
        'GGHE-D%CHE_SHA2011',
        'OOPS%CHE_SHA2011',
        'PVT-D%CHE_SHA2011',
        'VPP%CHE_SHA2011',
        'EXT%CHE_SHA2011',
      ]),
    )
  })
})

/* ==========================================================================
   Evaluation against a real country-year
   ========================================================================== */

describe('evaluating for Canada 2022', () => {
  it('produces a value for every one of the 16', () => {
    for (const f of SEEDED_FORMULAS) {
      const result = engine.evaluate(f.code, 'CAN', YEAR)
      expect(result.error, `${f.code}: ${result.error?.message}`).toBeNull()
      expect(result.value, `${f.code} evaluated to blank`).not.toBeNull()
      expect(Number.isFinite(result.value ?? NaN)).toBe(true)
    }
  })

  it('computes CHE as the sum of the five HF components it names', () => {
    const parts = ['HF.1', 'HF.2', 'HF.3', 'HF.4', 'HF.nec'].map(
      (code) => engine.valueOf(code, 'CAN', YEAR) ?? 0,
    )
    const expected = parts.reduce((a, b) => a + b, 0)
    expect(engine.valueOf('CHE', 'CAN', YEAR)).toBeCloseTo(expected, 6)
  })

  it('builds HF.1 from its children rather than reading it — aggregates are never generated', () => {
    const children = ['HF.1.1', 'HF.1.2', 'HF.1.3']
      .map((c) => engine.valueOf(c, 'CAN', YEAR))
      .filter((v): v is number => v != null)
    expect(children.length).toBeGreaterThan(0)
    expect(engine.valueOf('HF.1', 'CAN', YEAR)).toBeCloseTo(
      children.reduce((a, b) => a + b, 0),
      6,
    )
    // And HF.1.2 is itself a parent of two reported leaves.
    expect(engine.evaluate('HF.1', 'CAN', YEAR).source).toBe('aggregate')
    expect(engine.evaluate('HF.1.1', 'CAN', YEAR).source).toBe('reported')
  })

  it('agrees with the HF TOT aggregate, which covers the same members', () => {
    const che = engine.valueOf('CHE', 'CAN', YEAR)
    const total = engine.valueOf('HF TOT', 'CAN', YEAR)
    expect(che).not.toBeNull()
    expect(total).toBeCloseTo(che ?? 0, 6)
  })

  it('resolves the nested chain CHE%GDP → CHE → HF.* in dependency order', () => {
    const result = engine.evaluate('CHE%GDP_SHA2011', 'CAN', YEAR)
    expect(result.chain).toEqual(['CHE', 'CHE%GDP_SHA2011'])
    expect(result.reads.map((r) => r.code)).toEqual(['CHE', 'GDP'])
    expect(result.reads[0]?.origin).toBe('formula')

    const che = engine.valueOf('CHE', 'CAN', YEAR) ?? 0
    const gdp = engine.valueOf('GDP', 'CAN', YEAR) ?? 0
    expect(result.value).toBeCloseTo((che / gdp) * 100, 9)
  })

  it('resolves GGHE-D as an identity onto the macro series, not a cycle', () => {
    const result = engine.evaluate('GGHE-D', 'CAN', YEAR)
    expect(result.error).toBeNull()
    expect(result.value).not.toBeNull()
    expect(engine.cycles).toEqual([])
  })

  it('lands the computed indicators in ranges a health economist would accept', () => {
    const cheGdp = engine.valueOf('CHE%GDP_SHA2011', 'CAN', YEAR) ?? 0
    expect(cheGdp).toBeGreaterThan(4)
    expect(cheGdp).toBeLessThan(20)

    for (const share of [
      'DOM%CHE_SHA2011',
      'GGHE-D%CHE_SHA2011',
      'PVT-D%CHE_SHA2011',
      'OOPS%CHE_SHA2011',
      'VPP%CHE_SHA2011',
      'EXT%CHE_SHA2011',
    ]) {
      const value = engine.valueOf(share, 'CAN', YEAR) ?? -1
      expect(value, `${share} = ${value}`).toBeGreaterThanOrEqual(0)
      expect(value, `${share} = ${value}`).toBeLessThanOrEqual(100)
    }

    // Canada is high income: per-capita spending in US$ is in the thousands.
    const perCapita = engine.valueOf('CHE_pc_US$_SHA2011', 'CAN', YEAR) ?? 0
    expect(perCapita).toBeGreaterThan(500)
    expect(perCapita).toBeLessThan(20_000)
  })

  it('is deterministic — the same country-year twice gives the same numbers', () => {
    const first = SEEDED_FORMULAS.map((f) => engine.valueOf(f.code, 'CAN', YEAR))
    const fresh = engineOver(canada)
    const second = SEEDED_FORMULAS.map((f) => fresh.valueOf(f.code, 'CAN', YEAR))
    expect(second).toEqual(first)
  })

  it('evaluates all 16 across the full 25-year span quickly', () => {
    const fresh = engineOver(canada)
    const started = performance.now()
    for (const year of YEARS) {
      for (const f of SEEDED_FORMULAS) fresh.valueOf(f.code, 'CAN', year)
    }
    // 400 evaluations, each pulling a nested chain down to reported leaves.
    expect(performance.now() - started).toBeLessThan(1000)
  })
})

/* ==========================================================================
   The null guard — blank, not zero
   ========================================================================== */

describe('null guards on real data', () => {
  it('blanks CHE%GDP for a country with no GDP rather than reporting 0%', () => {
    const withoutGdp = new Map(canada)
    for (const year of YEARS) withoutGdp.set(`GDP|${year}`, null)

    const result = engineOver(withoutGdp).evaluate('CHE%GDP_SHA2011', 'CAN', YEAR)
    expect(result.value).toBeNull()
    expect(result.value).not.toBe(0)
    expect(result.guard).toBe('failed')
    expect(result.missing.map((m) => m.code)).toEqual(['GDP'])
  })

  it('still computes CHE when only some HF components are reported (any-not-null)', () => {
    const partial = new Map(canada)
    // Wipe every HF leaf except the government scheme.
    for (const key of [...partial.keys()]) {
      if (key.startsWith('HF.') && !key.startsWith('HF.1.1|')) partial.set(key, null)
    }
    const value = engineOver(partial).evaluate('CHE', 'CAN', YEAR)
    expect(value.value).not.toBeNull()
    expect(value.value).toBeCloseTo(partial.get(`HF.1.1|${YEAR}`) ?? 0, 6)
    expect(value.guard).toBe('passed')
  })

  it('blanks CHE when no HF component is reported at all', () => {
    const empty = new Map(canada)
    for (const key of [...empty.keys()]) if (key.startsWith('HF.')) empty.set(key, null)
    const result = engineOver(empty).evaluate('CHE', 'CAN', YEAR)
    expect(result.value).toBeNull()
    expect(result.guard).toBe('failed')
  })

  it('produces genuine blanks on the seeded corpus, not only on rigged inputs', async () => {
    // The guard has to matter on real data or the distinction is theatre. EXT
    // sums two external-financing codes that a high-income country often
    // reports neither of, which blanks EXT and then EXT%CHE behind it.
    const found: string[] = []
    for (const iso3 of ['CAN', 'FRA', 'JPN', 'DEU', 'AUS', 'NOR', 'CHE', 'NZL']) {
      const local = engineOver(await reportedFor(iso3))
      for (const f of SEEDED_FORMULAS) {
        const r = local.evaluate(f.code, iso3, YEAR)
        if (r.value == null) found.push(`${iso3}/${f.code}/${r.guard}`)
      }
    }
    expect(found.length, 'no formula blanked anywhere in the sampled corpus').toBeGreaterThan(0)
    // And every one of them blanked because a guard failed, not because of an error.
    for (const entry of found) expect(entry).toContain('failed')
  }, 30_000)

  it('never turns a blank into a zero anywhere in the seeded corpus', () => {
    // Sweep several countries and years: every result is either a real number
    // or null. A 0 may only appear where the inputs genuinely summed to 0.
    for (const iso3 of ['CAN', 'KEN']) {
      for (const year of [2005, 2015, YEAR]) {
        for (const f of SEEDED_FORMULAS) {
          const r = engine.evaluate(f.code, iso3, year)
          if (r.value === 0) {
            expect(r.guard, `${f.code} ${iso3} ${year} returned 0 on a failed guard`).not.toBe(
              'failed',
            )
          }
        }
      }
    }
  })
})

/* ==========================================================================
   UC029 — per-country override
   ========================================================================== */

describe('per-country formula overrides (UC029)', () => {
  it('uses Argentina&apos;s override without altering any other country', () => {
    const argEngine = engineOver(argentina)

    const arg = argEngine.evaluate('CHE', 'ARG', YEAR)
    expect(arg.usesCountryOverride).toBe(true)
    expect(arg.expression).toBe('HF.1 + HF.2 + HF.3 + HF.4')

    // The standard definition also carries HF.nec, so the two differ by it.
    const nec = argEngine.valueOf('HF.nec', 'ARG', YEAR) ?? 0
    const standard = engineOver(argentina, [
      { code: 'CHE', expression: 'HF.1 + HF.2 + HF.3 + HF.4 + HF.nec', nullPolicy: 'any-not-null' },
    ]).valueOf('CHE', 'ARG', YEAR)
    expect((arg.value ?? 0) + nec).toBeCloseTo(standard ?? 0, 6)

    // Canada is untouched by Argentina's customisation.
    expect(engine.evaluate('CHE', 'CAN', YEAR).usesCountryOverride).toBe(false)
  })
})

/* ==========================================================================
   Cycles
   ========================================================================== */

describe('a deliberate cycle in the seeded set', () => {
  it('is reported by name rather than hanging', () => {
    // Redefine CHE to read one of its own dependents — the mistake an
    // administrator could make in the formula editor.
    const broken = engineOver(canada, [
      ...SEEDED_FORMULAS.filter((f) => f.code !== 'CHE'),
      { code: 'CHE', expression: 'CHE%GDP_SHA2011 * GDP / 100', nullPolicy: 'any-not-null' },
    ])

    expect(broken.cycles.length).toBeGreaterThan(0)
    const path = broken.cycles[0] ?? []
    expect(new Set(path)).toEqual(new Set(['CHE', 'CHE%GDP_SHA2011']))

    const result = broken.evaluate('CHE', 'CAN', YEAR)
    expect(result.value).toBeNull()
    expect(result.error?.kind).toBe('cycle')
    expect(result.error?.message).toContain('CHE%GDP_SHA2011')
  })

  it('is caught by the editor before it can be saved', () => {
    const check = engine.validate('CHE%GDP_SHA2011 * GDP / 100', { code: 'CHE' })
    expect(check.ok).toBe(false)
    expect(check.cycle).not.toBeNull()
  })
})
