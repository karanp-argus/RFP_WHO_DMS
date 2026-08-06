/**
 * The fields a report can pivot on.
 *
 * An observation is 1 country × 1 year × 1 variable, so every dimension a pivot
 * can group by is an attribute of one of those three. That is the whole
 * catalogue below, and keeping it closed is deliberate: UC036 asks for
 * *"rows, columns, values, filters and groupings, similar to Excel Pivot
 * Tables"*, and an Excel pivot's field list is the columns of one table. A
 * builder that offered arbitrary expressions would be a second formula engine
 * wearing a different hat.
 *
 * The three `source` groups are also what the builder shows as headings, so a
 * user reading the field list can see why `WHO region` and `Country` cannot
 * both be leaves of the same thing.
 *
 * Pure — no React, no store. See CLAUDE.md structural rule 1.
 */

export const REPORT_FIELDS = [
  'country',
  'iso3',
  'region',
  'income',
  'oecd',
  'currency',
  'year',
  'variable',
  'variableCode',
  'classification',
  'unit',
] as const

export type ReportFieldId = (typeof REPORT_FIELDS)[number]

/** Which part of an observation coordinate a field is derived from. */
export type ReportFieldSource = 'country' | 'year' | 'variable'

export interface ReportFieldDef {
  id: ReportFieldId
  label: string
  source: ReportFieldSource
  /** Shown under the field in the builder's palette. */
  hint: string
  /**
   * True where the field's keys sort numerically. Only `year` does, and getting
   * it wrong puts 2010 before 2009 in every report ever run.
   */
  numeric: boolean
}

export const REPORT_FIELD_DEFS: Record<ReportFieldId, ReportFieldDef> = {
  country: {
    id: 'country',
    label: 'Country',
    source: 'country',
    hint: 'Short name, e.g. Canada',
    numeric: false,
  },
  iso3: {
    id: 'iso3',
    label: 'ISO3 code',
    source: 'country',
    hint: 'Three-letter code, e.g. CAN',
    numeric: false,
  },
  region: {
    id: 'region',
    label: 'WHO region',
    source: 'country',
    hint: 'AFR · AMR · SEAR · EUR · EMR · WPR',
    numeric: false,
  },
  income: {
    id: 'income',
    label: 'World Bank income group',
    source: 'country',
    hint: 'LIC · LMC · UMC · HIC',
    numeric: false,
  },
  oecd: {
    id: 'oecd',
    label: 'OECD membership',
    source: 'country',
    hint: 'Member or non-member',
    numeric: false,
  },
  currency: {
    id: 'currency',
    label: 'National currency',
    source: 'country',
    hint: 'The currency the country reports in',
    numeric: false,
  },
  year: {
    id: 'year',
    label: 'Year',
    source: 'year',
    hint: '2000–2024',
    numeric: true,
  },
  variable: {
    id: 'variable',
    label: 'Variable',
    source: 'variable',
    hint: 'Label, e.g. Government schemes',
    numeric: false,
  },
  variableCode: {
    id: 'variableCode',
    label: 'Variable code',
    source: 'variable',
    hint: 'e.g. HF.1, CHE%GDP_SHA2011',
    numeric: false,
  },
  classification: {
    id: 'classification',
    label: 'Classification',
    source: 'variable',
    hint: 'HF, HC, FS, MACRO, indicators…',
    numeric: false,
  },
  unit: {
    id: 'unit',
    label: 'Unit of measure',
    source: 'variable',
    hint: 'NCU millions · percent · USD per capita',
    numeric: false,
  },
}

export const REPORT_FIELD_SOURCE_LABELS: Record<ReportFieldSource, string> = {
  country: 'Country attributes',
  year: 'Time',
  variable: 'Variable attributes',
}

export function fieldLabel(field: ReportFieldId): string {
  return REPORT_FIELD_DEFS[field].label
}

/** Fields grouped for the builder palette, in catalogue order within a group. */
export function fieldsBySource(): { source: ReportFieldSource; fields: ReportFieldDef[] }[] {
  const sources: ReportFieldSource[] = ['country', 'year', 'variable']
  return sources.map((source) => ({
    source,
    fields: REPORT_FIELDS.map((f) => REPORT_FIELD_DEFS[f]).filter((d) => d.source === source),
  }))
}

export function isReportField(value: string): value is ReportFieldId {
  return (REPORT_FIELDS as readonly string[]).includes(value)
}
