/**
 * UC041 — *"reports can be run to be displayed in any of the 6 WHO official
 * languages … all the headers and labels in the report will be displayed in the
 * selected language."*
 *
 * This file is the **shape** of that translation and the English original; the
 * five other packs are seeded configuration and live in
 * `src/data/seed/translations/`, loaded on demand. Three rules hold the design
 * together and each one exists because the obvious alternative breaks something.
 *
 *  · **A key is never a label.** `unitOf()` returns
 *    `National Currency Unit (NCU) millions` in every language, because that
 *    string is what `presentValue` compares against to decide whether a figure
 *    is convertible, and what a pivot cell compares against to refuse a total
 *    that mixed pesos and yen. Translate the *key* and the mixed-unit guard
 *    silently stops firing — the report would start adding currencies together
 *    the moment somebody chose French. So every unit, every field key and every
 *    filter value stays canonical English, and translation happens once, at the
 *    edge, where a string is about to be shown.
 *
 *  · **A pack overrides; it never replaces.** Every map here is consulted with
 *    an English fallback, so a variable added to the classification seed without
 *    a Russian label appears in Russian reports under its English name rather
 *    than as a blank cell or a bare code. `translations.test.ts` fails on the
 *    missing entry, which is the right place to notice it.
 *
 *  · **The vocabulary is data, not a function.** No closures, no `Intl`, no
 *    plural machinery — a template string with `{label}` is enough for the two
 *    composed strings a pivot produces, and it keeps a pack reviewable by
 *    somebody who does not read TypeScript.
 *
 * **What is deliberately not translated**, matching UC041's own carve-out
 * (*"any report displaying text as part of the fields values (such as metadata)
 * will not be translated"*): country names, currency names, user-authored report
 * names and descriptions, and observation metadata. Those are field values, held
 * once in the xMart registry, not vocabulary.
 *
 * Pure — no React, no store. See CLAUDE.md structural rule 1.
 */

import {
  DIMENSION_LABELS,
  SCALE_LABELS,
  UNITS,
  WB_INCOME_LABELS,
  WHO_REGION_LABELS,
  type Scale,
  type WhoLanguage,
} from '../constants'
import { REPORT_AGGREGATION_LABELS, type ReportAggregation } from './definition'
import { REPORT_FIELD_DEFS, REPORT_FIELDS, type ReportFieldId } from './fields'
import { REPORT_UNIT_LABELS, REPORT_UNITS, scaleWord, type ReportUnit } from './units'

/* ==========================================================================
   CHROME — the words the report generates about itself
   ========================================================================== */

/**
 * Everything the pivot and the export write that came from neither the corpus
 * nor the user: totals, sheet names, and the keys of the About sheet.
 *
 * `subtotalTemplate` and `notConvertedTemplate` carry `{label}` / `{count}`
 * placeholders rather than being assembled by concatenation, because the word
 * order differs: English puts "— total" after the group name and Russian,
 * Chinese and Arabic put their equivalent in front of it.
 */
export interface ReportChrome {
  /** The final line summing every row. */
  grandTotal: string
  /** The grand-total *column*, which totals across the column axis. */
  allColumns: string
  /** The single implicit node on an axis with no fields placed on it. */
  all: string
  /** Filler in a subtotal line's deeper label columns. */
  total: string
  /** `{label}` — the subtotal line's own caption. */
  subtotalTemplate: string
  /** Unit of a `count` cell: the cell holds values, not money. */
  valuesUnit: string
  /** Shown in a cell whose contributions arrived in incompatible units. */
  mixed: string
  /** `{max}` — the coordinate budget stopped the run. */
  truncatedCoordinates: string
  /** `{dropped}`, `{total}`, `{max}` — the cell budget dropped rows. */
  truncatedRows: string

  /* --- the exported workbook --- */
  sheetReport: string
  sheetAbout: string
  aboutFieldColumn: string
  aboutValueColumn: string

