/**
 * The pivot engine.
 *
 * UC036 asks for a report built *"by selecting rows, columns, values, filters
 * and groupings, similar to Excel Pivot Tables"*. That sentence is the whole
 * specification, and this file is the whole implementation of it: an
 * observation stream in, a two-dimensional table of aggregated cells out, with
 * subtotal lines wherever a placed field asked for one.
 *
 * Pure, like `domain/qc/runner.ts` and for the same reason: it reads every
 * value through a `ReportDataAccess` closure rather than fetching. One
 * implementation therefore serves the run page (a scope pulled from xMart), the
 * builder's live preview (a small sample), the background job queue (one
 * country at a time) and the unit tests (a handful of `Map`s), with no branch
 * anywhere for which of the four it is.
 *
 * Four things worth stating before reading the code:
 *
 *  · **Every value goes through the formula engine, not the raw fetch.** The
 *    access closure is built over the engine, so a pivot over `CHE%GDP` gets
 *    the engine's answer — the aggregate `CHE`, the `GDP` denominator and the
 *    `all-not-null` guard included. Nothing here re-derives an indicator.
 *
 *  · **A blank is never a zero.** An aggregate over no values is `null`, and
 *    that survives into the export. `count` is the deliberate exception: zero
 *    values *is* the answer to "how many did they report".
 *
 *  · **Conversion happens before aggregation** — see `units.ts`. A cell whose
 *    contributions ended up in incompatible units produces no number at all
 *    rather than a plausible-looking sum of percentages and pesos.
 *
 *  · **Nothing is silently capped.** A run has a coordinate budget and a cell
 *    budget, and hitting either sets `truncated` so the report can say what it
 *    did not reach.
 */

import { REPORT_FIELD_DEFS, type ReportFieldId } from './fields'
import {
  type ReportAggregation,
  type ReportDefinition,
  type ReportFieldPlacement,
  type ReportFilter,
  type ReportValueField,
} from './definition'
import { presentValue, type ReportPresentation } from './units'
import {
  ENGLISH_VOCABULARY,
  fieldHeading,
  fillTemplate,
  type ReportVocabulary,
} from './vocabulary'

/* ==========================================================================
   THE DATA DOOR
   ========================================================================== */

export interface ReportCoordinate {
  iso3: string
  year: number
  code: string
}

/**
 * Everything the pivot may ask about the corpus.
 *
 * Deliberately narrow and synchronous: the caller does the fetching and hands
 * over a value-shaped view, so a pivot is a pure function of its inputs.
 */
export interface ReportDataAccess {
  /** Value at a coordinate — reported, aggregated or computed by the engine. */
  valueOf(iso3: string, year: number, code: string): number | null
  /** The key a coordinate groups under for one field. Never empty. */
  fieldKey(field: ReportFieldId, coordinate: ReportCoordinate): string
  /** Human label for a key produced by `fieldKey`. */
  fieldLabel(field: ReportFieldId, key: string): string
  /** Unit of measure for a variable code, e.g. `National Currency Unit (NCU) millions`. */
  unitOf(code: string): string
  /** `EXR` — national currency per US$ — at a country and year. */
  exchangeRate(iso3: string, year: number): number | null
  /** The country's own currency code, e.g. `CAD` — the unit an unconverted figure is in. */
  currencyOf(iso3: string): string
}

/* ==========================================================================
   RESULT SHAPE
   ========================================================================== */

export type PivotNodeKind = 'leaf' | 'subtotal' | 'grand-total'

export interface PivotAxisNode {
  /** Unique within its axis. Composite of the path plus a kind marker. */
  key: string
  /** Field keys from the outermost field inward. Empty on the grand total. */
  path: readonly string[]
  /** Labels matching `path`, one per level. */
  pathLabels: readonly string[]
  /** What this line is called. */
  label: string
  /** Which axis level it sits at; -1 on the grand total. */
  depth: number
  kind: PivotNodeKind
}

/** One output column: a column-axis node crossed with one value field. */
export interface PivotColumn {
  key: string
  node: PivotAxisNode
  value: ReportValueField
  /** Index into `PivotTable.columnNodes`, for header spans. */
  nodeIndex: number
}

export interface PivotCell {
  /** `null` means blank — no values, or a group that mixed incompatible units. */
  value: number | null
  /** How many observations carried a value. */
  count: number
  /** In-scope coordinates with no value. */
  blanks: number
  /** Monetary values dropped because the country had no exchange rate that year. */
  unconverted: number
  /** What the number is in. `null` when the group mixed units. */
  unit: string | null
  /** True when contributions arrived in more than one unit, so no total is honest. */
  mixedUnits: boolean
}

