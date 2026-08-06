/**
 * Reports module state.
 *
 * Four things survive a reload, and each is a use case rather than a
 * convenience: report definitions people created or edited (UC036/UC037), the
 * favourites flag (UC040), the order the list was dragged into (UC040 again —
 * *"the user logs off and on again to see the list ... in the order as per the
 * action above"*, which makes persistence the acceptance criterion), and
 * nothing else.
 *
 * **The background job queue is session state and the generated files are held
 * in memory.** A completed multi-country run is five real `.xlsx` blobs; a few
 * of those would fill the same `localStorage` quota the workbook's unsaved
 * edits depend on. `qcStore` makes the same trade for findings and for the same
 * reason. The consequence is stated in the UI rather than hidden: a
 * notification whose files have gone offers to run the report again.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEMO_NOW } from '@/domain/constants'
import { SEEDED_REPORTS, SEEDED_REPORT_BY_ID } from '@/data/seed/reports'
import type { ReportDefinition } from '@/domain/report'

/* ==========================================================================
   JOBS (UC042)
   ========================================================================== */

export type ReportJobStatus = 'queued' | 'running' | 'complete' | 'failed'

export interface ReportJobFile {
  /** Filename as downloaded, e.g. `health-expenditure-CAN.xlsx`. */
  name: string
  /** The country this file covers, or null for a single combined file. */
  iso3: string | null
  rows: number
  columns: number
  bytes: number
}

export interface ReportJob {
  id: string
  reportId: string
  reportName: string
  requestedBy: string
  requestedUtc: string
  completedUtc: string | null
  status: ReportJobStatus
  /** 0–1. Real: it tracks countries finished, not a timer. */
  progress: number
  /** What the job is doing right now, in words a user can read. */
  step: string
  countries: string[]
  files: ReportJobFile[]
  error: string | null
  /** Why this run went to the background — shown so the routing is not magic. */
  reason: string
}

/* ==========================================================================
   THE STORE
   ========================================================================== */

interface ReportState {
  /** Edited delivered reports, keyed by id, plus every report anyone created. */
  definitionEdits: Record<string, ReportDefinition>
  /** Ids of user-created reports that were deleted. Delivered ones never are. */
  removedIds: string[]
  /** UC040 — per-user favourites. Keyed by email so the role switcher is honest. */
  favouritesByUser: Record<string, string[]>
  /** UC040 — the dragged order, ids first-to-last. Ids not listed sort after. */
  orderByUser: Record<string, string[]>
  /** Session-only; see the file comment. */
  jobs: ReportJob[]

  saveReport: (report: ReportDefinition) => void
  removeReport: (id: string) => void
  /** Restore a delivered report to the definition DMS shipped with. */
  resetReport: (id: string) => void
  toggleFavourite: (userEmail: string, id: string) => void
  setOrder: (userEmail: string, ids: string[]) => void

  enqueueJob: (job: ReportJob) => void
  updateJob: (id: string, patch: Partial<ReportJob>) => void
  clearJobs: () => void
}

const MAX_JOBS = 20

export const useReportStore = create<ReportState>()(
  persist(
    (set) => ({
      definitionEdits: {},
      removedIds: [],
      favouritesByUser: {},
      orderByUser: {},
      jobs: [],

      saveReport: (report) =>
        set((s) => ({
          definitionEdits: {
            ...s.definitionEdits,
            [report.id]: { ...report, updatedUtc: new Date(DEMO_NOW.getTime()).toISOString() },
          },
          removedIds: s.removedIds.filter((id) => id !== report.id),
        })),

      removeReport: (id) =>
        set((s) => {
          const rest = { ...s.definitionEdits }
          delete rest[id]
          return {
            definitionEdits: rest,
            // A delivered report is disabled by nobody and deleted by nobody:
            // a saved favourite, a scheduled run or a job in the history can
            // name it. Same rule as the delivered QC rules, and UC012's for
            // users.
            removedIds: SEEDED_REPORT_BY_ID.has(id)
              ? s.removedIds
              : [...new Set([...s.removedIds, id])],
          }
        }),

      resetReport: (id) =>
        set((s) => {
          const rest = { ...s.definitionEdits }
          delete rest[id]
          return { definitionEdits: rest }
        }),

      toggleFavourite: (userEmail, id) =>
        set((s) => {
          const current = s.favouritesByUser[userEmail] ?? []
          const next = current.includes(id)
            ? current.filter((x) => x !== id)
            : [...current, id]
          return { favouritesByUser: { ...s.favouritesByUser, [userEmail]: next } }
        }),

      setOrder: (userEmail, ids) =>
        set((s) => ({ orderByUser: { ...s.orderByUser, [userEmail]: ids } })),

      enqueueJob: (job) => set((s) => ({ jobs: [job, ...s.jobs].slice(0, MAX_JOBS) })),

      updateJob: (id, patch) =>
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) })),

      clearJobs: () => set({ jobs: [] }),
    }),
    {
      name: 'dms-reports',
      version: 1,
      // `jobs` is deliberately absent: the files they point at live in memory,
      // and a persisted job whose payload is gone is worse than no job at all.
      partialize: (s) => ({
        definitionEdits: s.definitionEdits,
        removedIds: s.removedIds,
        favouritesByUser: s.favouritesByUser,
        orderByUser: s.orderByUser,
      }),
    },
  ),
)

