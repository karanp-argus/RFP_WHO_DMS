/**
 * Phase 6 acceptance — the delivered reports against the real seeded corpus.
 *
 * `domain/report/__tests__/report.test.ts` asks whether the pivot computes what
 * it claims on a fixture nobody can argue with. This asks the harder question:
 * run the shipped report definitions over the actual data, through the actual
 * `XMartClient` and the actual formula engine, and do they produce the tables
 * the demo shows.
 *
 * The load-bearing assertion is the third block. A pivot over `CHE%GDP_SHA2011`
 * must return the **engine's** number — `CHE / GDP * 100`, where `CHE` is itself
 * the sum of five `HF` children and carries an `all-not-null` guard. Nothing in
 * Phase 6 re-derives an indicator, and if something ever starts to, this is what
 * says so.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { FIRST_YEAR, LAST_YEAR, UNITS } from '@/domain/constants'
import {
  buildPivot,
  pivotToGrid,
  reportProblems,
  yearRange,
  type PivotTable,
  type ReportDataAccess,
  type ReportDefinition,
  type ReportPresentation,
} from '@/domain/report'
import type { FormulaEngine } from '@/domain/formula'
import { mockXMartClient } from '../xmart/mockClient'
import { buildReportAccess, reportFetchCodes } from '../report/reportAccess'
import { REPORT_DEMO_COUNTRIES, SEEDED_REPORTS, SEEDED_REPORT_BY_ID } from '../seed/reports'
import { COUNTRY_BY_ISO3 } from '../seed/countries'

let access: ReportDataAccess
let engine: FormulaEngine
let fetchedCodes: string[]

/** Every code the delivered reports read, in one fetch. */
const ALL_REPORT_CODES = [...new Set(SEEDED_REPORTS.flatMap((r) => r.variables))]

const NATIONAL: ReportPresentation = {
  unit: 'national',
  scale: 'millions',
  language: 'en',
  decimals: 1,
}

beforeAll(async () => {
  const [variables, countries, currencies, formulas] = await Promise.all([
    mockXMartClient.getVariables(),
    mockXMartClient.getCountries(),
    mockXMartClient.getCurrencies(),
    mockXMartClient.getFormulas(),
  ])

  fetchedCodes = reportFetchCodes(ALL_REPORT_CODES, variables, formulas)

  const page = await mockXMartClient.getObservations({
    countries: REPORT_DEMO_COUNTRIES,
    yearFrom: FIRST_YEAR,
    yearTo: LAST_YEAR,
    variables: fetchedCodes,
    pageSize: 5_000_000,
  })

  const reported = new Map<string, number | null>()
  for (const o of page.rows) {
    const dims = Object.values(o.dims).filter((v): v is string => v != null && v !== '')
    if (dims.length === 1 && dims[0]) reported.set(`${o.iso3}|${o.year}|${dims[0]}`, o.value)
  }

  const built = buildReportAccess({ reported, variables, countries, currencies, formulas })
  access = built.access
  engine = built.engine
}, 60_000)

function run(
  definition: ReportDefinition,
  options: {
    countries?: readonly string[]
    presentation?: ReportPresentation
    yearFrom?: number
    yearTo?: number
  } = {},
): PivotTable {
  const yearFrom = options.yearFrom ?? definition.yearFrom
  const yearTo = options.yearTo ?? definition.yearTo
  return buildPivot({
    definition,
    countries: options.countries ?? REPORT_DEMO_COUNTRIES,
    years: yearRange(yearFrom, yearTo),
    codes: definition.variables,
    presentation: options.presentation ?? definition.presentation,
    data: access,
  })
}

function report(id: string): ReportDefinition {
  const found = SEEDED_REPORT_BY_ID.get(id)
  if (!found) throw new Error(`No seeded report ${id}`)
  return found
}

/* ==========================================================================
   THE DELIVERED DEFINITIONS
   ========================================================================== */

describe('the delivered reports', () => {
  it('are all runnable as shipped', () => {
    for (const definition of SEEDED_REPORTS) {
      expect(reportProblems(definition), definition.name).toEqual([])
    }
  })

  it('name only codes the corpus can resolve', () => {
    for (const definition of SEEDED_REPORTS) {
      for (const code of definition.variables) {
        // Either a reported leaf, an aggregate, or a formula — all three are in
        // the engine's known-code set. A typo here would produce a blank column.
        expect(engine.knownCodes.has(code), `${definition.name} names ${code}`).toBe(true)
      }
    }
  })

  it('each produce a non-empty table over the demo countries', () => {
    for (const definition of SEEDED_REPORTS) {
      const table = run(definition, { countries: REPORT_DEMO_COUNTRIES.slice(0, 2) })
      expect(table.rows.length, definition.name).toBeGreaterThan(0)
      expect(table.columns.length, definition.name).toBeGreaterThan(0)
      expect(table.valuesRead, definition.name).toBeGreaterThan(0)
    }
  })
})

/* ==========================================================================
   THE FETCH
   ========================================================================== */

