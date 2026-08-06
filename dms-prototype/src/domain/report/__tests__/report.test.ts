/**
 * Phase 6 — the pivot engine.
 *
 * The fixture is four countries × three years × three codes, hand-written so
 * every expected total can be checked by eye. Two of the codes are money in
 * national currency and one is a percentage, which is what makes the
 * unit-mixing and conversion cases testable at all.
 */

import { describe, expect, it } from 'vitest'
import { UNITS } from '@/domain/constants'
import {
  buildPivot,
  DEFAULT_PRESENTATION,
  duplicateReport,
  emptyReport,
  fieldsBySource,
  pivotToGrid,
  placement,
  presentValue,
  REPORT_FIELDS,
  reportProblems,
  shouldRunInBackground,
  yearRange,
  type PivotTable,
  type ReportDataAccess,
  type ReportDefinition,
  type ReportPresentation,
} from '@/domain/report'

/* --------------------------------------------------------------------------
   Fixture
   -------------------------------------------------------------------------- */

const COUNTRIES = ['AAA', 'BBB', 'CCC', 'DDD'] as const
const YEARS = [2020, 2021, 2022]
const CODES = ['HF.1', 'HF.2', 'SHARE'] as const

const REGION: Record<string, string> = { AAA: 'EUR', BBB: 'EUR', CCC: 'AFR', DDD: 'AFR' }
const NAME: Record<string, string> = {
  AAA: 'Alphaland',
  BBB: 'Betaland',
  CCC: 'Gammaland',
  DDD: 'Deltaland',
}

/** NCU per US$. `DDD` has none, which is the unconvertible case. */
const EXR: Record<string, number | null> = { AAA: 2, BBB: 4, CCC: 10, DDD: null }

/** Two of the four share a currency, which is what makes the mixing case real. */
const CURRENCY: Record<string, string> = { AAA: 'ALF', BBB: 'ALF', CCC: 'GAM', DDD: 'DEL' }

/**
 * Values are a simple function of the coordinate so every total below can be
 * derived on paper: index-of-country + year offset + code weight.
 */
function seededValue(iso3: string, year: number, code: string): number | null {
  const ci = COUNTRIES.indexOf(iso3 as (typeof COUNTRIES)[number])
  if (ci < 0) return null
  // One deliberate hole, so blanks are exercised rather than assumed.
  if (iso3 === 'BBB' && year === 2021 && code === 'HF.2') return null
  const weight = code === 'HF.1' ? 100 : code === 'HF.2' ? 10 : 1
  return (ci + 1) * weight + (year - 2020)
}

const UNIT_OF: Record<string, string> = {
  'HF.1': UNITS.NCU_MILLIONS,
  'HF.2': UNITS.NCU_MILLIONS,
  SHARE: UNITS.PERCENT,
}

const access: ReportDataAccess = {
  valueOf: seededValue,
  fieldKey: (field, c) => {
    switch (field) {
      case 'iso3':
        return c.iso3
      case 'country':
        return c.iso3
      case 'region':
        return REGION[c.iso3] ?? 'Unknown'
      case 'year':
        return String(c.year)
      case 'variableCode':
      case 'variable':
        return c.code
      case 'unit':
        return UNIT_OF[c.code] ?? 'Unknown'
      default:
        return 'Unknown'
    }
  },
  fieldLabel: (field, key) => (field === 'country' ? (NAME[key] ?? key) : key),
  unitOf: (code) => UNIT_OF[code] ?? UNITS.COUNT,
  exchangeRate: (iso3) => EXR[iso3] ?? null,
  currencyOf: (iso3) => CURRENCY[iso3] ?? '',
}

/** Scale `units` keeps the arithmetic on paper: a stored 1 becomes 1,000,000. */
const RAW: ReportPresentation = { ...DEFAULT_PRESENTATION, scale: 'millions', unit: 'national' }

function definition(overrides: Partial<ReportDefinition> = {}): ReportDefinition {
  return { ...emptyReport('r1', 'tester@who.int', '2026-08-01T09:00:00.000Z'), ...overrides }
}

function run(def: ReportDefinition, presentation = RAW, codes: readonly string[] = CODES) {
  return buildPivot({
    definition: def,
    countries: COUNTRIES,
    years: YEARS,
    codes,
    presentation,
    data: access,
  })
}

