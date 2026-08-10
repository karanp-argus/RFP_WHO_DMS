/**
 * Running a report.
 *
 * The hook owns the awkward part — working out what to fetch, and whether the
 * run belongs in the foreground or the background — and hands the rest to the
 * pure pivot engine. Four things worth stating:
 *
 *  · **It fetches only the codes the report names**, aggregates and indicators
 *    expanded to the leaves they are computed from (`reportFetchCodes`). A
 *    blanket pull for a fifty-country report is several hundred thousand
 *    observations to answer a question about nineteen codes.
 *  · **Values resolve through the Phase 3 formula engine.** A pivot over
 *    `CHE%GDP_SHA2011` gets the engine's answer, guard and country override
 *    included — nothing here re-derives an indicator.
 *  · **The background queue is real work, not a timer** (UC042). A per-country
 *    job pivots and writes one country at a time, yielding to the event loop
 *    between them, so the progress bar tracks files actually built and the rest
 *    of DMS stays usable while it runs — which is the whole point of the use
 *    case.
 *  · **It stamps runs from `DEMO_NOW`**, not the wall clock, the same rule the
 *    whole seeded corpus follows.
 */

import { useCallback, useState } from 'react'
import { DEMO_NOW, FIRST_YEAR, LAST_YEAR } from '@/domain/constants'
import {
  buildPivot,
  shouldRunInBackground,
  yearRange,
  type PivotTable,
  type ReportDefinition,
  type ReportRunParameters,
} from '@/domain/report'
import { mockXMartClient } from '@/data/xmart/mockClient'
import { buildReportAccess, reportFetchCodes } from '@/data/report/reportAccess'
import { loadReportVocabulary } from '@/data/seed/translations'
import {
  rememberJobFile,
  useReportStore,
  type ReportJob,
  type ReportJobFile,
} from '@/stores/reportStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { useAuthStore } from '@/stores/authStore'
import { buildReportFile } from '@/modules/reports/exportReport'
import { useCountries, useCurrencies, useFormulas, useVariables } from './useSetupData'

/* --------------------------------------------------------------------------
   Stamps
   -------------------------------------------------------------------------- */

let jobCounter = 0

function nextJobStamp(): { id: string; utc: string } {
  const n = jobCounter++
  return {
    id: `job-${String(n + 1).padStart(3, '0')}`,
    utc: new Date(DEMO_NOW.getTime() + n * 120_000).toISOString(),
  }
}

/**
 * Hand the event loop back between countries.
 *
 * Without this the whole queue runs inside one task and the progress bar jumps
 * from 0 to 100 with the page frozen in between — which would demonstrate the
 * opposite of what UC042 asks for.
 */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

/* --------------------------------------------------------------------------
   Types
   -------------------------------------------------------------------------- */

export type ReportRunPhase = 'idle' | 'fetching' | 'pivoting' | 'done' | 'error'

export interface ForegroundRun {
  table: PivotTable
  definition: ReportDefinition
  parameters: ReportRunParameters
  runUtc: string
}

export interface UseReportRunResult {
  phase: ReportRunPhase
  result: ForegroundRun | null
  error: string | null
  isRunning: boolean
  /** Run now and return the table. Use for on-screen display and the preview. */
  run: (
    definition: ReportDefinition,
    parameters: ReportRunParameters,
  ) => Promise<ForegroundRun | null>
  /** UC042 — enqueue, build files, notify. Returns the job id immediately. */
  runInBackground: (
    definition: ReportDefinition,
    parameters: ReportRunParameters,
    reason: string,
  ) => string | null
  reset: () => void
  /** Whether this run would be routed to the background. */
  route: (
    definition: ReportDefinition,
    parameters: ReportRunParameters,
  ) => { background: boolean; reason: string }
}

export const REPORT_RUN_PHASE_LABELS: Record<ReportRunPhase, string> = {
  idle: 'Ready',
  fetching: 'Pulling observations from xMart…',
  pivoting: 'Building the pivot…',
  done: 'Complete',
  error: 'Failed',
}

/* --------------------------------------------------------------------------
   The hook
   -------------------------------------------------------------------------- */