export interface PivotTable {
  rows: PivotAxisNode[]
  columnNodes: PivotAxisNode[]
  columns: PivotColumn[]
  values: ReportValueField[]
  /** `cells[rowIndex][columnIndex]`, aligned to `rows` and `columns`. */
  cells: (PivotCell | null)[][]
  rowFields: ReportFieldPlacement[]
  columnFields: ReportFieldPlacement[]
  /** Distinct units present in the body, for the header line. */
  units: string[]
  /** Coordinates visited before filtering. */
  coordinatesRead: number
  /** Coordinates that passed the filters and were aggregated. */
  coordinatesIncluded: number
  /** Coordinates that carried a value. */
  valuesRead: number
  /** Values dropped for want of an exchange rate. */
  unconverted: number
  truncated: boolean
  /** Present when `truncated`; says what was dropped. */
  truncationNote: string | null
  /**
   * The language this table's labels were built in (UC041).
   *
   * Carried on the result rather than passed alongside it, because a table and
   * its chrome have to agree: the axis labels were resolved through the access
   * closure at build time and a viewer that chose its own vocabulary could
   * render a French table with an English "Grand total" on the last line.
   */
  vocabulary: ReportVocabulary
}

/* ==========================================================================
   REQUEST
   ========================================================================== */

export interface PivotRequest {
  definition: ReportDefinition
  countries: readonly string[]
  years: readonly number[]
  codes: readonly string[]
  presentation: ReportPresentation
  data: ReportDataAccess
  /**
   * UC041 — the language the report's own words are written in. Defaults to
   * English; the axis *labels* come from `data.fieldLabel`, which the caller
   * built over the same vocabulary.
   */
  vocabulary?: ReportVocabulary
  /** Coordinate budget. Reached ⇒ `truncated`, never a quiet early stop. */
  maxCoordinates?: number
  /** Output cell budget, applied to rows once the axes are known. */
  maxCells?: number
}

/** Generous enough for a 25-year, 200-code, 50-country run; low enough to bound a mistake. */
export const DEFAULT_MAX_COORDINATES = 750_000
/** A table nobody could read is not a report. Beyond this, rows are dropped and said so. */
export const DEFAULT_MAX_CELLS = 200_000

/* ==========================================================================
   KEYS
   ========================================================================== */

/**
 * Control characters, not punctuation.
 *
 * A field key is a country name, a WHO region or a variable code, and every
 * printable separator worth reaching for appears inside at least one of them —
 * `GGHE-D_pc_US$_SHA2011` alone rules out four. With a printable joiner
 * `['A','BC']` and `['AB','C']` would key identically and two unrelated rows
 * would silently merge. `` separates the two axes in an accumulator key
 * for the same reason.
 */
const SEP = ''
const LEAF = 'L'
const SUBTOTAL = 'S'
/** The single implicit node on an axis with no fields placed on it. */
const ALL_KEY = 'A'
const GRAND_KEY = 'G'

function leafKey(path: readonly string[]): string {
  return LEAF + path.join(SEP)
}

function subtotalKey(prefix: readonly string[]): string {
  return SUBTOTAL + prefix.join(SEP)
}

/* ==========================================================================
   THE AXIS TREE
   ========================================================================== */

interface TreeNode {
  children: Map<string, TreeNode>
}

function newNode(): TreeNode {
  return { children: new Map() }
}

function register(root: TreeNode, path: readonly string[]): void {
  let node = root
  for (const key of path) {
    let next = node.children.get(key)
    if (!next) {
      next = newNode()
      node.children.set(key, next)
    }
    node = next
  }
}

function compareKeys(a: string, b: string, placement: ReportFieldPlacement): number {
  const numeric = REPORT_FIELD_DEFS[placement.field].numeric
  const base = numeric ? Number(a) - Number(b) : a.localeCompare(b, 'en')
  return placement.sort === 'desc' ? -base : base
}

/**
 * Depth-first flatten into display order, inserting a subtotal line after each
 * group whose field asked for one.
 *
 * A subtotal is only emitted where there is something under it to total: a
 * subtotal on the innermost field would be a copy of the line above it, which
 * is noise rather than information.
 */
