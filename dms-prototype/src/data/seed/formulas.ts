/**
 * Predefined indicator formulas — all 16 from the FR §5.8 (HLR8) table,
 * transcribed verbatim including folder, code, short code, expression,
 * condition and unit.
 *
 * Two properties of this set drive the whole formula engine (plan §3.3):
 *
 *  1. **Formulas reference formulas.** `CHE%GDP` → `CHE` → `HF.*`. Evaluation
 *     needs a dependency graph and topological ordering, not substitution.
 *  2. **Every formula carries a null-guard.** "at least one component not null"
 *     vs "CHE and GDP not null" are different policies, and a failed guard must
 *     yield blank rather than 0 — visible in exports, and the RFP cares.
 *
 * `Population` and `Ex. rate` in the FR's expressions map to the MACRO series
 * `POP` and `EXR` respectively; the expressions below use the MACRO codes so
 * they resolve against real variables.
 */

import { UNITS } from '@/domain/constants'
import type { Formula, NullPolicy } from '@/domain/types'

interface Row {
  folder: string
  name: string
  code: string
  shortCode: string
  expression: string
  nullPolicy: NullPolicy
  conditionLabel: string
  unit: string
}

const ROWS: Row[] = [
  {
    folder: 'AGGREGATES',
    name: 'Current Health Expenditure (CHE)',
    code: 'CHE',
    shortCode: 'che',
    expression: 'HF.1 + HF.2 + HF.3 + HF.4 + HF.nec',
    nullPolicy: 'any-not-null',
    conditionLabel: 'at least one component not null',
    unit: UNITS.NCU_MILLIONS,
  },
  {
    folder: 'AGGREGATES',
    name: 'Current Health Expenditure (CHE) as % of Gross Domestic Product (GDP)',
    code: 'CHE%GDP_SHA2011',
    shortCode: 'che_gdp',
    expression: 'CHE / GDP * 100',
    nullPolicy: 'all-not-null',
    conditionLabel: 'CHE and GDP not null',
    unit: UNITS.PERCENT,
  },
  {
    folder: 'AGGREGATES',
    name: 'Current Health Expenditure (CHE) per Capita in US$',
    code: 'CHE_pc_US$_SHA2011',
    shortCode: 'che_pc_usd',
    expression: 'CHE / POP / EXR',
    nullPolicy: 'all-not-null',
    conditionLabel: 'CHE and Population and Ex. Rate not null',
    unit: UNITS.USD_PER_CAPITA,
  },
  {
    folder: 'AGGREGATES',
    name: 'Domestic General Government Expenditure (GGHE-D)',
    code: 'GGHE-D',
    shortCode: 'gghed',
    // The FR gives this as "GGHE-D" — it is reported/sourced rather than
    // derived, so the formula is an identity onto the MACRO series.
    expression: 'GGHE-D',
    nullPolicy: 'any-not-null',
    conditionLabel: 'at least one component not null',
    unit: UNITS.NCU_MILLIONS,
  },
  {
    folder: 'AGGREGATES',
    name: 'Domestic Private Health Expenditure (PVT-D)',
    code: 'PVT-D',
    shortCode: 'pvtd',
    expression: 'FS.4 + FS.5 + FS.6 + FS.nec',
    nullPolicy: 'any-not-null',
    conditionLabel: 'at least one component not null',
    unit: UNITS.NCU_MILLIONS,
  },
  {
    folder: 'AGGREGATES',
    name: 'Health Expenditure from External sources (EXT)',
    code: 'EXT',
    shortCode: 'ext',
    expression: 'FS.2 + FS.7',
    nullPolicy: 'any-not-null',
    conditionLabel: 'at least one component not null',
    unit: UNITS.NCU_MILLIONS,
  },
  {
    folder: 'FINANCING SOURCES',
    name: 'Domestic Health Expenditure (DOM) as % of Current Health Expenditure (CHE)',
    code: 'DOM%CHE_SHA2011',
    shortCode: 'dom_che',
    expression: '(FS.1 + FS.3 + FS.4 + FS.5 + FS.6 + FS.nec) / CHE * 100',
    nullPolicy: 'any-not-null',
    conditionLabel: 'at least one FS component not null and CHE not null',
    unit: UNITS.PERCENT,
  },
  {
    folder: 'FINANCING SOURCES',
    name: 'Domestic General Government Health Expenditure (GGHE-D) as % of Current Health Expenditure (CHE)',
    code: 'GGHE-D%CHE_SHA2011',
    shortCode: 'gghed_che',
    expression: 'GGHE-D / CHE * 100',
    nullPolicy: 'all-not-null',
    conditionLabel: 'GGHE-D and CHE not null',
    unit: UNITS.PERCENT,
  },
  {
    folder: 'FINANCING SOURCES',
    name: 'Domestic Private Health Expenditure (PVT-D) as % of Current Health Expenditure (CHE)',
    code: 'PVT-D%CHE_SHA2011',
    shortCode: 'pvtd_che',
    expression: 'PVT-D / CHE * 100',
    nullPolicy: 'all-not-null',
    conditionLabel: 'PVT-D and CHE not null',
    unit: UNITS.PERCENT,
  },
  {
    folder: 'FINANCING SOURCES',
    name: 'Household Out-of-Pocket Expenditure (OOP) as % of Current Health Expenditure (CHE)',
    code: 'OOPS%CHE_SHA2011',
    shortCode: 'oop_che',
    expression: 'HF.3 / CHE * 100',
    nullPolicy: 'all-not-null',
    conditionLabel: 'HF.3 and CHE not null',
    unit: UNITS.PERCENT,
  },
  {
    folder: 'FINANCING SOURCES',
    name: 'Voluntary prepayments as % of Current Health Expenditure (CHE)',
    code: 'VPP%CHE_SHA2011',
    shortCode: 'vpp_che',
    expression: 'FS.5 / CHE * 100',
    nullPolicy: 'all-not-null',
    conditionLabel: 'FS.5 and CHE not null',
    unit: UNITS.PERCENT,
  },
  {
    folder: 'FINANCING SOURCES',
    name: 'Health Expenditure from External sources (EXT) as % of Current Health Expenditure (CHE)',
    code: 'EXT%CHE_SHA2011',
    shortCode: 'ext_che',
    expression: 'EXT / CHE * 100',
    nullPolicy: 'all-not-null',
    conditionLabel: 'EXT and CHE not null',
    unit: UNITS.PERCENT,
  },
  {
    folder: 'FINANCING SOURCES',
    name: 'Domestic General Government Health Expenditure (GGHE-D) as % of Gross Domestic Product (GDP)',
    code: 'GGHE-D%GDP_SHA2011',
    shortCode: 'gghed_gdp',
    expression: 'GGHE-D / GDP * 100',
    nullPolicy: 'all-not-null',
    conditionLabel: 'GGHE-D and GDP not null',
    unit: UNITS.PERCENT,
  },
  {
    folder: 'FINANCING SOURCES',
    name: 'Domestic General Government Health Expenditure (GGHE-D) as % of General Government Expenditure (GGE)',
    code: 'GGHE-D%GGE_SHA2011',
    shortCode: 'gghed_gge',
    expression: 'GGHE-D / GGE * 100',
    nullPolicy: 'all-not-null',
    conditionLabel: 'GGHE-D and GGE not null',
    unit: UNITS.PERCENT,
  },
  {
    folder: 'FINANCING SOURCES',
    name: 'Domestic General Government Health Expenditure (GGHE-D) per Capita in US$',
    code: 'GGHE-D_pc_US$_SHA2011',
    shortCode: 'gghed_pc_usd',
    expression: 'GGHE-D / POP / EXR',
    nullPolicy: 'all-not-null',
    conditionLabel: 'GGHE-D and Population and Ex. Rate not null',
    unit: UNITS.USD_PER_CAPITA,
  },
  {
    folder: 'FINANCING SOURCES',
    name: 'Domestic Private Health Expenditure (PVT-D) per Capita in US$',
    code: 'PVT-D_pc_US$_SHA2011',
    shortCode: 'pvtd_pc_usd',
    expression: 'PVT-D / POP / EXR',
    nullPolicy: 'all-not-null',
    conditionLabel: 'PVT-D and Population and Ex. Rate not null',
    unit: UNITS.USD_PER_CAPITA,
  },
]