describe('what a run pulls from xMart', () => {
  it('expands aggregates and indicators to the leaves they are computed from', () => {
    // `CHE` is never stored — it is HF.1 + HF.2 + HF.3 + HF.4 + HF.nec, each of
    // which is itself a parent. Asking xMart for `CHE` would return nothing.
    expect(fetchedCodes).not.toContain('CHE')
    expect(fetchedCodes).toContain('HF.1.1')
    expect(fetchedCodes).toContain('HF.3.1')
  })

  it('always includes the exchange rate, so a currency switch needs no refetch', () => {
    expect(fetchedCodes).toContain('EXR')
    expect(fetchedCodes).toContain('POP')
  })

  it('does not pull the whole corpus to answer a report about a few codes', () => {
    // ~250 codes exist; the delivered reports between them read far fewer.
    expect(fetchedCodes.length).toBeLessThan(80)
  })
})

/* ==========================================================================
   THROUGH THE FORMULA ENGINE
   ========================================================================== */

describe('indicators resolve through the Phase 3 engine', () => {
  const CAN = 'CAN'
  const YEAR = 2020

  it('reads CHE%GDP from the engine rather than re-deriving it', () => {
    const definition: ReportDefinition = {
      ...report('rep-headline-indicators'),
      variables: ['CHE%GDP_SHA2011'],
      rows: [{ field: 'country', sort: 'asc', subtotal: false }],
      columns: [{ field: 'year', sort: 'asc', subtotal: false }],
      values: [{ id: 'v', label: 'Value', aggregation: 'sum' }],
    }
    const table = run(definition, {
      countries: [CAN],
      yearFrom: YEAR,
      yearTo: YEAR,
      presentation: NATIONAL,
    })

    const cell = table.cells[0]?.[0]
    const fromEngine = engine.valueOf('CHE%GDP_SHA2011', CAN, YEAR)
    expect(fromEngine).not.toBeNull()
    expect(cell?.value).toBeCloseTo(fromEngine as number, 9)
  })

  it('leaves a percentage unscaled whatever the scale selector says', () => {
    const definition: ReportDefinition = {
      ...report('rep-headline-indicators'),
      variables: ['CHE%GDP_SHA2011'],
      rows: [{ field: 'country', sort: 'asc', subtotal: false }],
      columns: [],
      values: [{ id: 'v', label: 'Value', aggregation: 'sum' }],
    }
    const millions = run(definition, {
      countries: [CAN],
      yearFrom: YEAR,
      yearTo: YEAR,
      presentation: NATIONAL,
    })
    const units = run(definition, {
      countries: [CAN],
      yearFrom: YEAR,
      yearTo: YEAR,
      presentation: { ...NATIONAL, scale: 'units' },
    })
    expect(units.cells[0]?.[0]?.value).toBe(millions.cells[0]?.[0]?.value)
    expect(millions.cells[0]?.[0]?.unit).toBe(UNITS.PERCENT)
  })

  it('produces economically plausible health shares of GDP', () => {
    const definition: ReportDefinition = {
      ...report('rep-headline-indicators'),
      variables: ['CHE%GDP_SHA2011'],
      rows: [{ field: 'country', sort: 'asc', subtotal: false }],
      columns: [],
      values: [{ id: 'v', label: 'Average', aggregation: 'average' }],
    }
    const table = run(definition, { yearFrom: 2015, yearTo: 2020, presentation: NATIONAL })
    for (const row of table.cells) {
      const value = row[0]?.value
      expect(value).not.toBeNull()
      // No country on earth spends 1% or 40% of GDP on health.
      expect(value as number).toBeGreaterThan(2)
      expect(value as number).toBeLessThan(25)
    }
  })
})

/* ==========================================================================
   CURRENCY — the guard that matters most on a multi-country report
   ========================================================================== */

describe('currency handling across countries', () => {
  const definition: ReportDefinition = {
    ...report('rep-oecd-usd'),
    rows: [{ field: 'region', sort: 'asc', subtotal: false }],
    columns: [],
    filters: [{ field: 'variableCode', values: ['CHE'], exclude: false }],
    variables: ['CHE'],
    yearFrom: 2020,
    yearTo: 2020,
  }

  it('refuses to add national currencies together', () => {
    // The five demo countries span five currencies, so every region containing
    // more than one of them has nothing honest to total.
    const table = run(definition, { presentation: NATIONAL })
    const mixed = table.cells.flat().filter((c) => c?.mixedUnits)
    const single = table.cells.flat().filter((c) => c && !c.mixedUnits && c.value != null)
    expect(mixed.length + single.length).toBeGreaterThan(0)
    for (const cell of mixed) expect(cell?.value).toBeNull()
    // A single-country region keeps its own currency as the unit label.
    for (const cell of single) expect(cell?.unit).toMatch(/ millions$/)
  })

  it('totals the same regions once converted to dollars', () => {
    const table = run(definition, { presentation: { ...NATIONAL, unit: 'usd' } })
    const cells = table.cells.flat().filter((c) => c != null)
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      expect(cell?.mixedUnits).toBe(false)
      if (cell?.value != null) expect(cell.unit).toBe('US$ millions')
    }
  })

  it('converts at the country-year exchange rate, not a global one', () => {
    const perCountry: ReportDefinition = {
      ...definition,
      rows: [{ field: 'country', sort: 'asc', subtotal: false }],
    }
    const national = run(perCountry, { presentation: NATIONAL })
    const usd = run(perCountry, { presentation: { ...NATIONAL, unit: 'usd' } })

    national.rows.forEach((row, i) => {
      const iso3 = row.path[0]
      if (!iso3) return
      const before = national.cells[i]?.[0]?.value
      const after = usd.cells[i]?.[0]?.value
      const rate = access.exchangeRate(iso3, 2020)
      if (before == null || after == null || rate == null) return
      expect(after).toBeCloseTo(before / rate, 6)
    })
  })
})