/** Look a cell up by the labels a reader would use, rather than by index. */
function cellAt(table: PivotTable, rowLabel: string, columnLabel: string, valueId?: string) {
  const r = table.rows.findIndex((row) => row.label === rowLabel)
  const c = table.columns.findIndex(
    (col) => col.node.label === columnLabel && (valueId == null || col.value.id === valueId),
  )
  expect(r, `row "${rowLabel}"`).toBeGreaterThanOrEqual(0)
  expect(c, `column "${columnLabel}"`).toBeGreaterThanOrEqual(0)
  return table.cells[r]?.[c] ?? null
}

/* --------------------------------------------------------------------------
   Axes
   -------------------------------------------------------------------------- */

describe('pivot axes', () => {
  it('puts rows down the side and columns across the top', () => {
    const table = run(
      definition({ rows: [placement('country')], columns: [placement('year')] }),
    )
    // Ordered by the field's key — the ISO3 code — not by the display label.
    expect(table.rows.map((r) => r.label)).toEqual([
      'Alphaland',
      'Betaland',
      'Gammaland',
      'Deltaland',
    ])
    expect(table.columnNodes.map((c) => c.label)).toEqual(['2020', '2021', '2022'])
    expect(table.columns).toHaveLength(3)
  })

  it('sorts years numerically, not lexically', () => {
    const table = buildPivot({
      definition: definition({ rows: [placement('year')], columns: [] }),
      countries: ['AAA'],
      years: [2009, 2010, 2011, 1999],
      codes: ['HF.1'],
      presentation: RAW,
      data: access,
    })
    expect(table.rows.map((r) => r.label)).toEqual(['1999', '2009', '2010', '2011'])
  })

  it('honours a descending sort', () => {
    const table = run(
      definition({ rows: [placement('year', { sort: 'desc' })], columns: [] }),
    )
    expect(table.rows.map((r) => r.label)).toEqual(['2022', '2021', '2020'])
  })

  it('gives an axis with no fields a single implicit member', () => {
    const table = run(definition({ rows: [placement('country')], columns: [] }))
    expect(table.columnNodes).toHaveLength(1)
    expect(table.columnNodes[0]?.label).toBe('All')
  })

  it('nests a second row field inside the first', () => {
    const table = run(
      definition({
        rows: [placement('region'), placement('country')],
        columns: [],
      }),
    )
    // AFR before EUR, and countries nested within each.
    expect(table.rows.map((r) => r.pathLabels.join('/'))).toEqual([
      'AFR/Gammaland',
      'AFR/Deltaland',
      'EUR/Alphaland',
      'EUR/Betaland',
    ])
  })
})

/* --------------------------------------------------------------------------
   Aggregation
   -------------------------------------------------------------------------- */

