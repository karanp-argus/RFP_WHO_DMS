/**
 * The values a filter can be set to, per field.
 *
 * Enumerated from the seeded configuration rather than from the data, which is
 * the right way round: a filter offering only the values that happen to appear
 * in the current corpus would quietly change its options as the corpus grows,
 * and a saved report's filter would then mean something different next year.
 * Country attributes come from the country list, years from the constant span,
 * and variable-side fields from the report's own variable selection — because
 * offering all ~250 codes when the report reads nineteen of them is a list
 * nobody can use.
 */

import {
  DIMENSIONS,
  DIMENSION_LABELS,
  UNITS,
  WB_INCOME_GROUPS,
  WB_INCOME_LABELS,
  WHO_REGIONS,
  WHO_REGION_LABELS,
  YEARS,
} from '@/domain/constants'
import { MONETARY_MACRO_CODES, type ReportFieldId } from '@/domain/report'
import type { Country, Formula, Variable } from '@/domain/types'

export interface FilterOption {
  value: string
  label: string
}

export interface FilterOptionInput {
  field: ReportFieldId
  countries: readonly Country[]
  variables: readonly Variable[]
  formulas: readonly Formula[]
  /** The report's own variable codes; empty falls back to every known code. */
  reportVariables: readonly string[]
}

function unitOf(
  code: string,
  variableByCode: ReadonlyMap<string, Variable>,
  formulaByCode: ReadonlyMap<string, Formula>,
): string {
  const formula = formulaByCode.get(code)
  if (formula) return formula.unit
  if (MONETARY_MACRO_CODES.includes(code)) return UNITS.NCU_MILLIONS
  return variableByCode.get(code)?.unit ?? UNITS.COUNT
}

export function filterOptions(input: FilterOptionInput): FilterOption[] {
  const { field, countries, variables, formulas, reportVariables } = input
  const variableByCode = new Map(variables.map((v) => [v.code, v]))
  const formulaByCode = new Map(formulas.map((f) => [f.code, f]))

  const codes =
    reportVariables.length > 0
      ? [...reportVariables]
      : [...variables.map((v) => v.code), ...formulas.map((f) => f.code)]

  switch (field) {
    case 'country':
    case 'iso3':
      return countries.map((c) => ({
        value: c.CODE_ISO_3,
        label: `${c.NAME_SHORT_EN} (${c.CODE_ISO_3})`,
      }))

    case 'region':
      return WHO_REGIONS.map((r) => ({ value: r, label: `${r} — ${WHO_REGION_LABELS[r]}` }))

    case 'income':
      return WB_INCOME_GROUPS.map((g) => ({ value: g, label: `${g} — ${WB_INCOME_LABELS[g]}` }))

    case 'oecd':
      return [
        { value: 'OECD', label: 'OECD members' },
        { value: 'Non-OECD', label: 'Non-members' },
      ]

    case 'currency': {
      const seen = new Map<string, string>()
      for (const c of countries) {
        if (c.CURRENCY_ISO_3) seen.set(c.CURRENCY_ISO_3, c.CURRENCY_ISO_3)
      }
      return [...seen.keys()].sort().map((code) => ({ value: code, label: code }))
    }

    case 'year':
      return YEARS.map((y) => ({ value: String(y), label: String(y) }))

    case 'variable':
    case 'variableCode':
      return codes.map((code) => {
        const label = variableByCode.get(code)?.label ?? formulaByCode.get(code)?.name
        return { value: code, label: label ? `${code} — ${label}` : code }
      })

    case 'classification':
      // `IND` is already one of the fifteen dimensions, and it is the group
      // `reportAccess` files a formula-derived indicator under.
      return DIMENSIONS.map((d) => ({ value: d, label: `${d} — ${DIMENSION_LABELS[d]}` }))

    case 'unit': {
      const seen = new Set(codes.map((code) => unitOf(code, variableByCode, formulaByCode)))
      return [...seen].sort().map((u) => ({ value: u, label: u }))
    }
  }
}
