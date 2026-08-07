/**
 * Phase 7 against the seeded corpus.
 *
 * The domain tests prove the rules; these prove the rules meet real data. The
 * Annex 3 checks in particular are the ones worth having — a paging or
 * `modifiedSince` bug is invisible on a fixture with three rows and obvious on
 * a corpus of nine hundred thousand.
 */

import { describe, expect, it } from 'vitest'
import { DEMO_NOW } from '@/domain/constants'
import { completenessGrid, publicationSummary, reportingCycle } from '@/domain/home'
import { dueDateEvents, matchSubscriptions, subscriptionProblems } from '@/domain/notify'
import { SYNC_SOURCES, syncHealth } from '@/domain/integration'
import { applyUserChange, grantAccess, summariseDirectory } from '@/domain/users'
import { mockXMartClient } from '@/data/xmart/mockClient'
import { LONG_FORMAT_COLUMNS, toCsv, toLongFormat } from '@/data/xmart/longFormat'
import { SEEDED_SUBSCRIPTIONS } from '@/data/seed/subscriptions'
import { buildSyncStatuses } from '@/data/seed/syncStatus'
import {
  DASHBOARD_COUNTRIES,
  DASHBOARD_HF_LEAVES,
  DASHBOARD_YEARS,
} from '@/hooks/useDashboardData'

/* ==========================================================================
   Annex 3 — the retrieval API against real volumes
   ========================================================================== */

describe('Annex 3 retrieval', () => {
  it('filters on the business primary keys', async () => {
    const page = await mockXMartClient.getObservations({
      countries: ['CAN'],
      yearFrom: 2020,
      yearTo: 2022,
      pageSize: 5_000,
    })
    expect(page.rows.length).toBeGreaterThan(0)
    for (const row of page.rows) {
      expect(row.iso3).toBe('CAN')
      expect(row.year).toBeGreaterThanOrEqual(2020)
      expect(row.year).toBeLessThanOrEqual(2022)
      // SURVEY_FK is the country×year key the annex filters on.
      expect(row.surveyFk).toBe(`CAN-${row.year}`)
    }
  })

  it('pages, and the pages partition the result exactly', async () => {
    const query = { countries: ['CAN'], yearFrom: 2020, yearTo: 2020 }
    const all = await mockXMartClient.getObservations({ ...query, pageSize: 100_000 })
    expect(all.hasMore).toBe(false)

    const size = 40
    const collected: string[] = []
    let page = 1
    for (;;) {
      const p = await mockXMartClient.getObservations({ ...query, page, pageSize: size })
      expect(p.totalCount).toBe(all.totalCount)
      collected.push(...p.rows.map((r) => r.sys.Sys_ID))
      if (!p.hasMore) break
      page++
      // A paging bug that never sets hasMore false would otherwise hang here.
      expect(page).toBeLessThan(500)
    }
    expect(collected).toHaveLength(all.totalCount)
    // No row appears twice and none is skipped.
    expect(new Set(collected).size).toBe(all.totalCount)
  })

  // 60s, not the 5s default: this call derives every observation in the corpus
  // — 194 countries × 25 years × ~250 reported codes — because that is exactly
  // what the requirement is about. Scoping it to make it quick would test
  // something else.
  it(
    'returns everything when nothing is filtered',
    async () => {
      const page = await mockXMartClient.getObservations({ pageSize: 250 })
      expect(page.totalCount).toBeGreaterThan(500_000)
      expect(page.rows).toHaveLength(250)
      expect(page.hasMore).toBe(true)
      expect(new Set(page.rows.map((r) => r.iso3)).size).toBeGreaterThan(0)
    },
    60_000,
  )

  it('honours modifiedSince, and a future cutoff returns nothing', async () => {
    const query = { countries: ['CAN'], yearFrom: 2020, yearTo: 2021 }
    const all = await mockXMartClient.getObservations({ ...query, pageSize: 100_000 })
    expect(all.totalCount).toBeGreaterThan(0)

    const future = await mockXMartClient.getObservations({
      ...query,
      pageSize: 100_000,
      modifiedSince: '2099-01-01T00:00:00.000Z',
    })
    expect(future.totalCount).toBe(0)

    const past = await mockXMartClient.getObservations({
      ...query,
      pageSize: 100_000,
      modifiedSince: '1999-01-01T00:00:00.000Z',
    })
    expect(past.totalCount).toBe(all.totalCount)
  })

  it('reports the page maximum commit date, which is the next incremental cursor', async () => {
    const page = await mockXMartClient.getObservations({
      countries: ['ARG'],
      yearFrom: 2020,
      yearTo: 2020,
      pageSize: 100,
    })
    expect(page.maxCommitDateUtc).not.toBeNull()
    for (const row of page.rows) {
      expect(row.sys.Sys_CommitDateUtc <= (page.maxCommitDateUtc ?? '')).toBe(true)
    }
  })

  it('excludes soft-deleted rows unless asked, and never fewer when asked', async () => {
    const query = { countries: ['KEN'], yearFrom: 2015, yearTo: 2024, pageSize: 100_000 }
    const without = await mockXMartClient.getObservations(query)
    const with_ = await mockXMartClient.getObservations({ ...query, includeDeleted: true })
    expect(with_.totalCount).toBeGreaterThanOrEqual(without.totalCount)
    expect(without.rows.every((r) => !r.sys.Sys_IsDeleted)).toBe(true)
  })

  it('the CSV carries Sys_ID and Sys_CommitDateUtc, in the xMart column order', async () => {
    const page = await mockXMartClient.getObservations({
      countries: ['FRA'],
      yearFrom: 2021,
      yearTo: 2021,
      pageSize: 20,
    })
    const csv = toCsv(page.rows.map(toLongFormat))
    const lines = csv.split('\r\n')
    const header = lines[0]?.split(',') ?? []

    expect(header).toEqual([...LONG_FORMAT_COLUMNS])
    expect(header).toContain('Sys_ID')
    expect(header).toContain('Sys_CommitDateUtc')
    // Header + one line per row, and the annex's CRLF.
    expect(lines).toHaveLength(page.rows.length + 1)
    expect(csv).toContain('\r\n')

    const first = lines[1]?.split(',') ?? []
    expect(first[header.indexOf('SURVEY_FK')]).toBe('FRA-2021')
    expect(first[header.indexOf('Sys_ID')]).not.toBe('')
  })
})