function flattenAxis(
  root: TreeNode,
  fields: readonly ReportFieldPlacement[],
  data: ReportDataAccess,
  grandTotal: boolean,
  grandTotalLabel: string,
  vocabulary: ReportVocabulary,
): PivotAxisNode[] {
  if (fields.length === 0) {
    return [
      {
        key: ALL_KEY,
        path: [],
        pathLabels: [],
        label: vocabulary.chrome.all,
        depth: 0,
        kind: 'leaf',
      },
    ]
  }

  const out: PivotAxisNode[] = []

  const walk = (node: TreeNode, depth: number, path: string[], labels: string[]): void => {
    const placement = fields[depth]
    if (!placement) return
    const keys = [...node.children.keys()].sort((a, b) => compareKeys(a, b, placement))

    for (const key of keys) {
      const child = node.children.get(key)
      if (!child) continue
      const nextPath = [...path, key]
      const nextLabels = [...labels, data.fieldLabel(placement.field, key)]
      const own = nextLabels[nextLabels.length - 1] ?? key

      if (depth === fields.length - 1) {
        out.push({
          key: leafKey(nextPath),
          path: nextPath,
          pathLabels: nextLabels,
          label: own,
          depth,
          kind: 'leaf',
        })
        continue
      }

      walk(child, depth + 1, nextPath, nextLabels)

      if (placement.subtotal) {
        out.push({
          key: subtotalKey(nextPath),
          path: nextPath,
          pathLabels: nextLabels,
          label: fillTemplate(vocabulary.chrome.subtotalTemplate, { label: own }),
          depth,
          kind: 'subtotal',
        })
      }
    }
  }

  walk(root, 0, [], [])

  if (grandTotal && out.length > 0) {
    out.push({
      key: GRAND_KEY,
      path: [],
      pathLabels: [],
      label: grandTotalLabel,
      depth: -1,
      kind: 'grand-total',
    })
  }

  return out
}

/** Every node key a coordinate contributes to on one axis. */
function contributionKeys(
  path: readonly string[],
  fields: readonly ReportFieldPlacement[],
  grandTotal: boolean,
): string[] {
  if (fields.length === 0) return [ALL_KEY]

  const keys = [leafKey(path)]
  for (let d = 0; d < fields.length - 1; d++) {
    if (fields[d]?.subtotal) keys.push(subtotalKey(path.slice(0, d + 1)))
  }
  if (grandTotal) keys.push(GRAND_KEY)
  return keys
}

/* ==========================================================================
   ACCUMULATION
   ========================================================================== */

interface Accumulator {
  sum: number
  count: number
  min: number
  max: number
  blanks: number
  unconverted: number
  units: Set<string>
}

function newAccumulator(): Accumulator {
  return {
    sum: 0,
    count: 0,
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
    blanks: 0,
    unconverted: 0,
    units: new Set(),
  }
}

function cellFrom(acc: Accumulator, aggregation: ReportAggregation): PivotCell {
  const mixedUnits = acc.units.size > 1
  const unit = acc.units.size === 1 ? ([...acc.units][0] ?? null) : null

  if (aggregation === 'count') {
    // A count is a count. Zero here means "reported nothing", which is the
    // answer a completeness report exists to give — not a blank.
    //
    // `Values` stays the canonical English key, like every other unit string:
    // `translateUnit` turns it into the report's language at display time. See
    // `vocabulary.ts` — a translated key stops comparing equal to itself.
    return {
      value: acc.count,
      count: acc.count,
      blanks: acc.blanks,
      unconverted: acc.unconverted,
      unit: ENGLISH_VOCABULARY.chrome.valuesUnit,
      mixedUnits: false,
    }
  }

  if (acc.count === 0 || mixedUnits) {
    return {
      value: null,
      count: acc.count,
      blanks: acc.blanks,
      unconverted: acc.unconverted,
      unit,
      mixedUnits,
    }
  }

  const value =
    aggregation === 'sum'
      ? acc.sum
      : aggregation === 'average'
        ? acc.sum / acc.count
        : aggregation === 'min'
          ? acc.min
          : acc.max

  return {
    value,
    count: acc.count,
    blanks: acc.blanks,
    unconverted: acc.unconverted,
    unit,
    mixedUnits: false,
  }
}

/* ==========================================================================
   FILTERS
   ========================================================================== */

function passesFilters(
  coordinate: ReportCoordinate,
  filters: readonly ReportFilter[],
  data: ReportDataAccess,
): boolean {
  for (const filter of filters) {
    if (filter.values.length === 0) continue
    const key = data.fieldKey(filter.field, coordinate)
    const hit = filter.values.includes(key)
    if (filter.exclude ? hit : !hit) return false
  }
  return true
}

/* ==========================================================================
   THE BUILD
   ========================================================================== */

