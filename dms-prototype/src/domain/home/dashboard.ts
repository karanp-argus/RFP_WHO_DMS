/**
 * Dashboard metrics (UC003, UC003.1).
 *
 * The FR is explicit that the dashboard's contents *"will be defined during the
 * initiation phase of the project"*, so what is chosen here has to justify
 * itself. Each metric below answers a question the HA team demonstrably asks
 * during a reporting round — who has reported, what is waiting to be published,
 * what the quality checks are complaining about, who is late, and where the
 * series are thin. Nothing is here because it made a nice tile.
 *
 * Pure: every function takes its data as an argument. The page fetches through
 * `XMartClient` and hands the rows in, which is what makes the numbers
 * testable against the seeded corpus rather than only inspectable on screen.
 */

import type { PublishingStatus } from '@/domain/constants'
import type { ImportBatch, Observation, ReportingContact } from '@/domain/types'
import { daysUntil } from '@/domain/notify'

/* ==========================================================================
   Reporting cycle
   ========================================================================== */

export interface ReportingCycleSummary {
  total: number
  received: number
  awaiting: number
  overdue: number
  notRequested: number
  /** Of the countries actually asked — excludes `not-requested`. */
  percentReceived: number
}

export function reportingCycle(
  contacts: readonly ReportingContact[],
): ReportingCycleSummary {
  const count = (s: ReportingContact['status']) => contacts.filter((c) => c.status === s).length
  const received = count('received')
  const awaiting = count('awaiting')
  const overdue = count('overdue')
  const notRequested = count('not-requested')
  const requested = received + awaiting + overdue

  return {
    total: contacts.length,
    received,
    awaiting,
    overdue,
    notRequested,
    // Denominator is the countries asked, not all 194: a country outside the
    // round has not failed to respond, and including it would make the figure
    // read worse the more selective the round was.
    percentReceived: requested === 0 ? 0 : (received / requested) * 100,
  }
}

/** Countries whose response date falls within `days`, soonest first. */
export function dueSoon(
  contacts: readonly ReportingContact[],
  now: Date,
  days = 30,
): { contact: ReportingContact; daysOffset: number }[] {
  const out: { contact: ReportingContact; daysOffset: number }[] = []
  for (const contact of contacts) {
    if (contact.status !== 'awaiting' && contact.status !== 'overdue') continue
    const offset = daysUntil(contact.responseDueOn, now)
    if (offset == null || offset > days) continue
    out.push({ contact, daysOffset: offset })
  }
  return out.sort((a, b) => a.daysOffset - b.daysOffset)
}

/* ==========================================================================
   Publication queue (UC024)
   ========================================================================== */

export interface PublicationSummary {
  total: number
  readyToPublish: number
  notPublish: number
  withValue: number
  /** Observations carrying metadata but no value — valid, and easy to overlook. */
  metadataOnly: number
}

export function publicationSummary(rows: readonly Observation[]): PublicationSummary {
  let readyToPublish = 0
  let withValue = 0
  let metadataOnly = 0

  for (const row of rows) {
    if (row.publishingStatus === ('ready-to-publish' satisfies PublishingStatus)) readyToPublish++
    if (row.value != null) withValue++
    // FR §1: an observation with metadata and no value is valid. Counting it
    // as "missing" would misreport the corpus — it is reported, deliberately
    // without a figure.
    else if (Object.keys(row.metadata).length > 0) metadataOnly++
  }

  return {
    total: rows.length,
    readyToPublish,
    notPublish: rows.length - readyToPublish,
    withValue,
    metadataOnly,
  }
}

/* ==========================================================================
   Submissions
   ========================================================================== */

export interface SubmissionSummary {
  batches: number
  rows: number
  failed: number
  withWarnings: number
  /** Most recent `receivedUtc` across the batches, or null. */
  lastReceivedUtc: string | null
  byFormat: { format: string; batches: number; rows: number }[]
}