/* ==========================================================================
   UC044 — dataset-level restore
   ========================================================================== */

describe('dataset as-of (UC044)', () => {
  it('finds observations whose value differed on a past date', async () => {
    const result = await mockXMartClient.getDatasetAsOf(
      { countries: ['CAN'], yearFrom: 2015, yearTo: 2024 },
      '2026-01-01T00:00:00.000Z',
    )
    expect(result.scanned).toBeGreaterThan(0)
    // Roughly a fifth of observations carry history (versions.ts), so a slice
    // this size must find some — a zero here means the scan is not reaching
    // the version generator at all.
    expect(result.withHistory).toBeGreaterThan(0)
    expect(result.changes.length).toBeGreaterThan(0)
    expect(result.changes.length).toBeLessThanOrEqual(result.withHistory)
  })

  it('never proposes restoring a value to itself', async () => {
    const result = await mockXMartClient.getDatasetAsOf(
      { countries: ['ARG'], yearFrom: 2018, yearTo: 2024 },
      '2026-01-01T00:00:00.000Z',
    )
    for (const change of result.changes) {
      expect(change.asOfValue).not.toBe(change.currentValue)
      // The version it picked must actually predate the as-of instant.
      expect(Date.parse(change.asOfCommitDateUtc)).toBeLessThanOrEqual(
        Date.parse('2026-01-01T00:00:00.000Z'),
      )
    }
  })

  it('finds nothing before any history exists', async () => {
    // Versions start 40 days before DEMO_NOW at the newest and walk back a few
    // years at the oldest, so a date in 1990 predates all of them.
    const result = await mockXMartClient.getDatasetAsOf(
      { countries: ['CAN'], yearFrom: 2020, yearTo: 2021 },
      '1990-01-01T00:00:00.000Z',
    )
    expect(result.changes).toHaveLength(0)
  })

  it('is deterministic — the same request twice gives the same answer', async () => {
    const query = { countries: ['KEN'], yearFrom: 2019, yearTo: 2022 }
    const a = await mockXMartClient.getDatasetAsOf(query, '2026-01-01T00:00:00.000Z')
    const b = await mockXMartClient.getDatasetAsOf(query, '2026-01-01T00:00:00.000Z')
    expect(a.changes.map((c) => c.observationKey)).toEqual(b.changes.map((c) => c.observationKey))
    expect(a.changes.map((c) => c.asOfValue)).toEqual(b.changes.map((c) => c.asOfValue))
  })
})

