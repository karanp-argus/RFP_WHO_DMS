/**
 * What a saved report *is*.
 *
 * UC035 splits reports two ways and both splits are in this type. `scope`
 * separates a **predefined** report — created by an administrator, runnable by
 * everyone (UC036) — from a **custom** one, which per UC037 is *"available to
 * me only"*. And the definition carries both the pivot layout and the default
 * run parameters, because UC036 says execution *"may require the selection of
 * one or multiple variables values"*: a saved report is a shape plus a starting
 * point, not a frozen result.
 *
 * Pure — no React, no store.
 */

import { FIRST_YEAR, LAST_YEAR, type WhoLanguage } from '../constants'
import type { ReportFieldId } from './fields'
import { DEFAULT_PRESENTATION, type ReportPresentation } from './units'

/* ==========================================================================
   VALUES
   ========================================================================== */

/**
 * How the observations behind one cell are combined.
 *
 * `count` counts the coordinates that carried a value, which is the honest
 * answer to "how complete is this country's submission" and is the measure the
 * seeded completeness report uses. There is no `count-all`: a coordinate with
 * no observation is not a data point, it is the absence of one.
 */
export const REPORT_AGGREGATIONS = ['sum', 'average', 'min', 'max', 'count'] as const
export type ReportAggregation = (typeof REPORT_AGGREGATIONS)[number]

export const REPORT_AGGREGATION_LABELS: Record<ReportAggregation, string> = {
  sum: 'Sum',
  average: 'Average',
  min: 'Minimum',
  max: 'Maximum',
  count: 'Number of values',
}

export interface ReportValueField {
  /** Stable within one definition — becomes part of the output column key. */
  id: string
  label: string
  aggregation: ReportAggregation
}

/* ==========================================================================
   AXES
   ========================================================================== */

export type ReportSort = 'asc' | 'desc'

/**
 * One field placed on the row or column axis.
 *
 * `subtotal` is UC036's *"groupings"*. An Excel pivot expresses a grouping as a
 * break with a subtotal line under it, and that is exactly what this flag turns
 * on — which is why grouping is a property of a placed field rather than a
 * fourth bucket in the builder.
 */
export interface ReportFieldPlacement {
  field: ReportFieldId
  sort: ReportSort
  subtotal: boolean
}

export function placement(
  field: ReportFieldId,
  options: Partial<Omit<ReportFieldPlacement, 'field'>> = {},
): ReportFieldPlacement {
  return { field, sort: options.sort ?? 'asc', subtotal: options.subtotal ?? false }
}

/**
 * One filter. Values are the *keys* the field produces, not labels — so a
 * region filter holds `EUR`, and renaming the label never breaks a saved
 * report.
 */
export interface ReportFilter {
  field: ReportFieldId
  values: string[]
  /** True keeps everything the values do NOT match. */
  exclude: boolean
}

/* ==========================================================================
   THE DEFINITION
   ========================================================================== */

export type ReportScope = 'predefined' | 'custom'

export const REPORT_SCOPE_LABELS: Record<ReportScope, string> = {
  predefined: 'Predefined',
  custom: 'Custom',
}

export interface ReportDefinition {
  id: string
  name: string
  description: string
  scope: ReportScope
  /** Grouping heading in the list, e.g. `EXPENDITURE`. */
  folder: string
  createdBy: string
  createdUtc: string
  updatedUtc: string

  /* --- the pivot --- */
  rows: ReportFieldPlacement[]
  columns: ReportFieldPlacement[]
  values: ReportValueField[]
  filters: ReportFilter[]
  /** A final line summing every row. Off for reports where a total is nonsense. */
  grandTotal: boolean

  /* --- default run parameters (UC036: execution may prompt for these) --- */
  countries: string[]
  variables: string[]
  yearFrom: number
  yearTo: number
  presentation: ReportPresentation

  /* --- UC042 --- */
  /**
   * Declared heavy by whoever authored it. A heavy report always runs in the
   * background; an ordinary one only does when the run is large enough to
   * warrant it. Both paths exist because UC042 is explicit that background
   * processing is for *"complex reports where there is high processing power
   * required"* — making everything a job would hide the distinction the use
   * case is actually about.
   */
  isHeavy: boolean
  /**
   * UC036: *"user may need to generate one report per country (typically one
   * excel per country for download only)"*.
   */
  oneFilePerCountry: boolean
  /** UC060-style marker: delivered with DMS and resettable to that definition. */
  isDelivered: boolean
}

export const DEFAULT_VALUE_FIELD: ReportValueField = {
  id: 'value-sum',
  label: 'Value',
  aggregation: 'sum',
}

export function emptyReport(
  id: string,
  createdBy: string,
  nowUtc: string,
  scope: ReportScope = 'custom',
): ReportDefinition {
  return {
    id,
    name: 'Untitled report',
    description: '',
    scope,
    folder: scope === 'custom' ? 'MY REPORTS' : 'GENERAL',
    createdBy,
    createdUtc: nowUtc,
    updatedUtc: nowUtc,
    rows: [placement('variable')],
    columns: [placement('year')],
    values: [{ ...DEFAULT_VALUE_FIELD }],
    filters: [],
    grandTotal: false,
    countries: [],
    variables: [],
    yearFrom: FIRST_YEAR,
    yearTo: LAST_YEAR,
    presentation: { ...DEFAULT_PRESENTATION },
    isHeavy: false,
    oneFilePerCountry: false,
    isDelivered: false,
  }
}