  /* --- About sheet keys --- */
  aboutReport: string
  aboutDescription: string
  aboutRunBy: string
  aboutRunAt: string
  aboutCountries: string
  aboutYears: string
  aboutVariables: string
  aboutUnit: string
  aboutScale: string
  aboutLanguage: string
  aboutRows: string
  aboutColumns: string
  aboutValues: string
  aboutFilters: string
  aboutGrandTotal: string
  aboutCombinationsRead: string
  aboutCombinationsFiltered: string
  aboutValuesFound: string
  aboutUnitsInTable: string
  aboutNotConverted: string
  aboutTruncated: string

  /* --- About sheet values --- */
  allInScope: string
  none: string
  yes: string
  no: string
  withSubtotal: string
  filterIn: string
  filterNotIn: string
  emptyValue: string
  /** `{count}` — values dropped for want of an exchange rate. */
  notConvertedTemplate: string
}

/* ==========================================================================
   THE VOCABULARY
   ========================================================================== */

/**
 * One language's complete report vocabulary.
 *
 * The code-keyed maps are `Record<string, string>` rather than a closed union
 * because a variable code is configuration: an administrator adding a custom
 * formula (UC030) creates a code this file cannot know about, and it should
 * appear under its authored name rather than fail to type-check.
 */
export interface ReportVocabulary {
  language: WhoLanguage
  chrome: ReportChrome
  /** Pivot field headers — `Country`, `Year`, `Variable`. */
  fields: Record<ReportFieldId, string>
  aggregations: Record<ReportAggregation, string>
  /** The word a unit label uses, e.g. `millions` in `CAD millions`. */
  scales: Record<Scale, string>
  /** Menu wording for the unit selector, repeated on the About sheet. */
  reportUnits: Record<ReportUnit, string>
  /** Canonical English unit-of-measure string → label. */
  units: Record<string, string>
  /** Variable or indicator code → label. */
  variables: Record<string, string>
  /** Classification dimension code → label. */
  dimensions: Record<string, string>
  regions: Record<string, string>
  incomes: Record<string, string>
  /** Keyed by the two keys `fieldKey('oecd')` produces. */
  oecd: Record<string, string>
}

/* ==========================================================================
   ENGLISH — the original, assembled from the constants it already lives in
   ========================================================================== */

const ENGLISH_CHROME: ReportChrome = {
  grandTotal: 'Grand total',
  allColumns: 'All columns',
  all: 'All',
  total: 'Total',
  subtotalTemplate: '{label} — total',
  valuesUnit: 'Values',
  mixed: 'mixed',
  truncatedCoordinates:
    'Stopped after {max} country × year × variable combinations. Narrow the scope to see the rest.',
  truncatedRows:
    '{dropped} of {total} rows are not shown — the table reached its {max}-cell limit. Add a filter or move a field off Rows.',

  sheetReport: 'Report',
  sheetAbout: 'About',
  aboutFieldColumn: 'Field',
  aboutValueColumn: 'Value',

  aboutReport: 'Report',
  aboutDescription: 'Description',
  aboutRunBy: 'Run by',
  aboutRunAt: 'Run at (UTC)',
  aboutCountries: 'Countries',
  aboutYears: 'Years',
  aboutVariables: 'Variables',
  aboutUnit: 'Unit',
  aboutScale: 'Scale',
  aboutLanguage: 'Labels language',
  aboutRows: 'Rows',
  aboutColumns: 'Columns',
  aboutValues: 'Values',
  aboutFilters: 'Filters',
  aboutGrandTotal: 'Grand total',
  aboutCombinationsRead: 'Combinations read',
  aboutCombinationsFiltered: 'Combinations after filters',
  aboutValuesFound: 'Values found',
  aboutUnitsInTable: 'Units in the table',
  aboutNotConverted: 'Not converted',
  aboutTruncated: 'Truncated',

  allInScope: 'All in scope',
  none: 'None',
  yes: 'Yes',
  no: 'No',
  withSubtotal: 'with subtotal',
  filterIn: 'in',
  filterNotIn: 'not in',
  emptyValue: '—',
  notConvertedTemplate:
    '{count} value(s) had no exchange rate for their country and year and are left out of the totals.',
}

