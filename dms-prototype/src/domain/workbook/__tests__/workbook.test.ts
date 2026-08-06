/**
 * Phase 4 — workbook domain tests.
 *
 * The UC031 axis constraint, the grid geometry it produces, the clipboard
 * format, the undo stack and the URL codec. All pure, so a failure here is a
 * logic failure and never a rendering one.
 */

import { describe, expect, it } from 'vitest'
import type { Variable } from '@/domain/types'
import {
  buildGridAxes,
  candidateTypes,
  canRedo,
  canUndo,
  cellCoordinate,
  clipFromTsv,
  decodeMetadata,
  decodeYears,
  emptySelection,
  emptyUndoState,
  encodeMetadata,
  encodeYears,
  forcedSingleAxis,
  multiAxes,
  parseNumber,
  parseTsv,
  planPaste,
  pushCommand,
  redo,
  resolveShape,
  selectionFromSearchParams,
  selectionToSearchParams,
  toTsv,
  undo,
  UNDO_LIMIT,
  yearRangeLabel,
  type Clip,
  type Command,
  type CountryLike,
  type WorkbookSelection,
} from '..'

/* --------------------------------------------------------------------------
   Fixtures
   -------------------------------------------------------------------------- */

const variable = (code: string, label: string, isCalculated = false): Variable => ({
  code,
  dimension: 'HF',
  label,
  labels: { en: label },
  parentCode: null,
  level: 1,
  isCalculated,
  isCurrency: true,
  unit: 'National Currency Unit (NCU) millions',
  sortKey: code,
})

const VARIABLES = new Map<string, Variable>([
  ['HF.1', variable('HF.1', 'Government schemes', true)],
  ['HF.1.1', variable('HF.1.1', 'Government schemes (central)')],
  ['HF.3', variable('HF.3', 'Household out-of-pocket payment', true)],
])

const COUNTRIES = new Map<string, CountryLike>([
  ['CAN', { CODE_ISO_3: 'CAN', NAME_SHORT_EN: 'Canada' }],
  ['KEN', { CODE_ISO_3: 'KEN', NAME_SHORT_EN: 'Kenya' }],
])

const sel = (over: Partial<WorkbookSelection> = {}): WorkbookSelection => ({
  ...emptySelection(),
  ...over,
})

/* ==========================================================================
   UC031 — exactly one axis is single-valued
   ========================================================================== */

describe('the UC031 axis constraint', () => {
  it('names a country workbook: one country, many variables, many years', () => {
    const { shape, problem } = resolveShape(
      sel({ countries: ['CAN'], variables: ['HF.1', 'HF.3'], years: [2020, 2021] }),
    )
    expect(problem).toBeNull()
    expect(shape?.type).toBe('country')
    // Years across the top, variables down the side — the legacy layout.
    expect(shape?.rowAxis).toBe('variable')
    expect(shape?.colAxis).toBe('year')
  })

  it('names a variable workbook: one variable, many countries, many years', () => {
    const { shape } = resolveShape(
      sel({ countries: ['CAN', 'KEN'], variables: ['HF.1'], years: [2020, 2021] }),
    )
    expect(shape?.type).toBe('variable')
    expect(shape?.rowAxis).toBe('country')
    expect(shape?.colAxis).toBe('year')
  })

  it('names a year workbook, which is the one that puts countries across the top', () => {
    const { shape } = resolveShape(
      sel({ countries: ['CAN', 'KEN'], variables: ['HF.1', 'HF.3'], years: [2020] }),
    )
    expect(shape?.type).toBe('year')
    expect(shape?.rowAxis).toBe('variable')
    expect(shape?.colAxis).toBe('country')
  })

  it('forces the third axis to single once two are multi', () => {
    expect(
      forcedSingleAxis(sel({ countries: ['CAN', 'KEN'], variables: ['HF.1', 'HF.3'], years: [] })),
    ).toBe('year')
    expect(
      forcedSingleAxis(sel({ countries: ['CAN', 'KEN'], variables: [], years: [2020, 2021] })),
    ).toBe('variable')
  })

  it('leaves every axis free while fewer than two are multi', () => {
    expect(forcedSingleAxis(sel({ countries: ['CAN'], variables: ['HF.1'], years: [2020] }))).toBeNull()
    expect(forcedSingleAxis(sel({ countries: ['CAN', 'KEN'] }))).toBeNull()
  })

  it('counts an axis with exactly one member as single, not multi', () => {
    expect(multiAxes(sel({ countries: ['CAN'], variables: ['HF.1', 'HF.3'], years: [2020, 2021] })))
      .toEqual(['variable', 'year'])
  })

  it('refuses a selection where all three axes are multi', () => {
    const { shape, problem } = resolveShape(
      sel({ countries: ['CAN', 'KEN'], variables: ['HF.1', 'HF.3'], years: [2020, 2021] }),
    )
    expect(shape).toBeNull()
    expect(problem?.reason).toBe('no-single-axis')
  })

  it('reports an incomplete selection rather than guessing', () => {
    const { problem } = resolveShape(sel({ countries: ['CAN'], variables: [], years: [2020] }))
    expect(problem?.reason).toBe('incomplete')
    expect(problem?.message).toContain('variable')
  })

  it('offers both readings when a selection is genuinely ambiguous', () => {
    // One country AND one variable: this is both a country and a variable workbook.
    const selection = sel({ countries: ['CAN'], variables: ['HF.1'], years: [2020, 2021] })
    expect(candidateTypes(selection)).toEqual(['country', 'variable'])
    // Unprompted it picks deterministically, so a URL round-trips…
    expect(resolveShape(selection).shape?.type).toBe('country')
    // …and an explicit choice is honoured.
    expect(resolveShape(selection, 'variable').shape?.type).toBe('variable')
  })
})