export function buildPivot(request: PivotRequest): PivotTable {
  const {
    definition,
    countries,
    years,
    codes,
    presentation,
    data,
    vocabulary = ENGLISH_VOCABULARY,
    maxCoordinates = DEFAULT_MAX_COORDINATES,
    maxCells = DEFAULT_MAX_CELLS,
  } = request

  const rowFields = definition.rows
  const columnFields = definition.columns
  const values = definition.values.length > 0 ? definition.values : []

  const rowRoot = newNode()
  const columnRoot = newNode()
  const accumulators = new Map<string, Accumulator>()

  let coordinatesRead = 0
  let coordinatesIncluded = 0
  let valuesRead = 0
  let unconvertedTotal = 0
  let truncated = false
  let truncationNote: string | null = null

  outer: for (const iso3 of countries) {
    for (const year of years) {
      for (const code of codes) {
        if (coordinatesRead >= maxCoordinates) {
          truncated = true
          truncationNote = fillTemplate(vocabulary.chrome.truncatedCoordinates, {
            max: maxCoordinates.toLocaleString('en-GB'),
          })
          break outer
        }
        coordinatesRead++

        const coordinate: ReportCoordinate = { iso3, year, code }
        if (!passesFilters(coordinate, definition.filters, data)) continue
        coordinatesIncluded++

        const rowPath = rowFields.map((p) => data.fieldKey(p.field, coordinate))
        const columnPath = columnFields.map((p) => data.fieldKey(p.field, coordinate))
        register(rowRoot, rowPath)
        register(columnRoot, columnPath)

        const rowKeys = contributionKeys(rowPath, rowFields, definition.grandTotal)
        const columnKeys = contributionKeys(columnPath, columnFields, definition.grandTotal)

        const raw = data.valueOf(iso3, year, code)
        let contribution: { value: number; unit: string } | null = null
        let failedConversion = false

        if (raw != null && Number.isFinite(raw)) {
          valuesRead++
          const presented = presentValue(
            raw,
            data.unitOf(code),
            presentation,
            data.exchangeRate(iso3, year),
            data.currencyOf(iso3),
          )
          if (presented.ok) contribution = presented.presented
          else {
            failedConversion = true
            unconvertedTotal++
          }
        }

        for (const rowKey of rowKeys) {
          for (const columnKey of columnKeys) {
            const key = `${rowKey}${columnKey}`
            let acc = accumulators.get(key)
            if (!acc) {
              acc = newAccumulator()
              accumulators.set(key, acc)
            }
            if (contribution) {
              acc.sum += contribution.value
              acc.count++
              if (contribution.value < acc.min) acc.min = contribution.value
              if (contribution.value > acc.max) acc.max = contribution.value
              acc.units.add(contribution.unit)
            } else {
              acc.blanks++
              if (failedConversion) acc.unconverted++
            }
          }
        }
      }
    }
  }

  /* --- axes ------------------------------------------------------------- */

  let rows = flattenAxis(
    rowRoot,
    rowFields,
    data,
    definition.grandTotal,
    vocabulary.chrome.grandTotal,
    vocabulary,
  )
  const columnNodes = flattenAxis(
    columnRoot,
    columnFields,
    data,
    definition.grandTotal,
    vocabulary.chrome.allColumns,
    vocabulary,
  )

  const columns: PivotColumn[] = []
  columnNodes.forEach((node, nodeIndex) => {
    for (const value of values) {
      columns.push({ key: `${node.key}|${value.id}`, node, value, nodeIndex })
    }
  })

  // Cell budget. Rows are what a large run explodes, so rows are what gets
  // capped — and the note says so rather than the table simply ending.
  if (columns.length > 0 && rows.length * columns.length > maxCells) {
    const keep = Math.max(1, Math.floor(maxCells / columns.length))
    if (keep < rows.length) {
      const dropped = rows.length - keep
      rows = rows.slice(0, keep)
      truncated = true
      truncationNote = fillTemplate(vocabulary.chrome.truncatedRows, {
        dropped: dropped.toLocaleString('en-GB'),
        total: (keep + dropped).toLocaleString('en-GB'),
        max: maxCells.toLocaleString('en-GB'),
      })
    }
  }

  /* --- body ------------------------------------------------------------- */

  const unitsSeen = new Set<string>()
  const cells: (PivotCell | null)[][] = rows.map((row) =>
    columns.map((column) => {
      const acc = accumulators.get(`${row.key}${column.node.key}`)
      if (!acc) return null
      const cell = cellFrom(acc, column.value.aggregation)
      if (cell.unit) unitsSeen.add(cell.unit)
      return cell
    }),
  )

  return {
    rows,
    columnNodes,
    columns,
    values,
    cells,
    rowFields: [...rowFields],
    columnFields: [...columnFields],
    units: [...unitsSeen].sort(),
    coordinatesRead,
    coordinatesIncluded,
    valuesRead,
    unconverted: unconvertedTotal,
    truncated,
    truncationNote,
    vocabulary,
  }
}