export const PREDEFINED_FORMULAS: readonly Formula[] = ROWS.map((r, i) => ({
  id: `f-pre-${String(i + 1).padStart(3, '0')}`,
  code: r.code,
  shortCode: r.shortCode,
  name: r.name,
  folder: r.folder,
  expression: r.expression,
  nullPolicy: r.nullPolicy,
  conditionLabel: r.conditionLabel,
  unit: r.unit,
  scope: 'predefined',
  countryOverrides: {},
  countryScope: [],
  createdBy: 'system',
  isLegacy: false,
}))

/**
 * A per-country override, demonstrating UC029: an administrator may customise a
 * predefined formula "for a specific country, so that the formula would not be
 * altered for other countries, but only for the impacted one".
 *
 * Argentina here excludes capital expenditure from CHE — mirroring the
 * "Excluding capital" comment visible in the FR's own ARG long-format
 * screenshot, so the override has a plausible provenance in the demo.
 */
export const FORMULA_COUNTRY_OVERRIDES: Record<string, Record<string, string>> = {
  CHE: {
    ARG: 'HF.1 + HF.2 + HF.3 + HF.4',
  },
}

/**
 * Legacy old-DMS formulas (UC060), migrated to xMart as plain-text metadata and
 * surfaced read-only in DMS. Deliberately written in the old syntax so the
 * "translate into new DMS syntax" gap (UC060.1, non-Pilot) is visible.
 */
export const LEGACY_FORMULAS: readonly Formula[] = [
  {
    id: 'f-legacy-001',
    code: 'OLD_CHE_TOT',
    shortCode: 'old_che',
    name: 'Legacy: CHE total (old DMS)',
    folder: 'OLD DMS FORMULAS',
    expression: '@SUM(HF1:HF4)+@VAL(HFNEC)',
    nullPolicy: 'any-not-null',
    conditionLabel: 'legacy — condition not migrated',
    unit: UNITS.NCU_MILLIONS,
    scope: 'predefined',
    countryOverrides: {},
    countryScope: [],
    createdBy: 'migration',
    isLegacy: true,
  },
  {
    id: 'f-legacy-002',
    code: 'OLD_OOP_SHARE',
    shortCode: 'old_oop',
    name: 'Legacy: OOP share of CHE (old DMS)',
    folder: 'OLD DMS FORMULAS',
    expression: '@DIV(@VAL(HF3),@VAL(CHE))*100',
    nullPolicy: 'all-not-null',
    conditionLabel: 'legacy — condition not migrated',
    unit: UNITS.PERCENT,
    scope: 'predefined',
    countryOverrides: {},
    countryScope: [],
    createdBy: 'migration',
    isLegacy: true,
  },
]

/** Formula codes that resolve to a computed indicator rather than a variable. */
export const FORMULA_CODES: ReadonlySet<string> = new Set(
  PREDEFINED_FORMULAS.map((f) => f.code),
)