describe('aggregation', () => {
  it('sums the observations behind a cell', () => {
    const table = run(
      definition({
        rows: [placement('country')],
        columns: [placement('year')],
        filters: [{ field: 'variableCode', values: ['HF.1'], exclude: false }],
      }),
    )
    // Alphaland 2020, HF.1 only: (0+1)*100 + 0 = 100.
    expect(cellAt(table, 'Alphaland', '2020')?.value).toBe(100)
    // Gammaland 2022: (2+1)*100 + 2 = 302.
    expect(cellAt(table, 'Gammaland', '2022')?.value).toBe(302)
  })

  it('averages, mins and maxes off the same accumulator', () => {
    const def = definition({
      rows: [placement('country')],
      columns: [],
      filters: [{ field: 'variableCode', values: ['HF.2'], exclude: false }],
      values: [
        { id: 'v-sum', label: 'Sum', aggregation: 'sum' },
        { id: 'v-avg', label: 'Average', aggregation: 'average' },
        { id: 'v-min', label: 'Min', aggregation: 'min' },
        { id: 'v-max', label: 'Max', aggregation: 'max' },
        { id: 'v-n', label: 'Values', aggregation: 'count' },
      ],
    })
    const table = run(def)
    // Alphaland HF.2 across 2020–2022: 10, 11, 12.
    expect(cellAt(table, 'Alphaland', 'All', 'v-sum')?.value).toBe(33)
    expect(cellAt(table, 'Alphaland', 'All', 'v-avg')?.value).toBe(11)
    expect(cellAt(table, 'Alphaland', 'All', 'v-min')?.value).toBe(10)
    expect(cellAt(table, 'Alphaland', 'All', 'v-max')?.value).toBe(12)
    expect(cellAt(table, 'Alphaland', 'All', 'v-n')?.value).toBe(3)
  })

  it('reports a blank, not a zero, when nothing in the group had a value', () => {
    const table = run(
      definition({
        rows: [placement('country')],
        columns: [placement('year')],
        filters: [{ field: 'variableCode', values: ['HF.2'], exclude: false }],
      }),
    )
    const hole = cellAt(table, 'Betaland', '2021')
    expect(hole?.value).toBeNull()
    expect(hole?.count).toBe(0)
    expect(hole?.blanks).toBe(1)
  })

  it('still counts zero for a count aggregation, because that is the answer', () => {
    const table = run(
      definition({
        rows: [placement('country')],
        columns: [placement('year')],
        filters: [{ field: 'variableCode', values: ['HF.2'], exclude: false }],
        values: [{ id: 'v-n', label: 'Values', aggregation: 'count' }],
      }),
    )
    expect(cellAt(table, 'Betaland', '2021')?.value).toBe(0)
  })

  it('refuses to total a group that mixed units', () => {
    // No variable filter: HF.1 and HF.2 are NCU millions, SHARE is a percent.
    const table = run(definition({ rows: [placement('country')], columns: [] }))
    const cell = cellAt(table, 'Alphaland', 'All')
    expect(cell?.mixedUnits).toBe(true)
    expect(cell?.value).toBeNull()
    expect(cell?.unit).toBeNull()
  })

  it('keeps a single-unit group totalled and labelled in the country currency', () => {
    const table = run(
      definition({
        rows: [placement('country')],
        columns: [],
        filters: [{ field: 'unit', values: [UNITS.NCU_MILLIONS], exclude: false }],
      }),
    )
    const cell = cellAt(table, 'Alphaland', 'All')
    expect(cell?.mixedUnits).toBe(false)
    expect(cell?.unit).toBe('ALF millions')
  })

  /**
   * The failure this guard exists for. Left in national currency, a total
   * across countries would be adding one currency to another — and with an
   * anonymous "NCU" label it would look perfectly reasonable on the page.
   */
  it('refuses a national-currency total across two different currencies', () => {
    const table = run(
      definition({
        rows: [placement('region')],
        columns: [],
        filters: [{ field: 'unit', values: [UNITS.NCU_MILLIONS], exclude: false }],
      }),
    )
    // AFR is Gammaland (GAM) and Deltaland (DEL) — two currencies, no total.
    expect(cellAt(table, 'AFR', 'All')?.mixedUnits).toBe(true)
    expect(cellAt(table, 'AFR', 'All')?.value).toBeNull()
    // EUR is Alphaland and Betaland, both ALF — one currency, a real total.
    expect(cellAt(table, 'EUR', 'All')?.mixedUnits).toBe(false)
    expect(cellAt(table, 'EUR', 'All')?.unit).toBe('ALF millions')
  })

  it('lets the same total through once converted to a common currency', () => {
    const table = run(
      definition({
        rows: [placement('region')],
        columns: [],
        filters: [
          { field: 'unit', values: [UNITS.NCU_MILLIONS], exclude: false },
          { field: 'region', values: ['AFR'], exclude: false },
          { field: 'variableCode', values: ['HF.1'], exclude: false },
          { field: 'year', values: ['2020'], exclude: false },
        ],
      }),
      { ...RAW, unit: 'usd' },
    )
    // Only Gammaland converts (Deltaland has no rate): 300 / 10 = 30.
    expect(cellAt(table, 'AFR', 'All')?.value).toBeCloseTo(30)
    expect(cellAt(table, 'AFR', 'All')?.unit).toBe('US$ millions')
  })
})

/* --------------------------------------------------------------------------
   Subtotals and totals — plan §Phase 6.1's "with subtotals"
   -------------------------------------------------------------------------- */