export function submissionSummary(batches: readonly ImportBatch[]): SubmissionSummary {
  const byFormat = new Map<string, { batches: number; rows: number }>()
  let rows = 0
  let failed = 0
  let withWarnings = 0
  let last: string | null = null

  for (const b of batches) {
    rows += b.rowCount
    if (b.status === 'failed') failed++
    if (b.status === 'processed-with-warnings') withWarnings++
    if (last == null || b.receivedUtc > last) last = b.receivedUtc

    const entry = byFormat.get(b.format) ?? { batches: 0, rows: 0 }
    entry.batches++
    entry.rows += b.rowCount
    byFormat.set(b.format, entry)
  }

  return {
    batches: batches.length,
    rows,
    failed,
    withWarnings,
    lastReceivedUtc: last,
    byFormat: [...byFormat.entries()]
      .map(([format, v]) => ({ format, ...v }))
      .sort((a, b) => b.rows - a.rows),
  }
}

/* ==========================================================================
   Completeness heatmap
   ========================================================================== */

export interface CompletenessCell {
  iso3: string
  year: number
  reported: number
  expected: number
  /** 0–1. `expected === 0` yields 0 rather than NaN. */
  ratio: number
}

export interface CompletenessGrid {
  years: number[]
  rows: { iso3: string; cells: CompletenessCell[]; ratio: number }[]
}

/**
 * Share of the expected variables that carry a value, per country-year.
 *
 * **A null value counts as not reported here, and that is the one place in the
 * app where it does.** Everywhere else a null observation with metadata is a
 * first-class record — the FR insists on it and the formula engine's null
 * guards depend on it. But the question this grid answers is "is there a
 * number in the series", and an observation that exists to say *no figure was
 * available* is an honest answer to a different question. The distinction is
 * why `expected` is passed in rather than derived from the rows: derived, a
 * country with no rows at all would score 0/0 = complete.
 */
export function completenessGrid(
  rows: readonly Observation[],
  countries: readonly string[],
  years: readonly number[],
  expectedPerCell: number,
): CompletenessGrid {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.value == null) continue
    const key = `${row.iso3}|${row.year}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const yearList = [...years].sort((a, b) => a - b)

  return {
    years: yearList,
    rows: countries.map((iso3) => {
      const cells = yearList.map<CompletenessCell>((year) => {
        const reported = Math.min(counts.get(`${iso3}|${year}`) ?? 0, expectedPerCell)
        return {
          iso3,
          year,
          reported,
          expected: expectedPerCell,
          ratio: expectedPerCell === 0 ? 0 : reported / expectedPerCell,
        }
      })
      const total = cells.reduce((sum, c) => sum + c.reported, 0)
      const expected = expectedPerCell * cells.length
      return { iso3, cells, ratio: expected === 0 ? 0 : total / expected }
    }),
  }
}

/**
 * Five bands for the heatmap.
 *
 * Bands rather than a continuous gradient: the grid is read at a glance to
 * find the thin patches, and a continuous scale makes 62% and 68% look
 * identical while hiding the cliff at zero. Zero has its own band for that
 * reason — "no data at all" is a different fact from "sparse".
 */
export type CompletenessBand = 'none' | 'low' | 'partial' | 'high' | 'full'

export function completenessBand(ratio: number): CompletenessBand {
  if (ratio <= 0) return 'none'
  if (ratio < 0.4) return 'low'
  if (ratio < 0.7) return 'partial'
  if (ratio < 0.95) return 'high'
  return 'full'
}

/* ==========================================================================
   Activity feed
   ========================================================================== */

export interface ActivityItem {
  id: string
  at: string
  title: string
  detail: string
  href?: string
  kind: 'submission' | 'edit' | 'run' | 'report' | 'contact'
}

/**
 * Recent activity, newest first.
 *
 * Assembled from things that actually happened rather than a seeded feed: the
 * import batches xMart processed, the runs and jobs held in this session's
 * stores, and the local edit overlay. A dashboard whose activity list is
 * generated is the tile an evaluator asks about first.
 */
export function mergeActivity(...groups: readonly ActivityItem[][]): ActivityItem[] {
  return groups
    .flat()
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12)
}