/* ==========================================================================
   VALIDATION
   ========================================================================== */

/**
 * Reasons this definition cannot be run, in the order a user should fix them.
 *
 * Returned as sentences rather than codes because every one of them is shown
 * verbatim next to the Save button — a builder that says "invalid" and leaves
 * the user to work out which of five buckets is wrong is the thing this is
 * meant to avoid.
 */
export function reportProblems(def: ReportDefinition): string[] {
  const out: string[] = []

  if (def.name.trim() === '') out.push('Give the report a name.')
  if (def.values.length === 0) {
    out.push('Add at least one field to Values — a pivot with no measure has nothing to show.')
  }

  const placed = new Map<ReportFieldId, string>()
  for (const p of def.rows) placed.set(p.field, 'Rows')
  for (const p of def.columns) {
    const where = placed.get(p.field)
    if (where) {
      out.push(`${p.field} is on both ${where} and Columns. A field can only sit on one axis.`)
    }
    placed.set(p.field, 'Columns')
  }

  if (def.rows.length === 0 && def.columns.length === 0) {
    out.push('Add at least one field to Rows or Columns.')
  }
  if (def.yearFrom > def.yearTo) out.push('The first year is after the last year.')

  for (const f of def.filters) {
    if (f.values.length === 0) {
      out.push(`The ${f.field} filter has no values selected, so it would exclude everything.`)
    }
  }

  return out
}

/** One-line summary for the report list. */
export function describeReport(def: ReportDefinition): string {
  const rows = def.rows.map((p) => p.field).join(' › ') || 'no rows'
  const cols = def.columns.map((p) => p.field).join(' › ') || 'no columns'
  const values = def.values.map((v) => REPORT_AGGREGATION_LABELS[v.aggregation]).join(', ')
  return `${rows} × ${cols} — ${values}`
}

/**
 * Copy a report as the basis for a new one (UC038).
 *
 * The result is always **custom** and always owned by whoever copied it, even
 * when an administrator copies their own predefined report: UC038 says *"the
 * resulting report would be considered a Custom report and would be available
 * for the user that created it only"*, with no exception for administrators.
 */
export function duplicateReport(
  source: ReportDefinition,
  id: string,
  createdBy: string,
  nowUtc: string,
): ReportDefinition {
  return {
    ...source,
    id,
    name: `${source.name} (copy)`,
    scope: 'custom',
    folder: 'MY REPORTS',
    createdBy,
    createdUtc: nowUtc,
    updatedUtc: nowUtc,
    rows: source.rows.map((p) => ({ ...p })),
    columns: source.columns.map((p) => ({ ...p })),
    values: source.values.map((v) => ({ ...v })),
    filters: source.filters.map((f) => ({ ...f, values: [...f.values] })),
    countries: [...source.countries],
    variables: [...source.variables],
    presentation: { ...source.presentation },
    isDelivered: false,
  }
}

/* ==========================================================================
   RUN PARAMETERS
   ========================================================================== */

/**
 * What the run page hands to the engine.
 *
 * Separate from the definition because the same saved report is run over
 * different countries by different people — UC035's *"reports will be based on
 * countries and variables attributes and years"* is a prompt, not a property of
 * the report.
 */
export interface ReportRunParameters {
  countries: string[]
  variables: string[]
  yearFrom: number
  yearTo: number
  presentation: ReportPresentation
  /** UC042 — display on screen, or produce files without rendering. */
  delivery: 'screen' | 'download'
  language: WhoLanguage
}

export function defaultParameters(def: ReportDefinition): ReportRunParameters {
  return {
    countries: [...def.countries],
    variables: [...def.variables],
    yearFrom: def.yearFrom,
    yearTo: def.yearTo,
    presentation: { ...def.presentation },
    delivery: def.oneFilePerCountry ? 'download' : 'screen',
    language: def.presentation.language,
  }
}

/**
 * Whether this run should be handed to the background queue (UC042).
 *
 * Three ways in, and the thresholds are stated rather than tuned by feel: the
 * author declared the report heavy, the run produces a file per country, or the
 * coordinate count is large enough that the pivot would visibly block the page.
 */
export const BACKGROUND_COORDINATE_THRESHOLD = 60_000
export const BACKGROUND_COUNTRY_THRESHOLD = 3

export function shouldRunInBackground(
  def: ReportDefinition,
  params: ReportRunParameters,
): { background: boolean; reason: string } {
  const years = Math.max(0, params.yearTo - params.yearFrom + 1)
  const coordinates = params.countries.length * years * Math.max(1, params.variables.length)

  if (def.oneFilePerCountry && params.countries.length > 1) {
    return {
      background: true,
      reason: `One Excel file per country — ${params.countries.length} files to build.`,
    }
  }
  if (def.isHeavy) {
    return { background: true, reason: 'This report is flagged as heavy by its author.' }
  }
  if (params.delivery === 'download' && params.countries.length >= BACKGROUND_COUNTRY_THRESHOLD) {
    return {
      background: true,
      reason: `${params.countries.length} countries to build files for.`,
    }
  }
  if (coordinates >= BACKGROUND_COORDINATE_THRESHOLD) {
    return {
      background: true,
      reason: `${coordinates.toLocaleString('en-GB')} country × year × variable combinations to read.`,
    }
  }
  return { background: false, reason: '' }
}