/* ==========================================================================
   GENERATED FILES — in memory, keyed by job
   ========================================================================== */

/**
 * The produced `.xlsx` blobs, keyed `${jobId}|${filename}`.
 *
 * A plain module-level map rather than store state, for exactly the reason
 * `qcStore`'s findings map is one: putting megabytes of binary into a persisted
 * Zustand store would either blow the quota or force a `partialize` that
 * silently drops it, and a store field that silently does not persist is worse
 * than one that was never there.
 */
const filesByJob = new Map<string, Blob>()

export function rememberJobFile(jobId: string, filename: string, blob: Blob): void {
  filesByJob.set(`${jobId}|${filename}`, blob)
}

export function recallJobFile(jobId: string, filename: string): Blob | undefined {
  return filesByJob.get(`${jobId}|${filename}`)
}

export function hasJobFiles(jobId: string): boolean {
  for (const key of filesByJob.keys()) {
    if (key.startsWith(`${jobId}|`)) return true
  }
  return false
}

export function forgetJobFiles(jobId: string): void {
  for (const key of [...filesByJob.keys()]) {
    if (key.startsWith(`${jobId}|`)) filesByJob.delete(key)
  }
}

/* ==========================================================================
   SELECTORS
   ========================================================================== */

/**
 * The delivered set with edits applied, removals dropped, and created reports
 * appended.
 *
 * Pure and taking its state as arguments, like `allRules` and
 * `effectiveAttributes`: a component's `useMemo` gets honest dependencies and
 * the merge is testable without a store.
 */
export function allReports(
  definitionEdits: Record<string, ReportDefinition>,
  removedIds: readonly string[],
): ReportDefinition[] {
  const removed = new Set(removedIds)
  const out: ReportDefinition[] = []
  const seen = new Set<string>()

  for (const report of SEEDED_REPORTS) {
    if (removed.has(report.id)) continue
    seen.add(report.id)
    out.push(definitionEdits[report.id] ?? report)
  }
  for (const [id, report] of Object.entries(definitionEdits)) {
    if (seen.has(id) || removed.has(id)) continue
    out.push(report)
  }
  return out
}

/**
 * UC037 — *"Only the user that created a custom report can view or run it."*
 *
 * Read literally, and it differs from the equivalent QC rule on purpose. UC050
 * makes a regular user's private quality rules *"visible to admins"* so an
 * administrator can promote one to the shared set; UC037 grants no such
 * exception, and inventing one would give administrators sight of colleagues'
 * working drafts that the RFP never asked for. An administrator who wants a
 * custom report in everyone's list creates it as predefined.
 */
export function visibleReports(
  reports: readonly ReportDefinition[],
  userEmail: string | undefined,
): ReportDefinition[] {
  return reports.filter((r) => r.scope === 'predefined' || r.createdBy === userEmail)
}

/** True when a delivered report has been changed and can be reset. */
export function isReportModified(
  report: ReportDefinition,
  definitionEdits: Record<string, ReportDefinition>,
): boolean {
  return SEEDED_REPORT_BY_ID.has(report.id) && definitionEdits[report.id] != null
}

/**
 * Apply the user's dragged order (UC040).
 *
 * *"Reports appear in alphabetical order by default"*, and anything the user
 * has not dragged keeps that default — so a report added by a later release
 * appears in its alphabetical place rather than silently at the end of a list
 * somebody arranged two years ago.
 */
export function orderReports(
  reports: readonly ReportDefinition[],
  order: readonly string[],
): ReportDefinition[] {
  const rank = new Map(order.map((id, i) => [id, i]))
  return [...reports].sort((a, b) => {
    const ra = rank.get(a.id)
    const rb = rank.get(b.id)
    if (ra != null && rb != null) return ra - rb
    if (ra != null) return -1
    if (rb != null) return 1
    return a.name.localeCompare(b.name, 'en')
  })
}
