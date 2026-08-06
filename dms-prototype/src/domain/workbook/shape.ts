/**
 * Workbook shape — the UC031 axis constraint, and the grid it produces.
 *
 * UC031 defines a workbook as a selection over three axes, of which **exactly
 * one is single-valued**:
 *
 *   > "the user can select one country and multiple variables and years
 *   > (country workbook), or one variable and multiple countries and years
 *   > (variable workbook), or one year and multiple countries and variables
 *   > (year workbook)"
 *
 * So the constraint is not a validation message bolted onto three pickers — it
 * is what *names* the workbook and what decides which axis becomes rows and
 * which becomes columns. Choosing multi on two axes forces the third to single,
 * and that rule lives here rather than in the picker so the grid, the URL
 * serialiser and the export all agree with the screen.
 *
 * Pure — no React, no store. See CLAUDE.md structural rule 1.
 */

import type { Variable } from '../types'

export const AXES = ['country', 'variable', 'year'] as const
export type AxisId = (typeof AXES)[number]

/** A workbook is named after its single-valued axis. */
export type WorkbookType = AxisId

export const AXIS_LABELS: Record<AxisId, string> = {
  country: 'Country',
  variable: 'Variable',
  year: 'Year',
}

export const WORKBOOK_TYPE_LABELS: Record<WorkbookType, string> = {
  country: 'Country workbook',
  variable: 'Variable workbook',
  year: 'Year workbook',
}

export const WORKBOOK_TYPE_DESCRIPTIONS: Record<WorkbookType, string> = {
  country: 'One country · variables down the side · years across the top',
  variable: 'One variable · countries down the side · years across the top',
  year: 'One year · variables down the side · countries across the top',
}

/**
 * One attribute filter on an axis. UC031: "it will be possible to filter by
 * attributes on any of the three axes; multiple filters are AND-ed."
 */
export interface AttributeFilter {
  axis: AxisId
  /** Attribute key, e.g. `GRP_WHO_REGION` on the country axis. */
  key: string
  label: string
  /** Values that pass. A member matches if it holds any of them. */
  values: string[]
}

export interface WorkbookSelection {
  countries: string[]
  variables: string[]
  years: number[]
  filters: AttributeFilter[]
}

export function emptySelection(): WorkbookSelection {
  return { countries: [], variables: [], years: [], filters: [] }
}

/* --------------------------------------------------------------------------
   The constraint
   -------------------------------------------------------------------------- */

export function axisCount(selection: WorkbookSelection, axis: AxisId): number {
  switch (axis) {
    case 'country':
      return selection.countries.length
    case 'variable':
      return selection.variables.length
    case 'year':
      return selection.years.length
  }
}

/**
 * Which axes are currently multi-valued (more than one member selected).
 *
 * An axis with exactly one member is *not* multi — that is the point of the
 * rule. An empty axis is not multi either; it is simply incomplete.
 */
export function multiAxes(selection: WorkbookSelection): AxisId[] {
  return AXES.filter((a) => axisCount(selection, a) > 1)
}

/**
 * The axis that must be capped at one member, or null while the selection is
 * still ambiguous.
 *
 * Two axes multi ⇒ the third is forced to single. This is what the picker calls
 * to disable multi-select on the remaining axis, and it is deliberately derived
 * rather than stored: a user who removes members from one axis should get the
 * third unlocked again without any extra bookkeeping.
 */
export function forcedSingleAxis(selection: WorkbookSelection): AxisId | null {
  const multi = multiAxes(selection)
  if (multi.length < 2) return null
  const remaining = AXES.filter((a) => !multi.includes(a))
  return remaining[0] ?? null
}

export interface WorkbookShape {
  type: WorkbookType
  /** The single-valued axis the workbook is named after. */
  singleAxis: AxisId
  /** The axis rendered down the side. */
  rowAxis: AxisId
  /** The axis rendered across the top. */
  colAxis: AxisId
}

/**
 * Row/column assignment per workbook type.
 *
 * Years across the top wherever they are multi-valued, because that is the
 * legacy layout the HA team has years of muscle memory for (plan §2.4
 * Decision 1) and nothing here is worth breaking it over. Only the year
 * workbook, which has no year axis to spread, puts countries across the top.
 */