describe('subtotals', () => {
  /**
   * `SHARE` rather than an expenditure code on purpose: a percentage carries
   * the same unit in every country, so the totals below exercise the subtotal
   * logic rather than the currency guard, which has its own tests above.
   */
  const def = definition({
    rows: [placement('region', { subtotal: true }), placement('country')],
    columns: [],
    filters: [{ field: 'variableCode', values: ['SHARE'], exclude: false }],
    grandTotal: true,
  })

  it('emits a subtotal line after each group and a grand total at the end', () => {
    const table = run(def)
    expect(table.rows.map((r) => `${r.kind}:${r.label}`)).toEqual([
      'leaf:Gammaland',
      'leaf:Deltaland',
      'subtotal:AFR — total',
      'leaf:Alphaland',
      'leaf:Betaland',
      'subtotal:EUR — total',
      'grand-total:Grand total',
    ])
  })

  it('totals the leaves beneath it rather than the line above', () => {
    const table = run(def)
    // AFR = Gammaland (3+4+5) + Deltaland (4+5+6) = 12 + 15.
    expect(cellAt(table, 'AFR — total', 'All')?.value).toBe(27)
    // Grand total adds EUR: Alphaland 6 + Betaland 9 = 15 → 42.
    expect(cellAt(table, 'Grand total', 'All')?.value).toBe(42)
  })

  /**
   * The EUR group is the discriminating case: Alphaland reports HF.2 three
   * times and Betaland twice, so an average of the two country averages is a
   * different number from the average of the five values. A subtotal that
   * quietly averaged the lines above it would pass every equal-sized test.
   */
  it('computes an average subtotal over the leaves, not over the subgroup means', () => {
    const table = run(
      definition({
        rows: [placement('region', { subtotal: true }), placement('country')],
        columns: [],
        filters: [
          { field: 'variableCode', values: ['HF.2'], exclude: false },
          { field: 'region', values: ['EUR'], exclude: false },
        ],
        values: [{ id: 'v-avg', label: 'Average', aggregation: 'average' }],
      }),
    )
    // Five values: 10, 11, 12, 20, 22 → 75/5 = 15.
    expect(cellAt(table, 'EUR — total', 'All')?.value).toBe(15)
    // Averaging the country means (11 and 21) would give 16.
    expect(cellAt(table, 'Alphaland', 'All')?.value).toBe(11)
    expect(cellAt(table, 'Betaland', 'All')?.value).toBe(21)
  })

  it('does not emit a subtotal on the innermost field, where it would repeat the line', () => {
    const table = run(
      definition({
        rows: [placement('region'), placement('country', { subtotal: true })],
        columns: [],
        filters: [{ field: 'variableCode', values: ['HF.1'], exclude: false }],
      }),
    )
    expect(table.rows.every((r) => r.kind === 'leaf')).toBe(true)
  })
})

/* --------------------------------------------------------------------------
   Filters
   -------------------------------------------------------------------------- */

describe('filters', () => {
  it('keeps only matching coordinates', () => {
    const table = run(
      definition({
        rows: [placement('country')],
        columns: [],
        filters: [{ field: 'region', values: ['EUR'], exclude: false }],
      }),
    )
    expect(table.rows.map((r) => r.label)).toEqual(['Alphaland', 'Betaland'])
  })

  it('excludes when asked to', () => {
    const table = run(
      definition({
        rows: [placement('country')],
        columns: [],
        filters: [{ field: 'region', values: ['EUR'], exclude: true }],
      }),
    )
    expect(table.rows.map((r) => r.label)).toEqual(['Gammaland', 'Deltaland'])
  })

  it('ANDs several filters together', () => {
    const table = run(
      definition({
        rows: [placement('country')],
        columns: [placement('year')],
        filters: [
          { field: 'region', values: ['AFR'], exclude: false },
          { field: 'year', values: ['2021'], exclude: false },
        ],
      }),
    )
    expect(table.rows).toHaveLength(2)
    expect(table.columnNodes.map((c) => c.label)).toEqual(['2021'])
  })

  it('ignores a filter with no values rather than excluding everything', () => {
    const table = run(
      definition({
        rows: [placement('country')],
        columns: [],
        filters: [{ field: 'region', values: [], exclude: false }],
      }),
    )
    expect(table.rows).toHaveLength(4)
  })
})

/* --------------------------------------------------------------------------
   Units, currency and scale
   -------------------------------------------------------------------------- */

