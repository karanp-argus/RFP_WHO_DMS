/**
 * The bridge between the seeded corpus and the pure pivot engine.
 *
 * Same shape as `data/qc/qcAccess.ts`, and for the same reason: `domain/report`
 * reads every value through a closure, so this is the only file in Phase 6 that
 * knows the corpus is mocked. Swap `XMartClient` and this file's inputs change;
 * `pivot.ts` does not.
 *
 * **Values come through the formula engine, not straight from the fetch.**
 * A report naming `CHE%GDP_SHA2011` is naming an indicator that is never
 * stored — it is `CHE / GDP * 100`, where `CHE` is itself the sum of five `HF`
 * children, all resolved by the Phase 3 engine with its null guard intact.
 * Reading the raw page for it would return nothing and the column would be
 * blank in every row, which is exactly the failure the QC access was written to
 * avoid.
 */

import {
  aggregatesFromVariables,
  baseVariableCodes,
  createFormulaEngine,
  referencedCodes,
  type EngineFormula,
  type FormulaEngine,
} from '@/domain/formula'
import {
  ENGLISH_VOCABULARY,
  MONETARY_MACRO_CODES,
  translateUnit,
  variableLabel,
  type ReportDataAccess,
  type ReportFieldId,
  type ReportVocabulary,
} from '@/domain/report'
import { UNITS, YEARS } from '@/domain/constants'
import type { Country, Currency, Formula, Variable } from '@/domain/types'

export interface ReportAccessInput {
  /** Reported values keyed `iso3|year|code` — the engine's door to the data. */
  reported: ReadonlyMap<string, number | null>
  variables: readonly Variable[]
  countries: readonly Country[]
  currencies: readonly Currency[]
  formulas: readonly Formula[]
  /**
   * UC041 — the language every label this closure produces comes back in.
   * Defaults to English, which is also what an untranslated code falls back to.
   */
  vocabulary?: ReportVocabulary
}

export interface ReportAccessResult {
  access: ReportDataAccess
  engine: FormulaEngine
}

/** NCU per US$ — the MACRO series every dollar conversion divides by. */
const EXCHANGE_RATE_CODE = 'EXR'

/**
 * Indicators carry no ICHA dimension of their own, so they group under `IND` —
 * which is a real member of the fifteen-dimension list, not a pseudo-value.
 */
const INDICATOR_GROUP = 'IND'

export function buildReportAccess(input: ReportAccessInput): ReportAccessResult {
  const {
    reported,
    variables,
    countries,
    currencies,
    formulas,
    vocabulary = ENGLISH_VOCABULARY,
  } = input

  const variableByCode = new Map(variables.map((v) => [v.code, v]))
  const countryByIso3 = new Map(countries.map((c) => [c.CODE_ISO_3, c]))
  const currencyByCode = new Map(currencies.map((c) => [c.CODE_ISO_3, c]))
  const formulaByCode = new Map(formulas.map((f) => [f.code, f]))
  const aggregates = aggregatesFromVariables(variables)

  const engineFormulas: EngineFormula[] = formulas.map((f) => ({
    code: f.code,
    expression: f.expression,
    nullPolicy: f.nullPolicy,
    countryOverrides: f.countryOverrides,
    isLegacy: f.isLegacy,
  }))

  const engine = createFormulaEngine({
    formulas: engineFormulas,
    aggregates,
    baseVariables: baseVariableCodes(variables),
    years: YEARS,
    resolveReported: (iso3, year, code) => reported.get(`${iso3}|${year}|${code}`) ?? null,
  })

  /**
   * A pivot reads each coordinate once, but a run with an exchange-rate
   * conversion reads `EXR` once per coordinate — up to two hundred times per
   * country-year. The engine memoises its own resolution; this caches the
   * composed answer, which is what the ~10^5-read loop actually calls.
   */
  const valueCache = new Map<string, number | null>()

  function valueOf(iso3: string, year: number, code: string): number | null {
    const key = `${iso3}|${year}|${code}`
    const hit = valueCache.get(key)
    if (hit !== undefined) return hit
    const direct = reported.get(key)
    const value = direct !== undefined ? direct : engine.valueOf(code, iso3, year)
    valueCache.set(key, value)
    return value
  }

  function unitOf(code: string): string {
    const formula = formulaByCode.get(code)
    if (formula) return formula.unit
    // See `domain/report/units.ts`: the MACRO dimension mixes monetary series
    // with population, an exchange rate and a PPP factor, so its dimension-level
    // `isCurrency: false` is wrong for three of its six members.
    if (MONETARY_MACRO_CODES.includes(code)) return UNITS.NCU_MILLIONS
    return variableByCode.get(code)?.unit ?? UNITS.COUNT
  }

  function classificationOf(code: string): string {
    return variableByCode.get(code)?.dimension ?? INDICATOR_GROUP
  }

  /**
   * UC041: the pack's label if it has one, otherwise the seeded English name.
   *
   * Falling back rather than failing is deliberate — a custom formula an
   * administrator wrote this morning (UC030) has no translation and never will
   * have one in a seed file, and it should appear under the name they gave it.
   */
  function variableLabelOf(code: string): string {
    const english = variableByCode.get(code)?.label ?? formulaByCode.get(code)?.name ?? code
    return variableLabel(code, english, vocabulary)
  }

  const access: ReportDataAccess = {
    valueOf,

    fieldKey: (field, c): string => {
      switch (field) {
        case 'country':
        case 'iso3':
          return c.iso3
        case 'region':
          return countryByIso3.get(c.iso3)?.GRP_WHO_REGION ?? 'Unknown'
        case 'income':
          return countryByIso3.get(c.iso3)?.GRP_WB_INCOME ?? 'Unknown'
        case 'oecd':
          return countryByIso3.get(c.iso3)?.GRP_OECD ? 'OECD' : 'Non-OECD'
        case 'currency':
          return countryByIso3.get(c.iso3)?.CURRENCY_ISO_3 || 'Unknown'
        case 'year':
          return String(c.year)
        case 'variable':
        case 'variableCode':
          return c.code
        case 'classification':
          return classificationOf(c.code)
        case 'unit':
          return unitOf(c.code)
      }
    },

    /**
     * UC041 translates *labels*; it explicitly does not translate field values
     * (*"any report displaying text as part of the fields values … will not be
     * translated"*). Country and currency names are values — the xMart registry
     * holds one name each — so they come back as registered in every language,
     * while a WHO region, an income group and a classification are vocabulary
     * and move with the report.
     */
    fieldLabel: (field: ReportFieldId, key: string): string => {
      switch (field) {
        case 'country':
          return countryByIso3.get(key)?.NAME_SHORT_EN ?? key
        case 'region':
          return vocabulary.regions[key] ?? key
        case 'income':
          return vocabulary.incomes[key] ?? key
        case 'oecd':
          return vocabulary.oecd[key] ?? key
        case 'currency':
          return currencyByCode.get(key)?.TITLE ?? key
        case 'variable':
          return variableLabelOf(key)
        case 'classification':
          return vocabulary.dimensions[key] ?? key
        case 'unit':
          return translateUnit(key, vocabulary)
        default:
          return key
      }
    },

    unitOf,

    exchangeRate: (iso3, year) => valueOf(iso3, year, EXCHANGE_RATE_CODE),

    currencyOf: (iso3) => countryByIso3.get(iso3)?.CURRENCY_ISO_3 ?? '',
  }

  return { access, engine }
}

