/**
 * The delivered predefined reports (UC035).
 *
 * *"A list of predefined reports will be created by development team, based on
 * a list that will be provided by the technical unit at the beginning of the
 * project."* That list does not exist yet, so these six are drawn from what the
 * Health Accounts team demonstrably works with: the SHA 2011 financing-scheme
 * breakdown, the headline indicators, the peer comparisons the RFP's own QC
 * examples group by, and a submission-completeness view. Each one is here
 * because it exercises a different part of the pivot — nesting, subtotals,
 * several value fields, a filter, a per-country file split — rather than
 * because six looked like a good number.
 *
 * They are `isDelivered`, which is what lets an administrator edit one and
 * later reset it to the definition DMS shipped with, exactly as the QC rules
 * work.
 */

import { FIRST_YEAR, LAST_YEAR } from '@/domain/constants'
import {
  DEFAULT_PRESENTATION,
  placement,
  type ReportDefinition,
} from '@/domain/report'

/** Delivered reports are authored by the build, not by a seeded person. */
const SYSTEM = 'system'
const SEEDED_UTC = '2026-06-01T09:00:00.000Z'

/** The SHA 2011 financing schemes, top level plus the total. */
const HF_TOP = ['HF.1', 'HF.2', 'HF.3', 'HF.4', 'HF.nec', 'HF TOT']

/** The headline indicators an HA publication leads with. */
const HEADLINE_INDICATORS = [
  'CHE',
  'CHE%GDP_SHA2011',
  'CHE_pc_US$_SHA2011',
  'GGHE-D%CHE_SHA2011',
  'PVT-D%CHE_SHA2011',
  'OOPS%CHE_SHA2011',
  'EXT%CHE_SHA2011',
]

function report(
  partial: Pick<ReportDefinition, 'id' | 'name' | 'description' | 'folder'> &
    Partial<ReportDefinition>,
): ReportDefinition {
  return {
    scope: 'predefined',
    createdBy: SYSTEM,
    createdUtc: SEEDED_UTC,
    updatedUtc: SEEDED_UTC,
    rows: [placement('variable')],
    columns: [placement('year')],
    values: [{ id: 'value-sum', label: 'Value', aggregation: 'sum' }],
    filters: [],
    grandTotal: false,
    countries: [],
    variables: [],
    yearFrom: FIRST_YEAR,
    yearTo: LAST_YEAR,
    presentation: { ...DEFAULT_PRESENTATION },
    isHeavy: false,
    oneFilePerCountry: false,
    isDelivered: true,
    ...partial,
  }
}