/* ==========================================================================
   SUBTOTALS OVER REAL DATA
   ========================================================================== */

describe('subtotals on a delivered report', () => {
  it('emits a region subtotal that equals the sum of its countries', () => {
    const definition: ReportDefinition = {
      ...report('rep-region-indicators'),
      variables: ['CHE%GDP_SHA2011'],
      columns: [],
      values: [{ id: 'v', label: 'Value', aggregation: 'sum' }],
      yearFrom: 2020,
      yearTo: 2020,
    }
    const table = run(definition, { presentation: NATIONAL })

    const subtotals = table.rows.filter((r) => r.kind === 'subtotal')
    expect(subtotals.length).toBeGreaterThan(0)

    for (const subtotal of subtotals) {
      const index = table.rows.indexOf(subtotal)
      const regionKey = subtotal.path[0]
      const members = table.rows.filter(
        (r) => r.kind === 'leaf' && r.path[0] === regionKey,
      )
      const expected = members.reduce((sum, member) => {
        const value = table.cells[table.rows.indexOf(member)]?.[0]?.value
        return value == null ? sum : sum + value
      }, 0)
      expect(table.cells[index]?.[0]?.value).toBeCloseTo(expected, 6)
    }
  })
})

/* ==========================================================================
   THE ACCEPTANCE BEAT — five countries, one file each
   ========================================================================== */

describe('the Phase 6 acceptance run', () => {
  it('produces a table per country for the five demo countries', () => {
    const definition = report('rep-hf-by-year')
    expect(definition.oneFilePerCountry).toBe(true)
    expect(REPORT_DEMO_COUNTRIES).toHaveLength(5)

    for (const iso3 of REPORT_DEMO_COUNTRIES) {
      const table = run(definition, { countries: [iso3] })
      expect(COUNTRY_BY_ISO3.has(iso3)).toBe(true)
      // Six HF rows, ten years (2015–2024).
      expect(table.rows).toHaveLength(definition.variables.length)
      expect(table.columns).toHaveLength(10)
      expect(table.valuesRead, iso3).toBeGreaterThan(0)
    }
  })

  it('writes an export grid whose shape matches the table', () => {
    const table = run(report('rep-hf-by-year'), { countries: ['CAN'] })
    const grid = pivotToGrid(table)
    expect(grid.leadingColumns).toBe(1)
    expect(grid.width).toBe(1 + table.columns.length)
    expect(grid.headerRows).toHaveLength(1)
    expect(grid.bodyRows).toHaveLength(table.rows.length)
    // Header labels are the years, repeated per column.
    expect(grid.headerRows[0]?.slice(1)).toEqual(table.columns.map((c) => c.node.label))
  })

  it('keeps a blank blank all the way into the export', () => {
    const table = run(report('rep-completeness'), { countries: ['CAN'] })
    const grid = pivotToGrid(table)
    // The completeness report counts, so no cell should be blank — a null here
    // would mean an intersection with no coordinates at all, which cannot
    // happen when every country-year-code combination is in scope.
    for (const row of grid.bodyRows) {
      for (const cell of row.slice(grid.leadingColumns)) {
        expect(cell).not.toBeNull()
      }
    }
  })
})

/* ==========================================================================
   UC039 — the data tracking report's source
   ========================================================================== */

describe('data tracking (UC039)', () => {
  it('returns import batches for every demo country', async () => {
    const batches = await mockXMartClient.getImportBatches(REPORT_DEMO_COUNTRIES)
    expect(batches.length).toBeGreaterThan(0)
    const covered = new Set(batches.map((b) => b.iso3))
    for (const iso3 of REPORT_DEMO_COUNTRIES) expect(covered.has(iso3)).toBe(true)

    for (const batch of batches) {
      expect(batch.rowCount).toBeGreaterThan(0)
      expect(batch.series).toMatch(/^\d{4} round$/)
      expect(new Date(batch.receivedUtc).getTime()).toBeLessThan(Date.parse('2026-08-01'))
    }
  })
})