/* ==========================================================================
   FLAT FORM — what the .xlsx and the CSV are written from
   ========================================================================== */

export interface PivotGrid {
  /** Header rows, each the full width of the grid. */
  headerRows: string[][]
  /** Body rows: the row-axis labels, then one entry per output column. */
  bodyRows: (string | number | null)[][]
  width: number
  /** Index of the first value column — everything left of it is a row label. */
  leadingColumns: number
}

/**
 * Flatten a pivot into a rectangle.
 *
 * Header labels are **repeated** on every column rather than written once over
 * a merged span. A merged header looks better on screen and is useless in a
 * spreadsheet the moment somebody sorts or filters it, and UC042's whole point
 * is that the file leaves DMS to be worked on elsewhere.
 */
export function pivotToGrid(table: PivotTable): PivotGrid {
  const vocabulary = table.vocabulary
  const rowFieldLabels = table.rowFields.map((p) => fieldHeading(p.field, vocabulary))
  const leadingColumns = Math.max(1, rowFieldLabels.length)
  const leadingHeader =
    rowFieldLabels.length > 0 ? rowFieldLabels : ['']

  const columnLevels = table.columnFields.length
  const showValueRow = table.values.length > 1
  const headerRowCount = Math.max(1, columnLevels + (showValueRow ? 1 : 0))

  const headerRows: string[][] = []
  for (let level = 0; level < headerRowCount; level++) {
    const isValueRow = showValueRow && level === headerRowCount - 1
    const isLastRow = level === headerRowCount - 1

    const leading = isLastRow
      ? [...leadingHeader]
      : Array.from({ length: leadingColumns }, () => '')

    const cells = table.columns.map((column) => {
      // A value field's label is authored by whoever built the report (UC036),
      // so it is content and stays as written — like the report's own name.
      if (isValueRow) return column.value.label
      return columnHeaderAt(
        column.node,
        level,
        columnLevels,
        table.values[0]?.label ?? vocabulary.chrome.aboutValueColumn,
        vocabulary.chrome.total,
      )
    })

    headerRows.push([...leading, ...cells])
  }

  const bodyRows: (string | number | null)[][] = table.rows.map((row, rowIndex) => {
    const leading: string[] = []
    for (let level = 0; level < leadingColumns; level++) {
      leading.push(rowHeaderAt(row, level, table.rowFields.length, vocabulary.chrome.total))
    }
    const cells = table.columns.map(
      (_, columnIndex) => table.cells[rowIndex]?.[columnIndex]?.value ?? null,
    )
    return [...leading, ...cells]
  })

  return {
    headerRows,
    bodyRows,
    width: leadingColumns + table.columns.length,
    leadingColumns,
  }
}

function columnHeaderAt(
  node: PivotAxisNode,
  level: number,
  columnLevels: number,
  soleValueLabel: string,
  totalWord: string,
): string {
  if (columnLevels === 0) return soleValueLabel
  if (node.kind === 'grand-total') return level === 0 ? node.label : ''
  const label = node.pathLabels[level]
  if (label != null) return label
  // A subtotal column sits above the levels it totals; mark the first of them.
  return level === node.pathLabels.length && node.kind === 'subtotal' ? totalWord : ''
}

function rowHeaderAt(
  node: PivotAxisNode,
  level: number,
  rowLevels: number,
  totalWord: string,
): string {
  if (rowLevels === 0) return node.label
  if (node.kind === 'grand-total') return level === 0 ? node.label : ''
  const label = node.pathLabels[level]
  if (label != null) return label
  return level === node.pathLabels.length && node.kind === 'subtotal' ? totalWord : ''
}

/* ==========================================================================
   SMALL HELPERS FOR CALLERS
   ========================================================================== */

/** How many cells a definition would produce over a scope, before running it. */
export function estimateCoordinates(
  countries: readonly unknown[],
  years: readonly unknown[],
  codes: readonly unknown[],
): number {
  return countries.length * years.length * codes.length
}

/** Inclusive year list, guarded so a reversed range yields nothing rather than looping. */
export function yearRange(from: number, to: number): number[] {
  const out: number[] = []
  for (let y = from; y <= to; y++) out.push(y)
  return out
}
