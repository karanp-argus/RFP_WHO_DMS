/**
 * Deliberately planted data defects.
 *
 * Phase 5's quality checks must find something real. If the generator produced
 * only clean series, every QC rule would return zero findings and the module
 * would demo as an empty table — so the nine UC053 rule categories each get
 * matching defects planted here, at named countries and years the demo script
 * can navigate to directly.
 *
 * These are declared, not random: the QC report is only convincing if the
 * presenter can say "this is Kenya 2016, and here is why the rule fired".
 * `observations.ts` consults this table during derivation.
 */

import type { DimensionCode } from '@/domain/constants'

export type DefectKind =
  /** Value absent mid-series → `INTERPOLATE`, and the "missing observation" rule. */
  | 'gap'
  /** Implausible year-on-year jump → the growth rules. */
  | 'spike'
  /** Children do not sum to their parent → the between-category rule. */
  | 'category-mismatch'
  /** Value far from its regional peers → the outlier rule. */
  | 'outlier'
  /** Reported in year N, absent in N+1 → the "disappeared observation" rule. */
  | 'disappeared'
  /** Absent in year N, reported in N+1 → the "new observation" rule. */
  | 'new'
  /** Value present but zero where a total exists → atypical entry (warning). */
  | 'atypical-zero'
  /** Negative expenditure → atypical entry (error). */
  | 'negative'

export interface Defect {
  iso3: string
  dimension: DimensionCode
  /** Variable code the defect applies to. */
  code: string
  /** Single year, or an inclusive range for `gap`. */
  year: number
  yearTo?: number
  kind: DefectKind
  /** Multiplier for `spike` / `outlier` / `category-mismatch`. */
  factor?: number
  /** Why this exists, surfaced in the QC finding so the demo can explain it. */
  note: string
}

export const DEFECTS: readonly Defect[] = [
  /* --- Gaps: incomplete series the workbook's fill/interpolate tools target --- */
  {
    iso3: 'KEN',
    dimension: 'HF',
    code: 'HF.2.1',
    year: 2014,
    yearTo: 2016,
    kind: 'gap',
    note: 'Voluntary health insurance not reported 2014–2016; interpolation candidate.',
  },
  {
    iso3: 'NGA',
    dimension: 'HF',
    code: 'HF.1.2.1',
    year: 2009,
    yearTo: 2010,
    kind: 'gap',
    note: 'Social health insurance missing for two years mid-series.',
  },
  {
    iso3: 'IDN',
    dimension: 'HC',
    code: 'HC.6.2',
    year: 2019,
    kind: 'gap',
    note: 'Immunisation programme spend not reported for 2019.',
  },

  /* --- Spikes: the year-on-year growth rules --- */
  {
    iso3: 'ARG',
    dimension: 'HF',
    code: 'HF.3.1',
    year: 2018,
    kind: 'spike',
    factor: 4.8,
    note: 'Out-of-pocket spend up ~380% YoY — likely a currency or scale error.',
  },
  {
    iso3: 'GHA',
    dimension: 'HC',
    code: 'HC.1.1',
    year: 2021,
    kind: 'spike',
    factor: 3.2,
    note: 'Inpatient curative care more than trebles in one year.',
  },
  {
    iso3: 'VNM',
    dimension: 'FS',
    code: 'FS.7',
    year: 2020,
    kind: 'spike',
    factor: 6.0,
    // Plausible in reality (pandemic aid), which makes it a good demo case:
    // the rule fires and a human decides it is legitimate.
    note: 'Direct foreign transfers spike in 2020 — plausible pandemic aid, needs review not correction.',
  },

  /* --- Category mismatch: the between-category consistency rule --- */
  {
    iso3: 'PAK',
    dimension: 'HF',
    code: 'HF.1.1',
    year: 2017,
    kind: 'category-mismatch',
    factor: 0.55,
    note: 'HF.1 children sum to ~72% of the reported HF.1 total.',
  },
  {
    iso3: 'ETH',
    dimension: 'HC',
    code: 'HC.1.3',
    year: 2015,
    kind: 'category-mismatch',
    factor: 1.9,
    note: 'HC.1 children over-sum against the reported HC.1 total.',
  },

  /* --- Outliers: the group-outlier rule, evaluated across country attributes --- */
  {
    iso3: 'ZAF',
    dimension: 'MACRO',
    code: 'GGHE-D',
    year: 2022,
    kind: 'outlier',
    factor: 0.18,
    note: 'Government health expenditure far below UMC peers in AFR for 2022.',
  },
  {
    iso3: 'THA',
    dimension: 'HF',
    code: 'HF.1.1',
    year: 2013,
    kind: 'outlier',
    factor: 3.6,
    note: 'Government scheme spend well above SEAR/UMC peers for 2013.',
  },

  /* --- Appeared / disappeared: the reporting-continuity rules --- */
  {
    iso3: 'BGD',
    dimension: 'HC',
    code: 'HC.3.1',
    year: 2023,
    kind: 'disappeared',
    note: 'Inpatient long-term care reported through 2022, absent in 2023.',
  },
  {
    iso3: 'PER',
    dimension: 'HC',
    code: 'HC.2.2',
    year: 2023,
    kind: 'new',
    note: 'Day rehabilitative care reported for the first time in 2023.',
  },

  /* --- Atypical entries: warning vs error, per UC053 --- */
  {
    iso3: 'MOZ',
    dimension: 'HF',
    code: 'HF.2.3',
    year: 2020,
    kind: 'atypical-zero',
    note: 'Enterprise financing reported as exactly zero while the parent is positive.',
  },
  {
    iso3: 'BOL',
    dimension: 'FS',
    code: 'FS.6',
    year: 2011,
    kind: 'negative',
    note: 'Negative revenue reported — cannot be valid, flagged as an error.',
  },
]

/** Index for O(1) lookup during value derivation. */
const INDEX: ReadonlyMap<string, Defect> = (() => {
  const m = new Map<string, Defect>()
  for (const d of DEFECTS) {
    const to = d.yearTo ?? d.year
    for (let y = d.year; y <= to; y++) {
      m.set(`${d.iso3}|${d.code}|${y}`, d)
    }
  }
  return m
})()

export function defectFor(iso3: string, code: string, year: number): Defect | undefined {
  return INDEX.get(`${iso3}|${code}|${year}`)
}

/** Countries carrying at least one planted defect — the QC demo shortlist. */
export const DEFECT_COUNTRIES: readonly string[] = [...new Set(DEFECTS.map((d) => d.iso3))]
