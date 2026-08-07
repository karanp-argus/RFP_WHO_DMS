/**
 * Per-source load status for the xMart integration page (UC045, UC056).
 *
 * Derived from the seeded hash like everything else, so the page reads the
 * same on every machine — a "last synced 3 hours ago" that moves with the wall
 * clock would make every screenshot different and, worse, would eventually
 * show a nightly API as three months stale during a demo.
 *
 * The ages are chosen so the table has something to say: the HAPT API is a
 * day behind (healthy for a nightly load), the OneDrive folder has been quiet
 * long enough to be flagged, and one source has failed — because a status
 * table where every row is green demonstrates nothing about the status table.
 */

import { DEMO_NOW } from '@/domain/constants'
import { SYNC_SOURCES, syncHealth, type SyncStatus } from '@/domain/integration'
import { int } from '../generators/seedRandom'

/** Hours since the last attempt, per source. Deliberate, not random. */
const HOURS_SINCE: Record<string, number> = {
  edamis: 6,
  onedrive: 41 * 24,
  hapt: 19,
  longformat: 9 * 24,
  macro: 26 * 24,
}

/** The one failing source, and why. A green table proves nothing. */
const FAILED_SOURCE = 'onedrive'

const FAILURE_NOTE =
  'Last poll returned a workbook whose header row did not match the HAQ template. The file is quarantined; the country has been asked to resend.'

export function buildSyncStatuses(): SyncStatus[] {
  return SYNC_SOURCES.map((source) => {
    const hours = HOURS_SINCE[source.id] ?? 24
    const lastSync = new Date(DEMO_NOW.getTime() - hours * 3_600_000)
    const ageDays = Math.floor(hours / 24)
    const failed = source.id === FAILED_SOURCE

    return {
      source,
      lastSyncUtc: lastSync.toISOString(),
      rowCount: int(`sync.rows|${source.id}`, 1_400, 96_000),
      health: syncHealth(source, ageDays, failed),
      ageDays,
      note: failed ? FAILURE_NOTE : source.detail,
    }
  })
}