/* ==========================================================================
   Grid geometry
   ========================================================================== */

describe('grid axes', () => {
  const selection = sel({
    countries: ['CAN'],
    variables: ['HF.1', 'HF.1.1'],
    years: [2021, 2020, 2022],
  })
  const shape = resolveShape(selection).shape!

  it('puts variables down the side with their label and code', () => {
    const { rows } = buildGridAxes(selection, shape, VARIABLES, COUNTRIES)
    expect(rows.map((r) => r.code)).toEqual(['HF.1', 'HF.1.1'])
    expect(rows[0]?.label).toBe('Government schemes')
  })

  it('marks calculated rows, which is what makes them read-only and pink', () => {
    const { rows } = buildGridAxes(selection, shape, VARIABLES, COUNTRIES)
    expect(rows[0]?.isCalculated).toBe(true)
    expect(rows[1]?.isCalculated).toBe(false)
  })

  it('sorts years ascending however they were clicked', () => {
    const { columns } = buildGridAxes(selection, shape, VARIABLES, COUNTRIES)
    expect(columns.map((c) => c.key)).toEqual(['2020', '2021', '2022'])
  })

  it('maps a cell back to one country × one year × one variable', () => {
    expect(cellCoordinate(shape, selection, 'HF.1.1', '2021')).toEqual({
      iso3: 'CAN',
      year: 2021,
      code: 'HF.1.1',
    })
  })

  it('takes the missing axis from the single axis in a year workbook too', () => {
    // Two variables, so `year` is the only single axis and the reading is
    // unambiguous — with one variable this would also be a variable workbook.
    const yearSel = sel({ countries: ['CAN', 'KEN'], variables: ['HF.1', 'HF.3'], years: [2019] })
    const yearShape = resolveShape(yearSel).shape!
    expect(yearShape.type).toBe('year')
    expect(cellCoordinate(yearShape, yearSel, 'HF.1', 'KEN')).toEqual({
      iso3: 'KEN',
      year: 2019,
      code: 'HF.1',
    })
  })

  it('labels a contiguous year span as a range and a gappy one by count', () => {
    expect(yearRangeLabel([2000, 2001, 2002])).toBe('2000–2002')
    expect(yearRangeLabel([2000, 2005, 2010])).toBe('3 years')
    expect(yearRangeLabel([2015])).toBe('2015')
  })
})

/* ==========================================================================
   Clipboard
   ========================================================================== */

