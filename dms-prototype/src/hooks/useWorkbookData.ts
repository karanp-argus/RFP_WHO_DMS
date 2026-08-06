/**
 * Everything one open workbook needs, in one hook.
 *
 * Pulls the selected countries' reported series through `XMartClient` **once**
 * and serves it two ways from the same fetch:
 *
 *  · as `Observation` records, which is what the grid needs — value, metadata,
 *    publishing status and the `Sys_*` fields behind version compare;
 *  · as a `(iso3, year, code) → number | null` resolver, which is what the
 *    Phase 3 formula engine needs.
 *
 * One fetch, because the alternative is two queries that can disagree: a cell
 * showing a reported figure while the aggregate above it was computed from a
 * different snapshot is the kind of bug that only appears in a demo.
 *
 * **Why the whole year span rather than the selected years.** `PREV`, `GROWTH`,
 * `INTERPOLATE` and `EXTRAPOLATE` read across years, and a user who narrows a
 * workbook to 2020–2024 has not asked for their growth indicators to go blank.
 */

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FIRST_YEAR, LAST_YEAR, YEARS, type PublishingStatus } from '@/domain/constants'
import { observationKey } from '@/domain/keys'
import {
  aggregatesFromVariables,
  baseVariableCodes,
  createFormulaEngine,
  type EngineFormula,
  type FormulaEngine,
} from '@/domain/formula'
import {
  buildGridAxes,
  cellCoordinate,
  type CellCoordinate,
  type GridColumn,
  type GridRow,
  type WorkbookSelection,
  type WorkbookShape,
} from '@/domain/workbook'
import type { DimensionCode } from '@/domain/constants'
import type { Observation, Variable } from '@/domain/types'
import { mockXMartClient } from '@/data/xmart/mockClient'
import { useCountries, useFormulas, useVariables } from './useSetupData'

/* --------------------------------------------------------------------------
   The single fetch
   -------------------------------------------------------------------------- */

interface ObservationIndex {
  /** Full records, keyed by observation key — what the grid renders. */
  byKey: ReadonlyMap<string, Observation>
  /** Values only, keyed `iso3|year|code` — what the engine resolves through. */
  reported: ReadonlyMap<string, number | null>
}

const EMPTY_INDEX: ObservationIndex = { byKey: new Map(), reported: new Map() }

function useObservationIndex(iso3s: readonly string[]) {
  // Sorted so two selections with the same countries in a different order share
  // one cache entry rather than refetching.
  const key = [...iso3s].sort().join(',')

  return useQuery({
    queryKey: ['xmart', 'observations', 'workbook', key],
    enabled: iso3s.length > 0,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<ObservationIndex> => {
      const page = await mockXMartClient.getObservations({
        countries: [...iso3s],
        yearFrom: FIRST_YEAR,
        yearTo: LAST_YEAR,
        includeDeleted: false,
        pageSize: 2_000_000,
      })

      const byKey = new Map<string, Observation>()
      const reported = new Map<string, number | null>()

      for (const o of page.rows) {
        byKey.set(observationKey(o.iso3, o.year, o.dims), o)
        const codes = Object.values(o.dims).filter((v): v is string => v != null && v !== '')
        // Crosses are multi-dimension tuples and never formula inputs.
        if (codes.length !== 1) continue
        const code = codes[0]
        if (code != null) reported.set(`${o.iso3}|${o.year}|${code}`, o.value)
      }
      return { byKey, reported }
    },
  })
}

/* --------------------------------------------------------------------------
   One rendered cell
   -------------------------------------------------------------------------- */

export interface WorkbookCell {
  coordinate: CellCoordinate
  observationKey: string
  /** The stored record. Absent where the country reports nothing at all. */
  observation: Observation | null
  /**
   * What the cell shows. For a calculated row this is the engine's result; for
   * a reported row it is the observation's value, edit included.
   */
  value: number | null
  /** UC031: a formula cell "displays the terms of the formula". */
  formula: string | undefined
  /** Parents, totals and indicators — read-only, and pink per the legacy rows. */
  isCalculated: boolean
  hasMetadata: boolean
  publishingStatus: PublishingStatus
  /** Edited in this session and not yet saved to xMart (UC046). */
  isEdited: boolean
  /** Prior versions exist for this observation (UC043/UC044). */
  hasVersions: boolean
}