function englishFields(): Record<ReportFieldId, string> {
  const out = {} as Record<ReportFieldId, string>
  for (const id of REPORT_FIELDS) out[id] = REPORT_FIELD_DEFS[id].label
  return out
}

function englishScales(): Record<Scale, string> {
  const out = {} as Record<Scale, string>
  // The unit label wants "millions", not the menu's "Millions (Default)".
  for (const s of Object.keys(SCALE_LABELS) as Scale[]) out[s] = scaleWord(s)
  return out
}

function englishReportUnits(): Record<ReportUnit, string> {
  const out = {} as Record<ReportUnit, string>
  for (const u of REPORT_UNITS) out[u] = REPORT_UNIT_LABELS[u]
  return out
}

/**
 * English needs no `variables` map: `reportAccess` already falls back to the
 * label on the seeded record, which *is* the English original. Leaving it empty
 * keeps one source of truth rather than a copy that can drift from the seed.
 */
export const ENGLISH_VOCABULARY: ReportVocabulary = {
  language: 'en',
  chrome: ENGLISH_CHROME,
  fields: englishFields(),
  aggregations: { ...REPORT_AGGREGATION_LABELS },
  scales: englishScales(),
  reportUnits: englishReportUnits(),
  units: {
    [UNITS.NCU_MILLIONS]: UNITS.NCU_MILLIONS,
    [UNITS.USD_PER_CAPITA]: UNITS.USD_PER_CAPITA,
    [UNITS.PERCENT]: UNITS.PERCENT,
    [UNITS.COUNT]: UNITS.COUNT,
    [UNITS.RATE]: UNITS.RATE,
  },
  variables: {},
  dimensions: { ...DIMENSION_LABELS },
  regions: { ...WHO_REGION_LABELS },
  incomes: { ...WB_INCOME_LABELS },
  oecd: { OECD: 'OECD', 'Non-OECD': 'Non-OECD' },
}

/* ==========================================================================
   LOOKUPS
   ========================================================================== */

/** `'{label} — total'` + `'Curative care'` → `'Curative care — total'`. */
export function fillTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole)
}

/** A variable's label, falling back to whatever the seeded record carries. */
export function variableLabel(
  code: string,
  englishLabel: string,
  vocabulary: ReportVocabulary,
): string {
  return vocabulary.variables[code] ?? englishLabel
}

/**
 * Translate a unit-of-measure string for display.
 *
 * Two shapes reach this. A stored unit (`Percents`, `USD per capita`) is a
 * member of `UNITS` and matches the map directly. A **presented** unit is
 * composed by `presentValue` from the country's own currency and the chosen
 * scale — `CAD millions`, `US$ billions` — and cannot be enumerated, because
 * the currency half comes from the country registry. So the composed form is
 * decomposed here: the currency code is left exactly as it is (`CAD` is `CAD`
 * in every language) and only the scale word is translated.
 *
 * The unit string itself is never rewritten in place — see the header note. It
 * stays canonical English on `PivotCell.unit` so the mixed-unit guard keeps
 * comparing like with like.
 */
export function translateUnit(unit: string, vocabulary: ReportVocabulary): string {
  const direct = vocabulary.units[unit]
  if (direct) return direct
  if (unit === ENGLISH_CHROME.valuesUnit) return vocabulary.chrome.valuesUnit

  const split = unit.lastIndexOf(' ')
  if (split > 0) {
    const currency = unit.slice(0, split)
    const word = unit.slice(split + 1)
    for (const scale of Object.keys(vocabulary.scales) as Scale[]) {
      if (scaleWord(scale) === word) return `${currency} ${vocabulary.scales[scale]}`
    }
  }
  return unit
}

/** Field header for a pivot axis, e.g. the caption over the row labels. */
export function fieldHeading(field: ReportFieldId, vocabulary: ReportVocabulary): string {
  return vocabulary.fields[field] ?? REPORT_FIELD_DEFS[field].label
}