export function useReportRun(): UseReportRunResult {
  const { data: variables } = useVariables()
  const { data: countries } = useCountries()
  const { data: currencies } = useCurrencies()
  const { data: formulas } = useFormulas()

  const user = useAuthStore((s) => s.user)
  const enqueueJob = useReportStore((s) => s.enqueueJob)
  const updateJob = useReportStore((s) => s.updateJob)
  const pushNotification = useNotificationStore((s) => s.push)

  const [phase, setPhase] = useState<ReportRunPhase>('idle')
  const [result, setResult] = useState<ForegroundRun | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ready = Boolean(variables && countries && currencies && formulas)

  /**
   * One fetch plus one access closure, shared by the foreground path and every
   * country of a background job.
   *
   * The whole year span is pulled regardless of the requested window, for the
   * same reason the workbook does it: `PREV`, `GROWTH` and the interpolation
   * functions read across years, and a report narrowed to 2020–2024 has not
   * asked for its growth indicators to go blank.
   *
   * **The UC041 language pack is fetched here too**, alongside the observations
   * rather than after them: it is a dynamic `import()` of a lazy chunk, so
   * requesting it while the corpus is in flight costs nothing, and the pivot
   * cannot start without it — every row label the run produces is resolved
   * through it.
   */
  const prepare = useCallback(
    async (parameters: ReportRunParameters, codes: readonly string[]) => {
      if (!variables || !countries || !currencies || !formulas) {
        throw new Error('Configuration is still loading from xMart.')
      }
      const fetchCodes = reportFetchCodes(codes, variables, formulas)
      const vocabularyPromise = loadReportVocabulary(parameters.language)
      const page = await mockXMartClient.getObservations({
        countries: parameters.countries,
        yearFrom: FIRST_YEAR,
        yearTo: LAST_YEAR,
        variables: fetchCodes,
        includeDeleted: false,
        pageSize: 5_000_000,
      })

      const reported = new Map<string, number | null>()
      for (const o of page.rows) {
        const dims = Object.values(o.dims).filter((v): v is string => v != null && v !== '')
        // Crosses are multi-dimension tuples and are never a pivot's measure.
        const code = dims.length === 1 ? dims[0] : undefined
        if (code) reported.set(`${o.iso3}|${o.year}|${code}`, o.value)
      }

      const vocabulary = await vocabularyPromise
      return {
        ...buildReportAccess({
          reported,
          variables,
          countries,
          currencies,
          formulas,
          vocabulary,
        }),
        vocabulary,
      }
    },
    [variables, countries, currencies, formulas],
  )

  /** Codes a run reads: the parameters', falling back to the definition's. */
  const codesFor = useCallback(
    (definition: ReportDefinition, parameters: ReportRunParameters): string[] => {
      const chosen = parameters.variables.length > 0 ? parameters.variables : definition.variables
      return chosen.length > 0 ? chosen : []
    },
    [],
  )

  const run = useCallback(
    async (
      definition: ReportDefinition,
      parameters: ReportRunParameters,
    ): Promise<ForegroundRun | null> => {
      if (!ready) {
        setError('Configuration is still loading from xMart.')
        setPhase('error')
        return null
      }
      if (parameters.countries.length === 0) {
        setError('Choose at least one country before running.')
        setPhase('error')
        return null
      }
      const codes = codesFor(definition, parameters)
      if (codes.length === 0) {
        setError('Choose at least one variable before running.')
        setPhase('error')
        return null
      }

      setError(null)
      setPhase('fetching')

      try {
        const { access, vocabulary } = await prepare(parameters, codes)
        setPhase('pivoting')
        const table = buildPivot({
          definition,
          countries: parameters.countries,
          years: yearRange(parameters.yearFrom, parameters.yearTo),
          codes,
          presentation: parameters.presentation,
          data: access,
          vocabulary,
        })
        const outcome: ForegroundRun = {
          table,
          definition,
          parameters,
          runUtc: new Date(DEMO_NOW.getTime()).toISOString(),
        }
        setResult(outcome)
        setPhase('done')
        return outcome
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setPhase('error')
        return null
      }
    },
    [ready, codesFor, prepare],
  )

  /* ------------------------------------------------------------------------
     UC042 — the background queue
     ------------------------------------------------------------------------ */

  const executeJob = useCallback(
    async (
      job: ReportJob,
      definition: ReportDefinition,
      parameters: ReportRunParameters,
    ): Promise<void> => {
      const runUtc = new Date(DEMO_NOW.getTime()).toISOString()

      try {
        updateJob(job.id, { status: 'running', step: 'Pulling observations from xMart…' })
        const codes = codesFor(definition, parameters)
        if (codes.length === 0) throw new Error('The report names no variables to read.')

        const { access, vocabulary } = await prepare(parameters, codes)
        const countryNameOf = (iso3: string) => access.fieldLabel('country', iso3)

        // One file per country (UC036/UC042), or one combined file.
        const batches: { iso3: string | null; countries: string[] }[] =
          definition.oneFilePerCountry && parameters.countries.length > 1
            ? parameters.countries.map((iso3) => ({ iso3, countries: [iso3] }))
            : [{ iso3: null, countries: [...parameters.countries] }]

        const files: ReportJobFile[] = []
        const years = yearRange(parameters.yearFrom, parameters.yearTo)

        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i]
          if (!batch) continue

          updateJob(job.id, {
            progress: i / batches.length,
            step: batch.iso3
              ? `Building ${countryNameOf(batch.iso3)} (${i + 1} of ${batches.length})…`
              : 'Building the report…',
          })
          // Between countries, not inside one: the pivot for a single country
          // is milliseconds, and yielding per cell would make the job slower
          // than the work it is doing.
          await yieldToBrowser()

          const table = buildPivot({
            definition,
            countries: batch.countries,
            years,
            codes,
            presentation: parameters.presentation,
            data: access,
            vocabulary,
          })

          const file = buildReportFile({
            definition,
            parameters: { ...parameters, countries: batch.countries },
            table,
            ...(batch.iso3 ? { iso3: batch.iso3, countryName: countryNameOf(batch.iso3) } : {}),
            runBy: job.requestedBy,
            runUtc,
          })

          rememberJobFile(job.id, file.name, file.blob)
          files.push({
            name: file.name,
            iso3: batch.iso3,
            rows: table.rows.length,
            columns: table.columns.length,
            bytes: file.blob.size,
          })
          updateJob(job.id, { files: [...files], progress: (i + 1) / batches.length })
        }

        updateJob(job.id, {
          status: 'complete',
          progress: 1,
          step: `${files.length} file${files.length === 1 ? '' : 's'} ready`,
          completedUtc: new Date(DEMO_NOW.getTime()).toISOString(),
          files,
        })

        // UC042: "Success notification if the report was created successfully,
        // with a link to download the file."
        pushNotification({
          kind: 'success',
          title: `${definition.name} is ready`,
          body: `${files.length} Excel file${files.length === 1 ? '' : 's'} for ${job.countries.length} countr${job.countries.length === 1 ? 'y' : 'ies'}, ${parameters.yearFrom}–${parameters.yearTo}.`,
          action: {
            kind: 'download-report-job',
            jobId: job.id,
            label: files.length === 1 ? 'Download' : `Download all ${files.length} files`,
          },
          href: '/reports?tab=jobs',
        })
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        updateJob(job.id, {
          status: 'failed',
          step: 'Failed',
          error: message,
          completedUtc: new Date(DEMO_NOW.getTime()).toISOString(),
        })
        // UC042: "Error notification if the report was not created successfully."
        pushNotification({
          kind: 'error',
          title: `${definition.name} could not be generated`,
          body: message,
          href: '/reports?tab=jobs',
        })
      }
    },
    [updateJob, pushNotification, prepare, codesFor],
  )

  const runInBackground = useCallback(
    (
      definition: ReportDefinition,
      parameters: ReportRunParameters,
      reason: string,
    ): string | null => {
      if (!ready) return null

      const stamp = nextJobStamp()
      const job: ReportJob = {
        id: stamp.id,
        reportId: definition.id,
        reportName: definition.name,
        requestedBy: user?.displayName ?? 'Unknown user',
        requestedUtc: stamp.utc,
        completedUtc: null,
        status: 'queued',
        progress: 0,
        step: 'Queued',
        countries: [...parameters.countries],
        files: [],
        error: null,
        reason,
      }
      enqueueJob(job)

      // Deliberately not awaited: the caller returns to the page immediately,
      // which is what "so that the user can continue working with DMS" means.
      void executeJob(job, definition, parameters)
      return job.id
    },
    [ready, enqueueJob, executeJob, user?.displayName],
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
    isRunning: phase === 'fetching' || phase === 'pivoting',
    run,
    runInBackground,
    reset,
    route: shouldRunInBackground,
  }
}