/* ==========================================================================
   Sync status
   ========================================================================== */

describe('sync status', () => {
  it('covers every declared source', async () => {
    const statuses = await mockXMartClient.getSyncStatus()
    expect(statuses.map((s) => s.source.id).sort()).toEqual(
      SYNC_SOURCES.map((s) => s.id).sort(),
    )
  })

  it('has at least one healthy and one unhealthy row — a green table proves nothing', () => {
    const statuses = buildSyncStatuses()
    expect(statuses.some((s) => s.health === 'ok')).toBe(true)
    expect(statuses.some((s) => s.health !== 'ok')).toBe(true)
  })

  it('agrees with the domain rule it was built from', () => {
    for (const status of buildSyncStatuses()) {
      const expected = syncHealth(status.source, status.ageDays, status.health === 'failed')
      expect(status.health).toBe(expected)
    }
  })

  it('every timestamp is derived from DEMO_NOW, never the wall clock', () => {
    for (const status of buildSyncStatuses()) {
      expect(Date.parse(status.lastSyncUtc)).toBeLessThanOrEqual(DEMO_NOW.getTime())
    }
  })
})

/* ==========================================================================
   Users, against the seeded directory
   ========================================================================== */

describe('the seeded directory', () => {
  it('has more than one administrator, so the UC010 guard is demonstrable', async () => {
    const directory = await mockXMartClient.getUsers()
    const summary = summariseDirectory(directory)
    expect(summary.administrators).toBeGreaterThan(1)
    // And a disabled account to re-enable (UC011), and guests (UC007).
    expect(summary.disabled).toBeGreaterThan(0)
    expect(summary.guests).toBeGreaterThan(0)
    expect(summary.countryRestricted).toBeGreaterThan(0)
  })

  it('refuses to empty the administrator role once the others are disabled', async () => {
    const directory = await mockXMartClient.getUsers()
    const admins = directory.filter((u) => u.isEnabled && u.role === 'administrator')
    expect(admins.length).toBeGreaterThan(1)

    // Disable every administrator but the first, then try the first.
    let working = [...directory]
    for (const admin of admins.slice(1)) {
      const out = applyUserChange(working, admin.id, { kind: 'disable' })
      expect(out.ok).toBe(true)
      if (out.ok) working = working.map((u) => (u.id === admin.id ? out.user : u))
    }
    const last = admins[0]
    expect(last).toBeDefined()
    if (!last) return
    expect(applyUserChange(working, last.id, { kind: 'disable' }).ok).toBe(false)
    expect(applyUserChange(working, last.id, { kind: 'role', role: 'regular' }).ok).toBe(false)
  })

  it('refuses to re-grant an address already in the directory', async () => {
    const directory = await mockXMartClient.getUsers()
    const existing = directory[0]
    expect(existing).toBeDefined()
    if (!existing) return
    const out = grantAccess(
      { email: existing.email.toUpperCase(), displayName: 'X', jobTitle: '', role: 'regular' },
      directory,
      DEMO_NOW.toISOString(),
    )
    expect(out.ok).toBe(false)
  })
})

/* ==========================================================================
   Notifications, against the seeded follow-up log
   ========================================================================== */

