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
 *
 * **Both sheets are written in the report's language (UC041)** — the sheet tabs
 * included, since a French report whose tabs say `Report` and `About` is a
 * translated grid in an English workbook. The vocabulary travels on the table
 * rather than being passed alongside it, so an export cannot disagree with the
 * pivot it was built from. Field *values* stay as registered: country and
 * currency names, the report's own name and its authored description.
 */

import {
  describePresentation,
  fieldHeading,
  fillTemplate,
  pivotToGrid,
  translateUnit,
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
    name: context.table.vocabulary.chrome.sheetReport,
    aoa: [...grid.headerRows, ...grid.bodyRows],
    widths,
    numberFormat: numberFormatFor(context.parameters.presentation.decimals),
  }
}

function aboutSheet(context: ReportExportContext): SheetSpec {
  const { definition, parameters, table } = context
  const vocabulary = table.vocabulary
  const c = vocabulary.chrome

  // The two column headers double as the record keys, so they have to be read
  // from the same place the sheet spec reads them.
  const field = c.aboutFieldColumn
  const value = c.aboutValueColumn
  const row = (k: string, v: unknown): Record<string, unknown> => ({ [field]: k, [value]: v })

  const rows: Record<string, unknown>[] = [
    row(c.aboutReport, definition.name),
    row(c.aboutDescription, definition.description),
    row(c.aboutRunBy, context.runBy),
    row(c.aboutRunAt, context.runUtc),
    row(
      c.aboutCountries,
      context.iso3
        ? `${context.countryName ?? context.iso3} (${context.iso3})`
        : parameters.countries.join(', ') || c.allInScope,
    ),
    row(c.aboutYears, `${parameters.yearFrom}–${parameters.yearTo}`),
    row(c.aboutVariables, parameters.variables.join(', ') || c.allInScope),
    row(c.aboutUnit, vocabulary.reportUnits[parameters.presentation.unit]),
    row(c.aboutScale, vocabulary.scales[parameters.presentation.scale]),
    // Named in English as well as in the report's language: whoever receives the
    // file may not read the language it was produced in.
    row(c.aboutLanguage, WHO_LANGUAGE_LABELS[parameters.language]),
    row(
      c.aboutRows,
      definition.rows
        .map(
          (p) =>
            `${fieldHeading(p.field, vocabulary)}${p.subtotal ? ` (${c.withSubtotal})` : ''}`,
        )
        .join(' › ') || c.emptyValue,
    ),
    row(
      c.aboutColumns,
      definition.columns.map((p) => fieldHeading(p.field, vocabulary)).join(' › ') ||
        c.emptyValue,
    ),
    row(
      c.aboutValues,
      definition.values
        .map((v) => `${v.label} (${vocabulary.aggregations[v.aggregation]})`)
        .join(', '),
    ),
    row(
      c.aboutFilters,
      definition.filters
        .map(
          (f) =>
            `${fieldHeading(f.field, vocabulary)} ${f.exclude ? c.filterNotIn : c.filterIn} [${f.values.join(', ')}]`,
        )
        .join('; ') || c.none,
    ),
    row(c.aboutGrandTotal, definition.grandTotal ? c.yes : c.no),
    row(c.aboutCombinationsRead, table.coordinatesRead),
    row(c.aboutCombinationsFiltered, table.coordinatesIncluded),
    row(c.aboutValuesFound, table.valuesRead),
    row(
      c.aboutUnitsInTable,
      table.units.map((u) => translateUnit(u, vocabulary)).join(', ') || c.emptyValue,
    ),
  ]

  // Never hidden: a report that quietly stopped short is the one case where the
  // file looks complete and is not.
  if (table.unconverted > 0) {
    rows.push(
      row(
        c.aboutNotConverted,
        fillTemplate(c.notConvertedTemplate, { count: String(table.unconverted) }),
      ),
    )
  }
  if (table.truncated) {
    rows.push(row(c.aboutTruncated, table.truncationNote ?? c.yes))
  }

  return { name: c.sheetAbout, headers: [field, value], rows }
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
