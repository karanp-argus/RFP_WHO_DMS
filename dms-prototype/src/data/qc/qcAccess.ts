/**
 * The bridge between the seeded corpus and the pure QC runner.
 *
 * `domain/qc/runner.ts` reads every value through a `QcDataAccess` closure, the
 * same way the formula engine reads through `resolveReported`. This is the file
 * that builds that closure out of what `XMartClient` returned — and it is the
 * only place in Phase 5 that knows the corpus is mocked. Swap the client and
 * this file's inputs change shape; the runner does not.
 *
 * **Values come through the formula engine, not straight from the fetch.**
 * A QC rule names codes like `HF.1` and `HF TOT`, which per CLAUDE.md are never
 * stored — they are summed from their children by the engine. Reading the raw
 * page for `HF TOT` would return nothing and every reconciliation rule would
 * silently check blank against blank and pass.
 */

import {
  aggregatesFromVariables,
  baseVariableCodes,
  createFormulaEngine,
  type EngineFormula,
  type FormulaEngine,
} from '@/domain/formula'
import { observationKey } from '@/domain/keys'
import type { QcDataAccess, QcGroupAttribute, QcVersionPoint } from '@/domain/qc'
import { YEARS, type DimensionCode } from '@/domain/constants'
import type { Country, Formula, Observation, ObservationVersion, Variable } from '@/domain/types'

export interface QcAccessInput {
  /** Full records, keyed by observation key — the source of notes and metadata. */
  observations: ReadonlyMap<string, Observation>
  /** Reported values keyed `iso3|year|code` — the engine's door to the data. */
  reported: ReadonlyMap<string, number | null>
  /** Prior versions keyed by observation key. Absent keys simply have none. */
  versions: ReadonlyMap<string, readonly ObservationVersion[]>
  variables: readonly Variable[]
  countries: readonly Country[]
  formulas: readonly Formula[]
}

export interface QcAccessResult {
  access: QcDataAccess
  /** Exposed so a caller can show what the engine computed alongside a finding. */
  engine: FormulaEngine
}

/**
 * The code every `share-of-che` normalisation divides by.
 *
 * `CHE` is a seeded formula (`HF.1 + HF.2 + HF.3 + HF.4 + HF.nec`), so it
 * resolves through the engine like any other indicator rather than being looked
 * up. Using the formula rather than `HF TOT` directly is deliberate: if an
 * administrator customises `CHE` for a country under UC029, the outlier rule
 * should compare against the country's own definition of its total.
 */
const CHE_CODE = 'CHE'

export function buildQcAccess(input: QcAccessInput): QcAccessResult {
  const { observations, reported, versions, variables, countries, formulas } = input

  const variableByCode = new Map(variables.map((v) => [v.code, v]))
  const countryByIso3 = new Map(countries.map((c) => [c.CODE_ISO_3, c]))
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
   * A run reads the same coordinate many times — ten rules over one country-year
   * touch `CHE` repeatedly, and every `share-of-che` normalisation touches it
   * once per country per year. The engine memoises its own resolution, but the
   * key construction and map lookups around it are not free at ~10^5 reads, so
   * the composed answer is cached too.
   */
  const valueCache = new Map<string, number | null>()

  function valueOf(iso3: string, year: number, code: string): number | null {
    const key = `${iso3}|${year}|${code}`
    const hit = valueCache.get(key)
    if (hit !== undefined) return hit

    // A reported leaf is answered from the fetch; anything calculated —
    // parents, totals, indicators — goes through the engine.
    const direct = reported.get(key)
    const value = direct !== undefined ? direct : engine.valueOf(code, iso3, year)
    valueCache.set(key, value)
    return value
  }

  function keyFor(iso3: string, year: number, code: string): string {
    const dimension = variableByCode.get(code)?.dimension
    // Indicators carry no dimension and therefore no stored observation. The
    // synthetic key matches the one `useWorkbookData` builds, so a finding on a
    // calculated row still rings the right cell in the grid (UC052).
    return dimension
      ? observationKey(iso3, year, { [dimension as DimensionCode]: code })
      : `${iso3}-${year}#IND=${code}`
  }

  const access: QcDataAccess = {
    valueOf,

    observationKeyOf: keyFor,

    childrenOf: (code) => aggregates.get(code) ?? [],

    labelOf: (code) => variableByCode.get(code)?.label ?? code,

    countryName: (iso3) => countryByIso3.get(iso3)?.NAME_SHORT_EN ?? iso3,

    attributeOf: (iso3, attribute: QcGroupAttribute) => {
      const country = countryByIso3.get(iso3)
      if (!country) return 'Unknown'
      if (attribute === 'GRP_OECD') return country.GRP_OECD ? 'OECD' : 'Non-OECD'
      return String(country[attribute] ?? 'Unknown')
    },

    versionsOf: (iso3, year, code): readonly QcVersionPoint[] => {
      const history = versions.get(keyFor(iso3, year, code))
      if (!history || history.length === 0) return []
      return history.map((v) => ({
        versionNumber: v.versionNumber,
        value: v.value,
        commitDateUtc: v.commitDateUtc,
        author: v.author,
      }))
    },

    noteOf: (iso3, year, code) => observations.get(keyFor(iso3, year, code))?.metadata.COMMENT,

    cheOf: (iso3, year) => valueOf(iso3, year, CHE_CODE),
  }

  return { access, engine }
}

/**
 * Every reported code a rule set needs, aggregates expanded to their leaves.
 *
 * A run must fetch the codes the rules *name*, plus everything those codes are
 * computed from — asking xMart for `HF TOT` returns nothing, because it is
 * summed here. Without this expansion a reconciliation rule would compare two
 * blanks and report a clean bill of health over data it never read.
 */
export function reportedCodesFor(
  rules: readonly { variables: string[]; leftCodes: string[]; rightCodes: string[] }[],
  variables: readonly Variable[],
  extraCodes: readonly string[] = [],
): string[] {
  const aggregates = aggregatesFromVariables(variables)
  const reported = new Set(baseVariableCodes(variables))
  const out = new Set<string>()

  const expand = (code: string, depth = 0): void => {
    // The classification is three levels deep; the bound is a backstop against
    // a malformed aggregate map rather than an expected condition.
    if (depth > 8) return
    if (reported.has(code)) {
      out.add(code)
      return
    }
    const children = aggregates.get(code)
    if (!children) return
    for (const child of children) expand(child, depth + 1)
  }

  for (const rule of rules) {
    for (const code of [...rule.variables, ...rule.leftCodes, ...rule.rightCodes]) expand(code)
  }
  for (const code of extraCodes) expand(code)

  return [...out]
}