describe('clipboard', () => {
  const clip: Clip = {
    rows: 2,
    columns: 2,
    sourceLabel: 'Canada · HF · 2000–2024',
    cells: [
      [
        { value: 100, metadata: { SOURCES: 'NHA study' } },
        { value: null, formula: '=HF.1 + HF.2' },
      ],
      [
        { value: 300, formula: '=HF.3 * 2' },
        { value: null },
      ],
    ],
  }

  it('copies values as TSV, and a blank as empty rather than 0', () => {
    expect(toTsv(clip, 'values')).toBe('100\t\n300\t')
  })

  it('copies formulas where there is one and the value where there is not', () => {
    expect(toTsv(clip, 'formulas')).toBe('100\t=HF.1 + HF.2\n=HF.3 * 2\t')
  })

  it('copies metadata as key=value pairs in a stable field order', () => {
    expect(toTsv(clip, 'metadata')).toBe('SOURCES=NHA study\t\n\t')
  })

  it('round-trips metadata', () => {
    const md = { SOURCES: 'National Health Accounts', COMMENT: 'Provisional', DATA_TYPE: 'Reported' }
    expect(decodeMetadata(encodeMetadata(md))).toEqual(md)
  })

  it('drops unknown metadata keys rather than inventing fields', () => {
    expect(decodeMetadata('SOURCES=x; NOT_A_FIELD=y')).toEqual({ SOURCES: 'x' })
  })

  it('parses what Excel actually puts on the clipboard', () => {
    // CRLF line endings and a trailing newline.
    expect(parseTsv('1\t2\r\n3\t4\r\n')).toEqual([
      ['1', '2'],
      ['3', '4'],
    ])
  })

  it('pads ragged rows so paste geometry is predictable', () => {
    expect(parseTsv('1\t2\t3\n4')).toEqual([
      ['1', '2', '3'],
      ['4', '', ''],
    ])
  })

  it('reads spreadsheet-formatted numbers and refuses the rest', () => {
    expect(parseNumber('1,234.5')).toBe(1234.5)
    expect(parseNumber('  42 ')).toBe(42)
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('n/a')).toBeNull()
  })

  it('builds a clip from pasted text under each mode', () => {
    const values = clipFromTsv('10\t20\n30\t', 'values')
    expect(values.rows).toBe(2)
    expect(values.columns).toBe(2)
    expect(values.cells[0]?.[0]?.value).toBe(10)
    expect(values.cells[1]?.[1]?.value).toBeNull()

    const formulas = clipFromTsv('=HF.1+HF.2\t5', 'formulas')
    expect(formulas.cells[0]?.[0]?.formula).toBe('=HF.1+HF.2')
    expect(formulas.cells[0]?.[1]?.value).toBe(5)

    const meta = clipFromTsv('SOURCES=Survey', 'metadata')
    expect(meta.cells[0]?.[0]?.metadata).toEqual({ SOURCES: 'Survey' })
  })

  it('places a clip at the target and clips it to the grid edge', () => {
    const placements = planPaste(clip, { row: 1, column: 1 }, 3, 2)
    // Only (1,1) and (2,1) fit — column 2 is past the edge.
    expect(placements.map((p) => [p.row, p.column])).toEqual([
      [1, 1],
      [2, 1],
    ])
  })

  it('tiles a single copied cell across a selected range, as a spreadsheet does', () => {
    const one: Clip = { rows: 1, columns: 1, sourceLabel: 'x', cells: [[{ value: 7 }]] }
    const placements = planPaste(one, { row: 0, column: 0 }, 10, 10, 2, 3)
    expect(placements).toHaveLength(6)
    expect(placements.every((p) => p.cell.value === 7)).toBe(true)
  })
})

/* ==========================================================================
   Undo / redo
   ========================================================================== */