describe('presentation', () => {
  it('converts national currency to dollars before aggregating', () => {
    const usd: ReportPresentation = { ...RAW, unit: 'usd' }
    const table = run(
      definition({
        rows: [placement('region')],
        columns: [],
        filters: [
          { field: 'variableCode', values: ['HF.1'], exclude: false },
          { field: 'year', values: ['2020'], exclude: false },
        ],
      }),
      usd,
    )
    // EUR = Alphaland 100/2 + Betaland 200/4 = 50 + 50 = 100.
    expect(cellAt(table, 'EUR', 'All')?.value).toBeCloseTo(100)
    expect(cellAt(table, 'EUR', 'All')?.unit).toBe('US$ millions')
  })

  it('counts a value it cannot convert separately from a blank', () => {
    const usd: ReportPresentation = { ...RAW, unit: 'usd' }
    const table = run(
      definition({
        rows: [placement('country')],
        columns: [],
        filters: [{ field: 'variableCode', values: ['HF.1'], exclude: false }],
      }),
      usd,
    )
    // Deltaland has no exchange rate: reported, but not expressible in dollars.
    const cell = cellAt(table, 'Deltaland', 'All')
    expect(cell?.value).toBeNull()
    expect(cell?.unconverted).toBe(3)
    expect(table.unconverted).toBe(3)
  })

  it('rescales monetary values and leaves percentages alone', () => {
    const asUnits: ReportPresentation = { ...RAW, scale: 'units' }
    const money = presentValue(1, UNITS.NCU_MILLIONS, asUnits, null, 'ALF')
    expect(money.ok && money.presented.value).toBe(1_000_000)
    expect(money.ok && money.presented.unit).toBe('ALF units')
    const percent = presentValue(12.5, UNITS.PERCENT, asUnits, null, 'ALF')
    expect(percent.ok && percent.presented.value).toBe(12.5)
    expect(percent.ok && percent.presented.unit).toBe(UNITS.PERCENT)
  })

  it('refuses a dollar conversion with no exchange rate', () => {
    const usd: ReportPresentation = { ...RAW, unit: 'usd' }
    const out = presentValue(100, UNITS.NCU_MILLIONS, usd, null, 'ALF')
    expect(out.ok).toBe(false)
    expect(!out.ok && out.reason).toBe('no-exchange-rate')
  })
})

/* --------------------------------------------------------------------------
   Budgets
   -------------------------------------------------------------------------- */

describe('budgets', () => {
  it('stops at the coordinate budget and says so', () => {
    const table = buildPivot({
      definition: definition({ rows: [placement('country')], columns: [] }),
      countries: COUNTRIES,
      years: YEARS,
      codes: CODES,
      presentation: RAW,
      data: access,
      maxCoordinates: 5,
    })
    expect(table.truncated).toBe(true)
    expect(table.truncationNote).toContain('Stopped after')
    expect(table.coordinatesRead).toBe(5)
  })

  it('drops rows at the cell budget rather than ending the table silently', () => {
    const table = buildPivot({
      definition: definition({ rows: [placement('country')], columns: [placement('year')] }),
      countries: COUNTRIES,
      years: YEARS,
      codes: CODES,
      presentation: RAW,
      data: access,
      maxCells: 6,
    })
    expect(table.truncated).toBe(true)
    expect(table.rows).toHaveLength(2)
    expect(table.truncationNote).toContain('rows are not shown')
  })
})

/* --------------------------------------------------------------------------
   Flat form
   -------------------------------------------------------------------------- */

describe('pivotToGrid', () => {
  it('writes one header row per column level and repeats the labels', () => {
    const table = run(
      definition({
        rows: [placement('country')],
        columns: [placement('year')],
        filters: [{ field: 'variableCode', values: ['HF.1'], exclude: false }],
      }),
    )
    const grid = pivotToGrid(table)
    expect(grid.headerRows).toHaveLength(1)
    expect(grid.headerRows[0]).toEqual(['Country', '2020', '2021', '2022'])
    expect(grid.bodyRows[0]).toEqual(['Alphaland', 100, 101, 102])
    expect(grid.width).toBe(4)
    expect(grid.leadingColumns).toBe(1)
  })

  it('adds a value row when there is more than one value field', () => {
    const table = run(
      definition({
        rows: [placement('country')],
        columns: [placement('year')],
        filters: [{ field: 'variableCode', values: ['HF.1'], exclude: false }],
        values: [
          { id: 'v-sum', label: 'Sum', aggregation: 'sum' },
          { id: 'v-n', label: 'Values', aggregation: 'count' },
        ],
      }),
    )
    const grid = pivotToGrid(table)
    expect(grid.headerRows).toHaveLength(2)
    expect(grid.headerRows[0]).toEqual(['', '2020', '2020', '2021', '2021', '2022', '2022'])
    expect(grid.headerRows[1]).toEqual([
      'Country',
      'Sum',
      'Values',
      'Sum',
      'Values',
      'Sum',
      'Values',
    ])
  })

  it('carries blanks through as null, never as zero', () => {
    const table = run(
      definition({
        rows: [placement('country')],
        columns: [placement('year')],
        filters: [{ field: 'variableCode', values: ['HF.2'], exclude: false }],
      }),
    )
    const grid = pivotToGrid(table)
    const beta = grid.bodyRows.find((r) => r[0] === 'Betaland')
    expect(beta).toEqual(['Betaland', 20, null, 22])
  })
})

