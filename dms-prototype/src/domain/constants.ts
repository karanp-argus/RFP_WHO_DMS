/**
 * Domain constants drawn directly from the RFP.
 *
 * Pure data — no React, no stores. See CLAUDE.md structural rule 1.
 */

/**
 * The 15 classification dimensions of the xMart long-format observation table,
 * in the exact column order of the screenshots embedded in the Functional
 * Requirements (plan §1.3). Order matters: `longFormat.ts` emits columns in
 * this sequence and the Annex 3 CSV must match.
 */
export const DIMENSIONS = [
  'AGE',
  'DIS',
  'FP',
  'FS',
  'FS_RI',
  'GEN',
  'HC',
  'HC_RI',
  'HCR',
  'HF',
  'HK',
  'HKR',
  'HP',
  'IND',
  'MACRO',
] as const
export type DimensionCode = (typeof DIMENSIONS)[number]

/** Human labels for the dimension codes. SHA 2011 / ICHA naming. */
export const DIMENSION_LABELS: Record<DimensionCode, string> = {
  AGE: 'Age group',
  DIS: 'Disease / condition',
  FP: 'Financing provider',
  FS: 'Revenues of health care financing schemes (ICHA-FS)',
  FS_RI: 'Financing sources — revenue of institutional units',
  GEN: 'Gender',
  HC: 'Health care functions (ICHA-HC)',
  HC_RI: 'Health care functions — reporting items',
  HCR: 'Health care related classes',
  HF: 'Health care financing schemes (ICHA-HF)',
  HK: 'Factors of health care provision (ICHA-FP/HK)',
  HKR: 'Factors of provision — reporting items',
  HP: 'Health care providers (ICHA-HP)',
  IND: 'Indicators',
  MACRO: 'Macroeconomic series',
}

/**
 * Observation metadata fields, as observed in the FR screenshots (plan §1.3).
 * UC027 requires three field types — free text, date, list of values — and a
 * separate area holding migrated old-DMS formulas (UC060).
 */
export const METADATA_FIELDS = [
  'SOURCES',
  'COMMENT',
  'WEB_LINK',
  'EST_METHOD',
  'DATA_TYPE',
  'OLD_DMS_FORMULA',
] as const
export type MetadataFieldCode = (typeof METADATA_FIELDS)[number]

/** Time span the HA team works over: "complex datasets ... dating back to 2000". */
export const FIRST_YEAR = 2000
export const LAST_YEAR = 2024
export const YEARS: readonly number[] = Array.from(
  { length: LAST_YEAR - FIRST_YEAR + 1 },
  (_, i) => FIRST_YEAR + i,
)

/** WHO regions, used as a country attribute and as a grouping key (UC022). */
export const WHO_REGIONS = ['AFR', 'AMR', 'SEAR', 'EUR', 'EMR', 'WPR'] as const
export type WhoRegion = (typeof WHO_REGIONS)[number]

export const WHO_REGION_LABELS: Record<WhoRegion, string> = {
  AFR: 'African Region',
  AMR: 'Region of the Americas',
  SEAR: 'South-East Asia Region',
  EUR: 'European Region',
  EMR: 'Eastern Mediterranean Region',
  WPR: 'Western Pacific Region',
}

/** World Bank income groups — a country attribute flagged groupable (UC022). */
export const WB_INCOME_GROUPS = ['LIC', 'LMC', 'UMC', 'HIC'] as const
export type WbIncome = (typeof WB_INCOME_GROUPS)[number]

export const WB_INCOME_LABELS: Record<WbIncome, string> = {
  LIC: 'Low income',
  LMC: 'Lower middle income',
  UMC: 'Upper middle income',
  HIC: 'High income',
}

/**
 * The six official WHO languages (HLR21). The UI is English-only; reports must
 * be generatable with variable labels in any of these. Note `ar` is RTL.
 */
export const WHO_LANGUAGES = ['en', 'fr', 'es', 'ar', 'zh', 'ru'] as const
export type WhoLanguage = (typeof WHO_LANGUAGES)[number]

export const WHO_LANGUAGE_LABELS: Record<WhoLanguage, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  ar: 'Arabic',
  zh: 'Chinese',
  ru: 'Russian',
}

export const RTL_LANGUAGES: readonly WhoLanguage[] = ['ar']

/**
 * UC024 publishing status — explicitly "treated as a simple workflow" with
 * exactly these two values. Editable individually or in bulk.
 */
export const PUBLISHING_STATUSES = ['not-publish', 'ready-to-publish'] as const
export type PublishingStatus = (typeof PUBLISHING_STATUSES)[number]

export const PUBLISHING_STATUS_LABELS: Record<PublishingStatus, string> = {
  'not-publish': 'Not publish',
  'ready-to-publish': 'Ready to publish',
}

/**
 * Units and currencies a report or workbook can be rendered in. The legacy DMS
 * screenshot shows a "Scale" selector defaulting to "Millions (Default)".
 */
export const SCALES = ['units', 'thousands', 'millions', 'billions'] as const
export type Scale = (typeof SCALES)[number]

export const SCALE_LABELS: Record<Scale, string> = {
  units: 'Units',
  thousands: 'Thousands',
  millions: 'Millions (Default)',
  billions: 'Billions',
}

export const SCALE_DIVISORS: Record<Scale, number> = {
  units: 1,
  thousands: 1e3,
  millions: 1e6,
  billions: 1e9,
}

/** Units of measure used by the seeded indicator formulas (plan §1.4). */
export const UNITS = {
  NCU_MILLIONS: 'National Currency Unit (NCU) millions',
  USD_PER_CAPITA: 'USD per capita',
  PERCENT: 'Percents',
  COUNT: 'Count',
  RATE: 'Rate',
} as const

/**
 * Source formats the HA team receives, per FR §3 and Annex 1. Used by the
 * UC039 data tracking report to say how a country's data arrived.
 */
export const SOURCE_FORMATS = ['JHAQ', 'HAQ', 'Mini', 'HAPT', 'LongFormat'] as const
export type SourceFormat = (typeof SOURCE_FORMATS)[number]

export const SOURCE_FORMAT_LABELS: Record<SourceFormat, string> = {
  JHAQ: 'JHAQ (Joint Health Accounts Questionnaire)',
  HAQ: 'HAQ (Health Accounts Questionnaire)',
  Mini: 'Mini questionnaire',
  HAPT: 'HAPT cross tables (via API)',
  LongFormat: 'Long format (manual upload)',
}

/**
 * A fixed "now" for the whole prototype.
 *
 * Every generated timestamp derives from this rather than `Date.now()`, so the
 * seeded data — and therefore every screenshot and demo beat — is identical on
 * every machine and every run. The RFP's project start is 01/08/2026.
 */
export const DEMO_NOW = new Date('2026-08-01T09:00:00.000Z')
