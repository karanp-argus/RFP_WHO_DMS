/**
 * Core domain types.
 *
 * These mirror the xMart contract from plan §1.3 rather than inventing a
 * convenient shape, because DMS owns no master data — xMart is the warehouse
 * and DMS pulls/pushes across an API (UC045/UC046). Where a type IS an xMart
 * record (Country, Currency) the SHOUTY_FIELD_NAMES are kept verbatim: those
 * are the column names the Setup module displays, and matching them exactly is
 * part of showing we read the annexes.
 *
 * Pure types — no React, no stores.
 */

import type {
  DimensionCode,
  MetadataFieldCode,
  PublishingStatus,
  SourceFormat,
  WbIncome,
  WhoLanguage,
  WhoRegion,
} from './constants'

/* ==========================================================================
   OBSERVATIONS
   ========================================================================== */

/**
 * Which classification members an observation sits at.
 *
 * **Sparse by design.** A plain `HF.1` observation fills only `HF`. A cross of
 * `HC.1 × HF.1` fills both `HC` and `HF`. A cross is therefore NOT a separate
 * entity in storage — it is a multi-dimension tuple. Do not add a `crossId`
 * field here; see CLAUDE.md.
 */
export type Dimensions = Partial<Record<DimensionCode, string>>

/** Free-text/date/LOV metadata carried by an observation (UC027). */
export type ObservationMetadata = Partial<Record<MetadataFieldCode, string>>

/**
 * xMart's native system columns. `Sys_CommitDateUtc` is the substrate for
 * UC043/UC044 version compare and restore, and for the Annex 3 `LastModified`
 * range filter — versions are commit-stamped snapshots, not a bespoke audit log.
 */
export interface SysFields {
  Sys_RowId: string
  Sys_Origin: string
  Sys_LoadBatchId: number
  Sys_CommitDateUtc: string
  Sys_FirstLoadUser: string
  Sys_ID: string
  Sys_BatchId: number
  Sys_FirstBatchID: number
  /** Annex 3 requires soft-deleted rows to be retrievable and filterable. */
  Sys_IsDeleted: boolean
}

/**
 * A single data point: 1 country × 1 year × 1 variable-or-cross.
 *
 * Per FR §1 it is valid with `value: null` provided it carries metadata — "an
 * observation can have: both a value and metadata field(s) filled; no values
 * and metadata field(s) filled; a value and no metadata fields filled".
 */
export interface Observation {
  /** `{ISO3}-{YEAR}`, e.g. `ARG-2021`. The country × year key. */
  surveyFk: string
  iso3: string
  year: number
  dims: Dimensions
  value: number | null
  metadata: ObservationMetadata
  /**
   * DMS-side formula text when this cell is computed rather than reported
   * (UC031: "the cell contents will display the terms of the formula"). Absent
   * on country-reported values.
   */
  formula?: string
  publishingStatus: PublishingStatus
  sys: SysFields
}

/** A prior version of one observation (UC043/UC044 — up to 10 are exposed). */
export interface ObservationVersion {
  /** Stable key of the observation this version belongs to. */
  observationKey: string
  versionNumber: number
  value: number | null
  metadata: ObservationMetadata
  formula?: string
  commitDateUtc: string
  author: string
  batchId: number
}

/* ==========================================================================
   VARIABLES, CLASSIFICATIONS, CROSSES
   ========================================================================== */

/** A classification, e.g. HF — "Health care financing schemes (ICHA-HF)". */
export interface Classification {
  code: DimensionCode
  label: string
  /** False for IND and MACRO, which are DMS-side rather than ICHA classifications. */
  isIcha: boolean
}

/**
 * A measured characteristic: either a classification category (`HF.1`) or a
 * calculated indicator (`CHE%GDP_SHA2011`).
 *
 * FR §1: "Indicator is a data point measure derived/calculated from one or more
 * variables and not reported by country" — hence `isCalculated`.
 */
export interface Variable {
  code: string
  /** The dimension this category belongs to; null for pure indicators. */
  dimension: DimensionCode | null
  label: string
  /** Labels per WHO official language, for multilanguage reports (HLR21/UC041). */
  labels: Partial<Record<WhoLanguage, string>>
  parentCode: string | null
  level: number
  /** True for indicators — never country-reported, always computed. */
  isCalculated: boolean
  /** Variable attribute from FR §1: "currency measured yes or no". */
  isCurrency: boolean
  unit: string
  /** Hierarchy sort key, so tree order survives a flat list. */
  sortKey: string
}

/**
 * A cross of two or more classifications (`HF.1xFS.1`).
 *
 * Predefined crosses are admin-authored and visible to all (UC025); custom
 * crosses are user-authored and scoped to specific countries (UC026).
 */
export interface Cross {
  id: string
  /** Standard notation, e.g. `HC.1xHF.1`. */
  code: string
  label: string
  /** The dimension members that make up the tuple. */
  members: Dimensions
  scope: 'predefined' | 'custom'
  /** Populated only for custom crosses — the countries they apply to (UC026). */
  countryScope: string[]
  createdBy: string
}

/* ==========================================================================
   FORMULAS
   ========================================================================== */

/**
 * How a formula behaves when its inputs are missing.
 *
 * Every seeded formula in plan §1.4 carries one of these conditions, and the
 * distinction is load-bearing: a failed guard yields **blank, not 0**, which is
 * visible in exports. This is a first-class field, not an afterthought.
 */
export type NullPolicy = 'any-not-null' | 'all-not-null'