export const SEEDED_REPORTS: readonly ReportDefinition[] = [
  /* --- the one the demo builds on -------------------------------------- */
  report({
    id: 'rep-hf-by-year',
    name: 'Health expenditure by financing scheme',
    description:
      'The SHA 2011 financing schemes down the side, years across the top — the shape the HA team reads a country in. Runs for one country on screen; for several, one Excel per country.',
    folder: 'EXPENDITURE',
    rows: [placement('variable')],
    columns: [placement('year')],
    variables: HF_TOP,
    yearFrom: 2015,
    // UC036: "one report per country (typically one excel per country for
    // download only)". This is the report the acceptance beat runs.
    oneFilePerCountry: true,
  }),

  /* --- nesting and subtotals -------------------------------------------- */
  report({
    id: 'rep-region-indicators',
    name: 'Key indicators by WHO region',
    description:
      'Countries nested inside their WHO region with a subtotal per region, averaged across the selected years. The comparison an analyst makes before writing a regional note.',
    folder: 'COMPARISONS',
    rows: [placement('region', { subtotal: true }), placement('country')],
    columns: [placement('variableCode')],
    values: [{ id: 'value-avg', label: 'Average', aggregation: 'average' }],
    variables: ['CHE%GDP_SHA2011', 'CHE_pc_US$_SHA2011', 'OOPS%CHE_SHA2011'],
    yearFrom: 2020,
    // No grand total: the three columns are a percentage, a dollar figure and
    // another percentage, so a row totalling across them has no meaning.
    grandTotal: false,
  }),

  /* --- the currency conversion, doing real work -------------------------- */
  report({
    id: 'rep-oecd-usd',
    name: 'Health spending in US dollars, OECD and non-OECD',
    description:
      'Total health expenditure converted to US dollars at each country-year exchange rate, then summed by OECD membership. Left in national currency the subtotals would be adding one currency to another, and the report says so rather than showing a number.',
    folder: 'COMPARISONS',
    rows: [placement('oecd', { subtotal: true }), placement('country')],
    columns: [placement('year')],
    variables: ['CHE', 'GGHE-D', 'PVT-D'],
    filters: [{ field: 'variableCode', values: ['CHE'], exclude: false }],
    yearFrom: 2018,
    presentation: { ...DEFAULT_PRESENTATION, unit: 'usd', decimals: 0 },
  }),

  /* --- several value fields --------------------------------------------- */
  report({
    id: 'rep-completeness',
    name: 'Reporting completeness by country and year',
    description:
      'How many of the selected variables each country reported, year by year. The zeroes are the point: a country that reported nothing shows a zero, not a blank.',
    folder: 'DATA QUALITY',
    rows: [placement('country')],
    columns: [placement('year')],
    values: [{ id: 'value-count', label: 'Values reported', aggregation: 'count' }],
    variables: HF_TOP,
    yearFrom: 2015,
    // Safe here where it is nowhere else: a count has no unit to disagree about.
    grandTotal: true,
  }),

  /* --- the headline table ------------------------------------------------ */
  report({
    id: 'rep-headline-indicators',
    name: 'Headline indicators, latest five years',
    description:
      'The seven indicators a country profile opens with, one country per row. Every one of them is computed live by the formula engine — none is stored.',
    folder: 'INDICATORS',
    rows: [placement('country'), placement('variable')],
    columns: [placement('year')],
    values: [
      { id: 'value-sum', label: 'Value', aggregation: 'sum' },
      { id: 'value-count', label: 'Values', aggregation: 'count' },
    ],
    variables: HEADLINE_INDICATORS,
    yearFrom: LAST_YEAR - 4,
  }),

  /* --- the deliberately heavy one, for UC042 ----------------------------- */
  report({
    id: 'rep-full-financing-matrix',
    name: 'Full financing matrix (all schemes, all revenues)',
    description:
      'Every financing scheme and every revenue source, by country and year. Flagged heavy by its author: it always runs in the background so the rest of DMS stays usable while it builds.',
    folder: 'EXPENDITURE',
    rows: [placement('classification', { subtotal: true }), placement('variable')],
    columns: [placement('country'), placement('year')],
    variables: [
      'HF.1.1',
      'HF.1.2.1',
      'HF.1.2.2',
      'HF.1.3',
      'HF.2.1',
      'HF.2.2',
      'HF.2.3',
      'HF.3.1',
      'HF.3.2',
      'HF.4',
      'HF.nec',
      'FS.1',
      'FS.2',
      'FS.3',
      'FS.4',
      'FS.5',
      'FS.6',
      'FS.7',
      'FS.nec',
    ],
    // Subtotals per classification only. A grand total would sum HF against FS,
    // which are two partitions of the same spending — the double count the
    // UC053 between-table rule exists to catch.
    grandTotal: false,
    isHeavy: true,
    oneFilePerCountry: true,
  }),
]

export const SEEDED_REPORT_BY_ID: ReadonlyMap<string, ReportDefinition> = new Map(
  SEEDED_REPORTS.map((r) => [r.id, r]),
)

/**
 * The five countries the acceptance beat runs over.
 *
 * Curated by hand for the same reason `data/qc/demoScope.ts` is: PROTOTYPE_PLAN
 * §7's mitigation for "demo data looks synthetic" is that the countries on
 * stage are ones an HA audience recognises. Canada is the §6 walkthrough
 * subject and the other four span three WHO regions and three income groups, so
 * a grouped report has something to group.
 */
export const REPORT_DEMO_COUNTRIES: readonly string[] = ['CAN', 'ARG', 'FRA', 'KEN', 'IDN']

export const REPORT_DEMO_SCOPE_LABEL = 'Reports demo set'