/* --------------------------------------------------------------------------
   Definitions
   -------------------------------------------------------------------------- */

describe('report definitions', () => {
  it('rejects a definition with no value field', () => {
    const problems = reportProblems(definition({ values: [] }))
    expect(problems.some((p) => p.includes('Values'))).toBe(true)
  })

  it('rejects the same field on both axes', () => {
    const problems = reportProblems(
      definition({ rows: [placement('year')], columns: [placement('year')] }),
    )
    expect(problems.some((p) => p.includes('only sit on one axis'))).toBe(true)
  })

  it('accepts the seeded shape', () => {
    expect(reportProblems(definition({ name: 'Test' }))).toEqual([])
  })

  it('makes a copy custom and owned by the copier, even from a predefined report', () => {
    const source = definition({
      scope: 'predefined',
      createdBy: 'admin@who.int',
      isDelivered: true,
    })
    const copy = duplicateReport(source, 'r2', 'regular@who.int', '2026-08-02T00:00:00.000Z')
    expect(copy.scope).toBe('custom')
    expect(copy.createdBy).toBe('regular@who.int')
    expect(copy.isDelivered).toBe(false)
    expect(copy.name).toBe(`${source.name} (copy)`)
    // Deeply copied, so editing the copy cannot reach back into the original.
    copy.rows.push(placement('region'))
    expect(source.rows).toHaveLength(1)
  })
})

/* --------------------------------------------------------------------------
   UC042 — what goes to the background queue
   -------------------------------------------------------------------------- */

describe('background routing (UC042)', () => {
  const params = {
    countries: ['AAA'],
    variables: ['HF.1'],
    yearFrom: 2020,
    yearTo: 2022,
    presentation: RAW,
    delivery: 'screen' as const,
    language: 'en' as const,
  }

  it('keeps a small on-screen run in the foreground', () => {
    expect(shouldRunInBackground(definition(), params).background).toBe(false)
  })

  it('sends a per-country file run to the background', () => {
    const outcome = shouldRunInBackground(definition({ oneFilePerCountry: true }), {
      ...params,
      countries: ['AAA', 'BBB', 'CCC', 'DDD', 'EEE'],
    })
    expect(outcome.background).toBe(true)
    expect(outcome.reason).toContain('5 files')
  })

  it('sends a report its author flagged heavy to the background', () => {
    expect(shouldRunInBackground(definition({ isHeavy: true }), params).background).toBe(true)
  })

  it('sends a run with too many coordinates to the background', () => {
    const outcome = shouldRunInBackground(definition(), {
      ...params,
      countries: Array.from({ length: 60 }, (_, i) => `C${i}`),
      variables: Array.from({ length: 60 }, (_, i) => `V${i}`),
      yearFrom: 2000,
      yearTo: 2024,
    })
    expect(outcome.background).toBe(true)
  })
})

describe('yearRange', () => {
  it('is inclusive', () => {
    expect(yearRange(2020, 2022)).toEqual([2020, 2021, 2022])
  })

  it('yields nothing for a reversed range rather than looping', () => {
    expect(yearRange(2022, 2020)).toEqual([])
  })
})

/**
 * A guard on the field catalogue: the builder's palette is rendered from
 * `fieldsBySource`, so a field missing from it would exist in saved definitions
 * and be unreachable in the UI that maintains them.
 */
describe('field catalogue', () => {
  it('offers every field in the builder palette, exactly once', () => {
    const offered = fieldsBySource().flatMap((g) => g.fields.map((f) => f.id))
    expect(new Set(offered).size).toBe(offered.length)
    expect([...offered].sort()).toEqual([...REPORT_FIELDS].sort())
  })
})
