/**
 * UC042 — *"export a DMS report into excel format, so that I can work on it in
 * the desktop / web application."*
 *
 * Two sheets, and the second is not padding. **Report** is the pivot itself,
 * written as a rectangle with the row labels in the leftmost columns and every
 * column header repeated rather than merged — a merged header is prettier and
 * useless the moment somebody sorts the sheet, which is the entire point of
 * exporting it. **About** carries the scope, the unit and scale, the year span
 * and what the run did not reach; a spreadsheet that arrives without the
 * parameters it was produced under is a grid of numbers nobody can reproduce.
 *
 * Numbers are written as numbers and blanks as blanks. A blank cell is not a
 * zero — the formula engine goes to some trouble to keep that distinction and
 * losing it at the last step, in the artefact that leaves the building, would
 * be the worst place to lose it.
 */

import {
  describePresentation,
  pivotToGrid,
  REPORT_AGGREGATION_LABELS,
  REPORT_UNIT_LABELS,
  scaleWord,
  type PivotTable,
  type ReportDefinition,
  type ReportRunParameters,
} from '@/domain/report'
import { WHO_LANGUAGE_LABELS } from '@/domain/constants'
import {
  downloadXlsx,
  stamped,
  xlsxBlob,
  type GridSheetSpec,
  type SheetSpec,
} from '@/lib/exporters'

export interface ReportExportContext {
  definition: ReportDefinition
  parameters: ReportRunParameters
  table: PivotTable
  /** Set when this file covers one country, for the About sheet and the name. */
  iso3?: string
  countryName?: string
  runBy: string
  runUtc: string
}

/** `1` → `#,##0.0`. Thousands separated, because these are national accounts. */
function numberFormatFor(decimals: number): string {
  return decimals > 0 ? `#,##0.${'0'.repeat(decimals)}` : '#,##0'
}

/** The pivot as a rectangle, plus its column widths and display format. */
function reportSheet(context: ReportExportContext): GridSheetSpec {
  const grid = pivotToGrid(context.table)
  const widths = Array.from({ length: grid.width }, (_, i) =>
    i < grid.leadingColumns ? 34 : 16,
  )
  return {
    name: 'Report',
    aoa: [...grid.headerRows, ...grid.bodyRows],
    widths,
    numberFormat: numberFormatFor(context.parameters.presentation.decimals),
  }
}

function aboutSheet(context: ReportExportContext): SheetSpec {
  const { definition, parameters, table } = context
  const rows: Record<string, unknown>[] = [
    { Field: 'Report', Value: definition.name },
    { Field: 'Description', Value: definition.description },
    { Field: 'Run by', Value: context.runBy },
    { Field: 'Run at (UTC)', Value: context.runUtc },
    {
      Field: 'Countries',
      Value: context.iso3
        ? `${context.countryName ?? context.iso3} (${context.iso3})`
        : parameters.countries.join(', ') || 'All in scope',
    },
    { Field: 'Years', Value: `${parameters.yearFrom}–${parameters.yearTo}` },
    { Field: 'Variables', Value: parameters.variables.join(', ') || 'All in scope' },
    { Field: 'Unit', Value: REPORT_UNIT_LABELS[parameters.presentation.unit] },
    { Field: 'Scale', Value: scaleWord(parameters.presentation.scale) },
    { Field: 'Labels language', Value: WHO_LANGUAGE_LABELS[parameters.language] },
    {
      Field: 'Rows',
      Value:
        definition.rows
          .map((p) => `${p.field}${p.subtotal ? ' (with subtotal)' : ''}`)
          .join(' › ') || '—',
    },
    { Field: 'Columns', Value: definition.columns.map((p) => p.field).join(' › ') || '—' },
    {
      Field: 'Values',
      Value: definition.values
        .map((v) => `${v.label} (${REPORT_AGGREGATION_LABELS[v.aggregation]})`)
        .join(', '),
    },
    {
      Field: 'Filters',
      Value:
        definition.filters
          .map((f) => `${f.field} ${f.exclude ? 'not in' : 'in'} [${f.values.join(', ')}]`)
          .join('; ') || 'None',
    },
    { Field: 'Grand total', Value: definition.grandTotal ? 'Yes' : 'No' },
    { Field: 'Combinations read', Value: table.coordinatesRead },
    { Field: 'Combinations after filters', Value: table.coordinatesIncluded },
    { Field: 'Values found', Value: table.valuesRead },
    { Field: 'Units in the table', Value: table.units.join(', ') || '—' },
  ]

  // Never hidden: a report that quietly stopped short is the one case where the
  // file looks complete and is not.
  if (table.unconverted > 0) {
    rows.push({
      Field: 'Not converted',
      Value: `${table.unconverted} value(s) had no exchange rate for their country and year and are left out of the totals.`,
    })
  }
  if (table.truncated) {
    rows.push({ Field: 'Truncated', Value: table.truncationNote ?? 'Yes' })
  }

  return { name: 'About', headers: ['Field', 'Value'], rows }
}

export function reportSheets(context: ReportExportContext): (GridSheetSpec | SheetSpec)[] {
  return [reportSheet(context), aboutSheet(context)]
}

/** Filename stem: slugged report name, plus the ISO3 when it is a per-country file. */
export function reportFileStem(definition: ReportDefinition, iso3?: string): string {
  const slug = definition.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return iso3 ? `${slug}-${iso3}` : slug
}

/** Immediate download — the button on a report displayed on screen. */
export function downloadReportXlsx(context: ReportExportContext): void {
  downloadXlsx(reportSheets(context), reportFileStem(context.definition, context.iso3))
}

/** Build the file without saving it — what a background job produces (UC042). */
export function buildReportFile(context: ReportExportContext): { name: string; blob: Blob } {
  const blob = xlsxBlob(reportSheets(context))
  return { name: stamped(reportFileStem(context.definition, context.iso3), 'xlsx'), blob }
}

export { describePresentation }
