/**
 * The formula engine, wired to xMart.
 *
 * This is the only place the pure engine meets data, and it is deliberately
 * thin: pull one country's reported series through `XMartClient`, index it, and
 * hand the engine a resolver closure over the index. `domain/formula` stays
 * free of React and of any knowledge of where values come from (CLAUDE.md
 * structural rules 1 and 2), and swapping the mock client for a real one
 * changes nothing here.
 *
 * **Why the whole 2000–2024 series for one country rather than a single year.**
 * `PREV`, `GROWTH`, `INTERPOLATE` and `EXTRAPOLATE` read across years, so a
 * one-year slice would silently blank them. A country-century of reported
 * codes is a few thousand rows — derived, not stored — so it costs nothing.
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FIRST_YEAR, LAST_YEAR, YEARS } from '@/domain/constants'
import {
  aggregatesFromVariables,
  baseVariableCodes,
  createFormulaEngine,
  type EngineFormula,
  type FormulaEngine,
} from '@/domain/formula'
import type { Formula } from '@/domain/types'
import { mockXMartClient } from '@/data/xmart/mockClient'
import { useFormulas, useVariables } from './useSetupData'

/** Reported values for one country, keyed `${code}|${year}`. */
type ReportedIndex = ReadonlyMap<string, number | null>

function useCountrySeries(iso3: string | null) {
  return useQuery({
    queryKey: ['xmart', 'observations', 'series', iso3],
    enabled: iso3 != null,
    // A country's reported series is stable for the session unless it is edited.
    staleTime: 60 * 1000,
    queryFn: async (): Promise<ReportedIndex> => {
      const page = await mockXMartClient.getObservations({
        countries: iso3 ? [iso3] : [],
        yearFrom: FIRST_YEAR,
        yearTo: LAST_YEAR,
        includeDeleted: false,
        pageSize: 500_000,
      })

      const index = new Map<string, number | null>()
      for (const o of page.rows) {
        const codes = Object.values(o.dims).filter((v): v is string => v != null && v !== '')
        // Crosses are multi-dimension tuples, never formula inputs.
        if (codes.length !== 1) continue
        const code = codes[0]
        if (code != null) index.set(`${code}|${o.year}`, o.value)
      }
      return index
    },
  })
}

export interface UseFormulaEngineResult {
  engine: FormulaEngine | null
  isLoading: boolean
  /** How many reported values back the engine — shown beside the picker. */
  observationCount: number
}

/**
 * Build an engine for one country.
 *
 * `formulaOverride` lets a screen feed in formulas it holds locally — the Setup
 * tab's unsaved drafts and UC029 country overrides — so the preview reflects
 * what is on screen rather than only what xMart has committed.
 */
export function useFormulaEngine(
  iso3: string | null,
  formulaOverride?: readonly Formula[],
): UseFormulaEngineResult {
  const { data: variables, isLoading: variablesLoading } = useVariables()
  const { data: fetchedFormulas, isLoading: formulasLoading } = useFormulas()
  const { data: reported, isLoading: seriesLoading } = useCountrySeries(iso3)

  const formulas = formulaOverride ?? fetchedFormulas

  const engine = useMemo(() => {
    if (!variables || !formulas || !reported) return null

    const engineFormulas: EngineFormula[] = formulas.map((f) => ({
      code: f.code,
      expression: f.expression,
      nullPolicy: f.nullPolicy,
      countryOverrides: f.countryOverrides,
      isLegacy: f.isLegacy,
    }))

    return createFormulaEngine({
      formulas: engineFormulas,
      aggregates: aggregatesFromVariables(variables),
      baseVariables: baseVariableCodes(variables),
      years: YEARS,
      resolveReported: (_iso3, year, code) => reported.get(`${code}|${year}`) ?? null,
    })
  }, [variables, formulas, reported])

  return {
    engine,
    isLoading: variablesLoading || formulasLoading || seriesLoading,
    observationCount: reported?.size ?? 0,
  }
}