const SHAPES: Record<WorkbookType, WorkbookShape> = {
  country: { type: 'country', singleAxis: 'country', rowAxis: 'variable', colAxis: 'year' },
  variable: { type: 'variable', singleAxis: 'variable', rowAxis: 'country', colAxis: 'year' },
  year: { type: 'year', singleAxis: 'year', rowAxis: 'variable', colAxis: 'country' },
}

export interface ShapeProblem {
  reason: 'incomplete' | 'no-single-axis' | 'too-many-single-axes'
  message: string
}

/**
 * Resolve a selection into a shape, or say why it cannot be resolved.
 *
 * `too-many-single-axes` is a real state, not a defensive branch: one country,
 * one variable and many years is *both* a country workbook and a variable
 * workbook, and the user has to say which they meant before rows and columns
 * can be assigned.
 */
export function resolveShape(
  selection: WorkbookSelection,
  preferred?: WorkbookType,
): { shape: WorkbookShape; problem: null } | { shape: null; problem: ShapeProblem } {
  const empty = AXES.filter((a) => axisCount(selection, a) === 0)
  if (empty.length > 0) {
    return {
      shape: null,
      problem: {
        reason: 'incomplete',
        message: `Choose at least one ${empty.map((a) => AXIS_LABELS[a].toLowerCase()).join(' and one ')}.`,
      },
    }
  }

  const singles = AXES.filter((a) => axisCount(selection, a) === 1)

  if (singles.length === 0) {
    return {
      shape: null,
      problem: {
        reason: 'no-single-axis',
        message:
          'All three axes have several members. Narrow one of them to a single country, variable or year.',
      },
    }
  }

  if (singles.length > 1) {
    // Honour an explicit choice when the user has made one.
    if (preferred && singles.includes(preferred)) {
      const shape = SHAPES[preferred]
      return shape ? { shape, problem: null } : { shape: null, problem: AMBIGUOUS(singles) }
    }
    // Otherwise pick deterministically in AXES order, so a URL round-trips.
    const first = singles[0]
    const shape = first ? SHAPES[first] : undefined
    return shape ? { shape, problem: null } : { shape: null, problem: AMBIGUOUS(singles) }
  }

  const only = singles[0]
  const shape = only ? SHAPES[only] : undefined
  return shape ? { shape, problem: null } : { shape: null, problem: AMBIGUOUS(singles) }
}

function AMBIGUOUS(singles: readonly AxisId[]): ShapeProblem {
  return {
    reason: 'too-many-single-axes',
    message: `This selection is both a ${singles.map((a) => WORKBOOK_TYPE_LABELS[a].toLowerCase()).join(' and a ')}. Pick which one you meant.`,
  }
}

/** Every workbook type this selection could legitimately be opened as. */
export function candidateTypes(selection: WorkbookSelection): WorkbookType[] {
  if (AXES.some((a) => axisCount(selection, a) === 0)) return []
  return AXES.filter((a) => axisCount(selection, a) === 1)
}

/* --------------------------------------------------------------------------
   Grid axes
   -------------------------------------------------------------------------- */

export interface GridRow {
  /** Stable key — the axis member this row stands for. */
  key: string
  label: string
  /** The code shown beneath the label in the frozen column. */
  code: string
  /**
   * True for parents, totals and indicators. Drives the pink "calculated"
   * row treatment from the legacy screenshots, and makes the row read-only.
   */
  isCalculated: boolean
}

export interface GridColumn {
  key: string
  label: string
}

export interface CountryLike {
  CODE_ISO_3: string
  NAME_SHORT_EN: string
}

/**
 * Turn a selection plus a shape into the rows and columns the grid renders.
 *
 * Members keep the order they were selected in rather than being re-sorted,
 * except years which always run ascending — a workbook with 2009 before 2003
 * would be unreadable no matter what order they were clicked in.
 */
export function buildGridAxes(
  selection: WorkbookSelection,
  shape: WorkbookShape,
  variablesByCode: ReadonlyMap<string, Variable>,
  countriesByIso3: ReadonlyMap<string, CountryLike>,
): { rows: GridRow[]; columns: GridColumn[] } {
  const rows = axisMembers(selection, shape.rowAxis).map((member) =>
    rowFor(shape.rowAxis, member, variablesByCode, countriesByIso3),
  )
  const columns = axisMembers(selection, shape.colAxis).map((member) =>
    columnFor(shape.colAxis, member, countriesByIso3),
  )
  return { rows, columns }
}