export interface UseWorkbookDataResult {
  isLoading: boolean
  rows: GridRow[]
  columns: GridColumn[]
  engine: FormulaEngine | null
  variablesByCode: ReadonlyMap<string, Variable>
  /** The cell at a (row, column) intersection, or null if the axes disagree. */
  getCell: (rowKey: string, columnKey: string) => WorkbookCell | null
  /** Re-derive everything after an edit: clears the memo and refetches. */
  invalidate: () => void
  observationCount: number
}

export function useWorkbookData(
  selection: WorkbookSelection,
  shape: WorkbookShape | null,
  dirtyKeys: readonly string[],
): UseWorkbookDataResult {
  const queryClient = useQueryClient()
  const { data: variables } = useVariables()
  const { data: countries } = useCountries()
  const { data: formulas } = useFormulas()
  const { data: index, isLoading } = useObservationIndex(selection.countries)

  const variablesByCode = useMemo(
    () => new Map((variables ?? []).map((v) => [v.code, v])),
    [variables],
  )
  const countriesByIso3 = useMemo(
    () => new Map((countries ?? []).map((c) => [c.CODE_ISO_3, c])),
    [countries],
  )

  const engine = useMemo(() => {
    if (!variables || !formulas || !index) return null
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
      resolveReported: (iso3, year, code) => index.reported.get(`${iso3}|${year}|${code}`) ?? null,
    })
    // `dirtyKeys` is a dependency on purpose: an edit changes what the engine
    // should compute, and rebuilding it is how the memo gets dropped.
  }, [variables, formulas, index, dirtyKeys])

  const { rows, columns } = useMemo(() => {
    if (!shape) return { rows: [] as GridRow[], columns: [] as GridColumn[] }
    return buildGridAxes(selection, shape, variablesByCode, countriesByIso3)
  }, [selection, shape, variablesByCode, countriesByIso3])

  const dirty = useMemo(() => new Set(dirtyKeys), [dirtyKeys])
  const data = index ?? EMPTY_INDEX

  const getCell = useCallback(
    (rowKey: string, columnKey: string): WorkbookCell | null => {
      if (!shape) return null
      const coordinate = cellCoordinate(shape, selection, rowKey, columnKey)
      if (!coordinate) return null

      const variable = variablesByCode.get(coordinate.code)
      const dimension = variable?.dimension
      // A code with no dimension cannot form an observation key; indicators
      // resolve through the engine instead and carry no stored record.
      const key = dimension
        ? observationKey(coordinate.iso3, coordinate.year, {
            [dimension as DimensionCode]: coordinate.code,
          })
        : `${coordinate.iso3}-${coordinate.year}#IND=${coordinate.code}`

      const observation = data.byKey.get(key) ?? null
      const isCalculated = variable?.isCalculated ?? engine?.expressionFor(coordinate.code) != null

      const value = isCalculated
        ? (engine?.valueOf(coordinate.code, coordinate.iso3, coordinate.year) ?? null)
        : (observation?.value ?? null)

      return {
        coordinate,
        observationKey: key,
        observation,
        value,
        formula: observation?.formula ?? engine?.expressionFor(coordinate.code, coordinate.iso3) ?? undefined,
        isCalculated,
        hasMetadata: observation != null && Object.keys(observation.metadata).length > 0,
        publishingStatus: observation?.publishingStatus ?? 'not-publish',
        isEdited: dirty.has(key),
        hasVersions: observation != null,
      }
    },
    [shape, selection, variablesByCode, data, engine, dirty],
  )

  const invalidate = useCallback(() => {
    engine?.invalidate()
    void queryClient.invalidateQueries({ queryKey: ['xmart', 'observations'] })
  }, [engine, queryClient])

  return {
    isLoading,
    rows,
    columns,
    engine,
    variablesByCode,
    getCell,
    invalidate,
    observationCount: data.byKey.size,
  }
}