describe('undo stack', () => {
  const command = (label: string, key = 'CAN-2020#HF=HF.1'): Command => ({
    label,
    changes: [{ observationKey: key, before: { value: 1 }, after: { value: 2 } }],
  })

  it('starts empty and reports so', () => {
    const s = emptyUndoState()
    expect(canUndo(s)).toBe(false)
    expect(canRedo(s)).toBe(false)
    expect(undo(s)).toBeNull()
    expect(redo(s)).toBeNull()
  })

  it('ignores a command that changed nothing', () => {
    const s = pushCommand(emptyUndoState(), { label: 'noop', changes: [] })
    expect(canUndo(s)).toBe(false)
  })

  it('hands back the before-snapshots on undo and the after-snapshots on redo', () => {
    const pushed = pushCommand(emptyUndoState(), command('edit'))
    const undone = undo(pushed)
    expect(undone?.apply[0]?.snapshot).toEqual({ value: 1 })
    expect(canRedo(undone!.state)).toBe(true)

    const redone = redo(undone!.state)
    expect(redone?.apply[0]?.snapshot).toEqual({ value: 2 })
    expect(canUndo(redone!.state)).toBe(true)
  })

  it('drops the redo branch once a new command is recorded', () => {
    const undone = undo(pushCommand(emptyUndoState(), command('first')))!
    expect(canRedo(undone.state)).toBe(true)
    const after = pushCommand(undone.state, command('second'))
    expect(canRedo(after)).toBe(false)
  })

  it('stays bounded, discarding the oldest commands', () => {
    let s = emptyUndoState()
    for (let i = 0; i < UNDO_LIMIT + 10; i++) s = pushCommand(s, command(`edit ${i}`))
    expect(s.past).toHaveLength(UNDO_LIMIT)
    expect(s.past[0]?.label).toBe('edit 10')
  })
})

/* ==========================================================================
   URL round-trip — §2.4 makes a workbook selection a shareable link
   ========================================================================== */

describe('URL serialisation', () => {
  it('collapses a contiguous year span and expands it back', () => {
    const years = Array.from({ length: 25 }, (_, i) => 2000 + i)
    expect(encodeYears(years)).toBe('2000-2024')
    expect(decodeYears('2000-2024')).toEqual(years)
  })

  it('lists years individually when they are not contiguous', () => {
    expect(encodeYears([2000, 2005, 2010])).toBe('2000,2005,2010')
    expect(decodeYears('2000,2005,2010')).toEqual([2000, 2005, 2010])
  })

  it('round-trips a whole selection including filters', () => {
    const selection = sel({
      countries: ['CAN'],
      variables: ['HF.1', 'HF.3'],
      years: [2000, 2001, 2002],
      filters: [
        { axis: 'country', key: 'GRP_WHO_REGION', label: 'WHO region', values: ['EUR', 'AMR'] },
      ],
    })
    const params = selectionToSearchParams(selection, 'country')
    const parsed = selectionFromSearchParams(params)

    expect(parsed.type).toBe('country')
    expect(parsed.selection.countries).toEqual(['CAN'])
    expect(parsed.selection.variables).toEqual(['HF.1', 'HF.3'])
    expect(parsed.selection.years).toEqual([2000, 2001, 2002])
    expect(parsed.selection.filters).toEqual([
      { axis: 'country', key: 'GRP_WHO_REGION', label: 'GRP_WHO_REGION', values: ['EUR', 'AMR'] },
    ])
  })

  it('keeps the link readable', () => {
    const params = selectionToSearchParams(
      sel({ countries: ['CAN'], variables: ['HF.1'], years: [2000, 2001, 2002, 2003] }),
      'country',
    )
    expect(decodeURIComponent(params.toString())).toBe('c=CAN&v=HF.1&y=2000-2003&type=country')
  })

  it('opens what it can from a truncated or hand-written link', () => {
    const parsed = selectionFromSearchParams(new URLSearchParams('c=CAN&y=2020&f=garbage'))
    expect(parsed.selection.countries).toEqual(['CAN'])
    expect(parsed.selection.years).toEqual([2020])
    expect(parsed.selection.filters).toEqual([])
    expect(parsed.type).toBeNull()
  })

  it('drops a filter naming an axis that does not exist', () => {
    const parsed = selectionFromSearchParams(new URLSearchParams('f=planet:X:1&f=country:K:v'))
    expect(parsed.selection.filters.map((f) => f.axis)).toEqual(['country'])
  })
})