export function axisMembers(selection: WorkbookSelection, axis: AxisId): string[] {
  switch (axis) {
    case 'country':
      return [...selection.countries]
    case 'variable':
      return [...selection.variables]
    case 'year':
      return [...selection.years].sort((a, b) => a - b).map(String)
  }
}

function rowFor(
  axis: AxisId,
  member: string,
  variablesByCode: ReadonlyMap<string, Variable>,
  countriesByIso3: ReadonlyMap<string, CountryLike>,
): GridRow {
  if (axis === 'variable') {
    const v = variablesByCode.get(member)
    return {
      key: member,
      label: v?.label ?? member,
      code: member,
      isCalculated: v?.isCalculated ?? false,
    }
  }
  if (axis === 'country') {
    return {
      key: member,
      label: countriesByIso3.get(member)?.NAME_SHORT_EN ?? member,
      code: member,
      isCalculated: false,
    }
  }
  return { key: member, label: member, code: member, isCalculated: false }
}

function columnFor(
  axis: AxisId,
  member: string,
  countriesByIso3: ReadonlyMap<string, CountryLike>,
): GridColumn {
  if (axis === 'country') {
    return { key: member, label: countriesByIso3.get(member)?.NAME_SHORT_EN ?? member }
  }
  return { key: member, label: member }
}

/* --------------------------------------------------------------------------
   Cell coordinates
   -------------------------------------------------------------------------- */

/** What a grid cell actually addresses: one country × one year × one variable. */
export interface CellCoordinate {
  iso3: string
  year: number
  code: string
}

/**
 * Map a (row member, column member) pair back to an observation coordinate.
 *
 * The single axis supplies whichever of the three the row and column do not,
 * which is the whole reason a workbook needs exactly one of them.
 */
export function cellCoordinate(
  shape: WorkbookShape,
  selection: WorkbookSelection,
  rowKey: string,
  columnKey: string,
): CellCoordinate | null {
  const fixed = singleMember(selection, shape.singleAxis)
  if (fixed == null) return null

  const parts: Partial<Record<AxisId, string>> = {
    [shape.singleAxis]: fixed,
    [shape.rowAxis]: rowKey,
    [shape.colAxis]: columnKey,
  }

  const iso3 = parts.country
  const code = parts.variable
  const yearText = parts.year
  if (iso3 == null || code == null || yearText == null) return null

  const year = Number(yearText)
  return Number.isFinite(year) ? { iso3, year, code } : null
}

function singleMember(selection: WorkbookSelection, axis: AxisId): string | null {
  const members = axisMembers(selection, axis)
  return members.length >= 1 ? (members[0] ?? null) : null
}

/** Human title for the open workbook, e.g. "Canada · HF · 2000–2024". */
export function workbookTitle(
  selection: WorkbookSelection,
  shape: WorkbookShape,
  countriesByIso3: ReadonlyMap<string, CountryLike>,
): string {
  const country =
    selection.countries.length === 1
      ? (countriesByIso3.get(selection.countries[0] ?? '')?.NAME_SHORT_EN ??
        selection.countries[0] ??
        '')
      : `${selection.countries.length} countries`

  const years = selection.years.length === 0 ? '' : yearRangeLabel(selection.years)
  const variables =
    selection.variables.length === 1
      ? (selection.variables[0] ?? '')
      : `${selection.variables.length} variables`

  return [country, variables, years].filter(Boolean).join(' · ') + ` — ${WORKBOOK_TYPE_LABELS[shape.type].toLowerCase()}`
}

/** `[2000..2024]` → `2000–2024`; gaps are listed rather than implied. */
export function yearRangeLabel(years: readonly number[]): string {
  if (years.length === 0) return ''
  const sorted = [...years].sort((a, b) => a - b)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (first == null || last == null) return ''
  if (sorted.length === 1) return String(first)
  const contiguous = last - first + 1 === sorted.length
  return contiguous ? `${first}–${last}` : `${sorted.length} years`
}