/**
 * Every reported code a run must pull, with aggregates **and formulas**
 * expanded to the leaves they are computed from.
 *
 * This goes one step further than the QC expander (`reportedCodesFor`) and the
 * difference is load-bearing. A QC rule names classification codes, so
 * expanding parents to children is enough. A report names *indicators* —
 * `CHE%GDP_SHA2011` is the whole point of the module — and an indicator's
 * inputs are reachable only through its expression: `CHE / GDP * 100`, where
 * `CHE` is `HF.1 + … + HF.nec` and each of those is a parent in its own right.
 * Expanding only aggregates would fetch nothing for it and the column would be
 * blank in every row, which is precisely the failure `qcAccess` was written to
 * avoid, one level further down.
 *
 * `EXR` and `POP` are always included. Any run may be switched to US dollars
 * from the run page after the fetch, and re-pulling the whole scope because
 * somebody changed a dropdown would be a very visible way to look slow.
 */
export function reportFetchCodes(
  codes: readonly string[],
  variables: readonly Variable[],
  formulas: readonly Formula[],
): string[] {
  const aggregates = aggregatesFromVariables(variables)
  const base = new Set(baseVariableCodes(variables))

  // A parse-only engine: it never resolves a value, it is here for `astFor`.
  const engine = createFormulaEngine({
    formulas: formulas.map((f) => ({
      code: f.code,
      expression: f.expression,
      nullPolicy: f.nullPolicy,
      countryOverrides: f.countryOverrides,
      isLegacy: f.isLegacy,
    })),
    aggregates,
    baseVariables: base,
    years: YEARS,
    resolveReported: () => null,
  })

  const out = new Set<string>()
  const seen = new Set<string>()

  const expand = (code: string, depth = 0): void => {
    // The classification is three levels deep and the formula set two; the
    // bound is a backstop against a malformed graph, not an expected condition.
    if (depth > 12 || seen.has(code)) return
    seen.add(code)

    // Reported first, which is also what resolves `GGHE-D` — a formula whose
    // expression is an identity onto the MACRO variable of the same name.
    if (base.has(code)) {
      out.add(code)
      return
    }
    const children = aggregates.get(code)
    if (children && children.length > 0) {
      for (const child of children) expand(child, depth + 1)
      return
    }
    const ast = engine.astFor(code)
    if (ast) {
      for (const ref of referencedCodes(ast)) expand(ref, depth + 1)
    }
  }

  for (const code of codes) expand(code)
  for (const code of [EXCHANGE_RATE_CODE, 'POP']) expand(code)

  return [...out]
}