export interface Formula {
  id: string
  /** Indicator code produced, e.g. `CHE%GDP_SHA2011`. */
  code: string
  /** Short code used in reports, e.g. `che_gdp`. */
  shortCode: string
  name: string
  /** Grouping folder from the FR table: AGGREGATES, FINANCING SOURCES, … */
  folder: string
  /** Expression source, e.g. `CHE / GDP * 100`. Parsed by domain/formula. */
  expression: string
  nullPolicy: NullPolicy
  /** Human rendering of the condition, straight from the FR table. */
  conditionLabel: string
  unit: string
  scope: 'predefined' | 'custom'
  /**
   * UC029: an admin may customise a predefined formula for one country without
   * altering it for the others. Keyed by ISO3 → overriding expression.
   */
  countryOverrides: Record<string, string>
  /** UC030: custom formulas are scoped to a country, workbook or observation. */
  countryScope: string[]
  createdBy: string
  /** UC060: migrated old-DMS formulas are read-only reference text. */
  isLegacy: boolean
}

/* ==========================================================================
   SETUP COMPONENTS — xMart records, field names verbatim (plan §1.3)
   ========================================================================== */

/**
 * xMart "Country/Area List". Fields transcribed from the FR screenshot.
 * `GRP_OECD`, `FOCAL_POINT_*` and `REPORTING_*` are DMS-side additions — FR §1
 * lists focal point and OECD membership among the country attributes, and
 * UC023 needs the reporting follow-up fields.
 */
export interface Country {
  CODE_ISO_3: string
  CODE_ISO_2: string
  CODE_ISO_NUMERIC: number
  CODE_WHO: string
  NAME_SHORT_EN: string
  NAME_FORMAL_EN: string
  ADJECTIVE_PEOPLE: string
  CAPITAL_CITY: string
  NAME_SHORT_AR: string
  NAME_SHORT_ES: string
  NAME_SHORT_FR: string
  NAME_SHORT_RU: string
  NAME_SHORT_ZH: string
  WHO_LEGAL_STATUS: string
  WHO_LEGAL_STATUS_TITLE: string
  SOVEREIGN_ISO_3: string
  GRP_WHO_REGION: WhoRegion
  GRP_WHO_REGION_OFFICE: string
  GRP_WB_INCOME: WbIncome
  POP_SMALL: number
  /** DMS additions */
  GRP_OECD: boolean
  CURRENCY_ISO_3: string
  FOCAL_POINT_NAME: string
  FOCAL_POINT_EMAIL: string
  /** UC024 — whether this country is currently disabled for new assignment. */
  IS_ENABLED: boolean
}

/** xMart "Currency List". Fields transcribed from the FR screenshot. */
export interface Currency {
  CODE_ISO_3: string
  TITLE: string
  CODE_ISO_NUMERIC: number
  DESCRIPTION: string
  SYMBOL: string
  SYMBOL_BEFORE: boolean
  DEC_PLACES: number
  TITLE_EN: string
  TITLE_FR: string
  TITLE_ES: string
  TITLE_AR: string
  TITLE_RU: string
  TITLE_ZH: string
}

/**
 * Definition of one attribute column on a Setup component.
 *
 * Drives UC015 (drag-reorder, persisted `order`), UC016 (editable list of
 * values), UC018 (create new attributes, hence the `type` discriminator) and
 * UC022 (`groupable` — "a flag that will determine whether that attribute will
 * be available for country grouping / filtering").
 */
export interface AttributeDef {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'lov' | 'boolean'
  /** Allowed values when `type` is 'lov' (UC016). */
  lov?: string[]
  groupable: boolean
  required: boolean
  order: number
  /** xMart-sourced attributes cannot be deleted from DMS. */
  isSystem: boolean
}

/** Definition of an observation metadata field (UC027). */
export interface MetadataFieldDef {
  code: MetadataFieldCode
  label: string
  type: 'text' | 'date' | 'lov'
  lov?: string[]
  /** UC027 splits the Metadata screen into these two areas. */
  area: 'observation' | 'old-dms-formula'
  order: number
}

/* ==========================================================================
   REPORTING FOLLOW-UP (UC023)
   ========================================================================== */

/** One logged communication with a country about its data submission. */
export interface ReportingContact {
  id: string
  iso3: string
  /** ISO date. */
  requestSentOn: string
  responseDueOn: string
  respondedOn: string | null
  status: 'awaiting' | 'received' | 'overdue' | 'not-requested'
  channel: 'email' | 'call' | 'meeting'
  note: string
  loggedBy: string
}

/* ==========================================================================
   IMPORT / SUBMISSION TRACKING (UC039)
   ========================================================================== */

/**
 * One xMart import batch. Backs the UC039 data tracking report: "the last time
 * data was received for that country, to which series it belongs to, or the
 * format in which it was received".
 */
export interface ImportBatch {
  batchId: number
  iso3: string
  /** The reporting series, e.g. `2026 round`. */
  series: string
  format: SourceFormat
  receivedUtc: string
  rowCount: number
  yearsCovered: [number, number]
  status: 'processed' | 'processed-with-warnings' | 'failed'
  origin: string
}

/* ==========================================================================
   USERS
   ========================================================================== */

export interface DmsUser {
  id: string
  email: string
  displayName: string
  jobTitle: string
  role: 'administrator' | 'regular'
  /** External users are Entra ID guests and are always 'regular' (UC007). */
  isGuest: boolean
  /** UC010/UC011 — disabled, never deleted (UC012). */
  isEnabled: boolean
  /** UC009 — empty means all countries. */
  restrictedCountries: string[]
  lastSeenUtc: string | null
  createdUtc: string
}