describe('the UC023 sender over the real follow-up log', () => {
  it('the seeded round produces both overdue and upcoming events', async () => {
    const contacts = await mockXMartClient.getReportingContacts()
    const events = dueDateEvents(contacts, DEMO_NOW)
    expect(events.length).toBeGreaterThan(0)
    expect(events.some((e) => e.event === 'reporting-overdue')).toBe(true)
    expect(events.some((e) => e.event === 'reporting-due-soon')).toBe(true)
  })

  it('the delivered subscriptions actually match those events', async () => {
    const contacts = await mockXMartClient.getReportingContacts()
    const events = dueDateEvents(contacts, DEMO_NOW)
    // The point of the delivered set is that the bell has something in it on
    // arrival. A set that matches nothing would look like a broken sender.
    const matched = events.filter((e) => matchSubscriptions(SEEDED_SUBSCRIPTIONS, e).length > 0)
    expect(matched.length).toBeGreaterThan(0)
  })

  it('every delivered subscription is valid on its own terms', () => {
    for (const sub of SEEDED_SUBSCRIPTIONS) {
      expect(subscriptionProblems(sub)).toEqual([])
    }
    expect(new Set(SEEDED_SUBSCRIPTIONS.map((s) => s.id)).size).toBe(SEEDED_SUBSCRIPTIONS.length)
  })
})

/* ==========================================================================
   Dashboard, against the corpus it will actually read
   ========================================================================== */

describe('the dashboard slice', () => {
  it('the reporting cycle covers every seeded country exactly once', async () => {
    const contacts = await mockXMartClient.getReportingContacts()
    const cycle = reportingCycle(contacts)
    expect(cycle.total).toBe(contacts.length)
    expect(cycle.received + cycle.awaiting + cycle.overdue + cycle.notRequested).toBe(cycle.total)
    // The seed skews to a realistic round: most responded, a minority waiting.
    expect(cycle.percentReceived).toBeGreaterThan(50)
    expect(cycle.percentReceived).toBeLessThanOrEqual(100)
  })

  it('the completeness grid is neither empty nor uniformly full', async () => {
    const page = await mockXMartClient.getObservations({
      countries: DASHBOARD_COUNTRIES,
      yearFrom: DASHBOARD_YEARS[0],
      yearTo: DASHBOARD_YEARS[DASHBOARD_YEARS.length - 1],
      variables: DASHBOARD_HF_LEAVES,
      pageSize: 100_000,
    })
    const grid = completenessGrid(
      page.rows,
      DASHBOARD_COUNTRIES,
      DASHBOARD_YEARS,
      DASHBOARD_HF_LEAVES.length,
    )
    expect(grid.rows).toHaveLength(DASHBOARD_COUNTRIES.length)
    expect(grid.years).toHaveLength(DASHBOARD_YEARS.length)

    const ratios = grid.rows.map((r) => r.ratio)
    expect(Math.max(...ratios)).toBeGreaterThan(0)
    // A grid where every country scores identically would be a grid that
    // measures nothing — the seeded corpus varies by income and region.
    expect(new Set(ratios.map((r) => Math.round(r * 20))).size).toBeGreaterThan(1)
  })

  it('the publication summary never counts a metadata-only observation as a value', async () => {
    const page = await mockXMartClient.getObservations({
      countries: DASHBOARD_COUNTRIES,
      yearFrom: 2020,
      yearTo: 2022,
      variables: DASHBOARD_HF_LEAVES,
      pageSize: 100_000,
    })
    const summary = publicationSummary(page.rows)
    expect(summary.total).toBe(page.rows.length)
    expect(summary.readyToPublish + summary.notPublish).toBe(summary.total)
    expect(summary.withValue + summary.metadataOnly).toBeLessThanOrEqual(summary.total)
    // UC024 is a two-state workflow and the seed sets it ~62% of the time, so
    // both states must be present or the dashboard tile would read as broken.
    expect(summary.readyToPublish).toBeGreaterThan(0)
    expect(summary.notPublish).toBeGreaterThan(0)
  })
})
