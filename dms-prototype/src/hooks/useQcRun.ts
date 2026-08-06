/**
 * Running the quality checks.
 *
 * The hook owns the awkward part — working out what to fetch — and hands the
 * rest to the pure runner. Three things it does that are worth stating:
 *
 *  · **It fetches only the codes the enabled rules actually need**, aggregates
 *    expanded to the leaves they are summed from. A blanket pull of the whole
 *    corpus for a 44-country scope is several hundred thousand observations to
 *    answer questions about forty codes.
 *  · **It pulls version history in one bulk call**, not one call per
 *    observation. The version-growth rule needs history for every cell it
 *    checks, which is thousands of them.
 *  · **It stamps the run from `DEMO_NOW`**, not the wall clock, so a report's
 *    timestamp is the same in every screenshot — the same rule the whole seeded
 *    corpus follows.
 */

import { useCallback, useState } from 'react'
import { DEMO_NOW, FIRST_YEAR, LAST_YEAR } from '@/domain/constants'
import { observationKey } from '@/domain/keys'
import {
  runQc,
  type QcFinding,
  type QcRule,
  type QcRunResult,
  type QcRunScope,
} from '@/domain/qc'
import type { Observation } from '@/domain/types'
import { mockXMartClient } from '@/data/xmart/mockClient'
import { buildQcAccess, reportedCodesFor } from '@/data/qc/qcAccess'
import { useQcStore, useQcThresholds, rememberFindings } from '@/stores/qcStore'
import { useCountries, useFormulas, useVariables } from './useSetupData'

/** Where a run is up to, so the UI can say something truthful while it waits. */
export type QcRunPhase = 'idle' | 'fetching' | 'versions' | 'evaluating' | 'done' | 'error'

export interface UseQcRunResult {
  phase: QcRunPhase
  /** The most recent result of this session. */
  result: QcRunResult | null
  error: string | null
  isRunning: boolean
  run: (rules: readonly QcRule[], scope: QcRunScope) => Promise<QcRunResult | null>
  reset: () => void
}

/**
 * Run ids and timestamps.
 *
 * A monotonic session counter rather than a random id or the wall clock:
 * `Math.random()` is barred for anything that reaches the screen, and two runs
 * a minute apart in the history read better than two stamped the same second.
 * The first run of a session lands on `DEMO_NOW` exactly, which is what the
 * screenshots show.
 */
let runCounter = 0

function nextRunStamp(): { id: string; utc: string } {
  const n = runCounter++
  return {
    id: `qc-run-${String(n + 1).padStart(3, '0')}`,
    utc: new Date(DEMO_NOW.getTime() + n * 60_000).toISOString(),
  }
}

export function useQcRun(): UseQcRunResult {
  const { data: variables } = useVariables()
  const { data: formulas } = useFormulas()
  const { data: countries } = useCountries()
  const thresholds = useQcThresholds()
  const recordRun = useQcStore((s) => s.recordRun)

  const [phase, setPhase] = useState<QcRunPhase>('idle')
  const [result, setResult] = useState<QcRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(
    async (rules: readonly QcRule[], scope: QcRunScope): Promise<QcRunResult | null> => {
      if (!variables || !formulas || !countries) {
        setError('Configuration is still loading from xMart.')
        setPhase('error')
        return null
      }

      const enabled = rules.filter((r) => r.isEnabled)
      if (enabled.length === 0) {
        setError('No rules are enabled. Enable at least one rule before running.')
        setPhase('error')
        return null
      }
      if (scope.countries.length === 0) {
        setError('No countries in scope. Choose a country or a group before running.')
        setPhase('error')
        return null
      }

      setError(null)
      setPhase('fetching')

      try {
        // `CHE` is always needed: every outlier normalisation divides by it,
        // and the atypical-entry rule uses it to tell "no spending here" from
        // "this country reports nothing at all".
        const codes = reportedCodesFor(enabled, variables, ['CHE'])

        const page = await mockXMartClient.getObservations({
          countries: scope.countries,
          // The whole span regardless of the run's year window, for the same
          // reason the workbook pulls it: a year-on-year rule at the first year
          // of the window still needs the year before it.
          yearFrom: FIRST_YEAR,
          yearTo: LAST_YEAR,
          variables: codes,
          includeDeleted: false,
          pageSize: 5_000_000,
        })

        const observations = new Map<string, Observation>()
        const reported = new Map<string, number | null>()
        for (const o of page.rows) {
          observations.set(observationKey(o.iso3, o.year, o.dims), o)
          const dims = Object.values(o.dims).filter((v): v is string => v != null && v !== '')
          const code = dims[0]
          // Crosses are multi-dimension tuples and are never a rule's input.
          if (dims.length === 1 && code) reported.set(`${o.iso3}|${o.year}|${code}`, o.value)
        }

        // Version history, but only for the rules that read it — and only over
        // their own year windows. Asking for the whole scope would be tens of
        // thousands of keys to answer a question four codes are asked about.
        setPhase('versions')
        const versionKeys: string[] = []
        for (const rule of enabled) {
          if (rule.type !== 'version-growth') continue
          const from = Math.max(rule.yearFrom ?? scope.yearFrom, scope.yearFrom)
          const to = Math.min(rule.yearTo ?? scope.yearTo, scope.yearTo)
          for (const iso3 of scope.countries) {
            if (rule.excludedCountries.includes(iso3)) continue
            for (let year = from; year <= to; year++) {
              for (const code of rule.variables) {
                const dimension = variables.find((v) => v.code === code)?.dimension
                if (dimension) versionKeys.push(observationKey(iso3, year, { [dimension]: code }))
              }
            }
          }
        }
        const versions =
          versionKeys.length > 0
            ? await mockXMartClient.getVersionsBulk([...new Set(versionKeys)])
            : new Map()

        setPhase('evaluating')
        const { access } = buildQcAccess({
          observations,
          reported,
          versions,
          variables,
          countries,
          formulas,
        })

        const stamp = nextRunStamp()
        const outcome = runQc({
          rules: enabled,
          scope,
          thresholds,
          data: access,
          runBy: scope.kind === 'workbook' ? 'Workbook' : 'Quality Checks',
          runUtc: stamp.utc,
          runId: stamp.id,
        })

        recordRun(outcome)
        rememberFindings(outcome.summary.id, outcome.findings)
        setResult(outcome)
        setPhase('done')
        return outcome
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setPhase('error')
        return null
      }
    },
    [variables, formulas, countries, thresholds, recordRun],
  )

  const reset = useCallback(() => {
    setPhase('idle')
    setResult(null)
    setError(null)
  }, [])

  return {
    phase,
    result,
    error,
    isRunning: phase === 'fetching' || phase === 'versions' || phase === 'evaluating',
    run,
    reset,
  }
}

export const QC_RUN_PHASE_LABELS: Record<QcRunPhase, string> = {
  idle: 'Ready',
  fetching: 'Pulling observations from xMart…',
  versions: 'Pulling version history…',
  evaluating: 'Evaluating rules…',
  done: 'Complete',
  error: 'Failed',
}

/** The rules that apply to a workbook's selection — UC052's "applicable rules". */
export function rulesForSelection(
  rules: readonly QcRule[],
  codes: readonly string[],
): QcRule[] {
  const inView = new Set(codes)
  return rules.filter((rule) => {
    if (!rule.isEnabled) return false
    const named = [...rule.variables, ...rule.leftCodes, ...rule.rightCodes]
    // A rule that names nothing on screen would run correctly and report
    // findings on cells the user cannot see, which reads as a broken run.
    return named.some((code) => inView.has(code))
  })
}

export type { QcFinding }
