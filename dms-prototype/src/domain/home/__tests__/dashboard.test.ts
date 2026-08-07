/**
 * Phase 7 — dashboard metrics (UC003).
 *
 * The two things worth locking in: the reporting percentage's denominator (a
 * country outside the round has not failed to respond), and the completeness
 * grid's treatment of a null value — the one place in the app where a null
 * observation counts as "not reported", which is defensible only because the
 * question the grid answers is different from the one the corpus answers.
 */

import { describe, expect, it } from 'vitest'
import type { Observation, ImportBatch, ReportingContact } from '@/domain/types'
import {
  completenessBand,
  completenessGrid,
  dueSoon,
  mergeActivity,
  publicationSummary,
  reportingCycle,
  submissionSummary,
} from '@/domain/home'

const NOW = new Date('2026-08-01T09:00:00.000Z')

function contact(
  iso3: string,
  status: ReportingContact['status'],
  responseDueOn = '2026-09-01',
): ReportingContact {
  return {
    id: `rc-${iso3}`,
    iso3,
    requestSentOn: '2026-05-01',
    responseDueOn,
    respondedOn: null,
    status,
    channel: 'email',
    note: '',
    loggedBy: 'dmsuser@who.int',
  }
}

function observation(
  iso3: string,
  year: number,
  value: number | null,
  extra: Partial<Observation> = {},
): Observation {
  return {
    surveyFk: `${iso3}-${year}`,
    iso3,
    year,
    dims: { HF: 'HF.1' },
    value,
    metadata: {},
    publishingStatus: 'not-publish',
    sys: {
      Sys_RowId: 'r',
      Sys_Origin: 'seed',
      Sys_LoadBatchId: 1,
      Sys_CommitDateUtc: '2026-01-01T00:00:00.000Z',
      Sys_FirstLoadUser: 'x',
      Sys_ID: `${iso3}-${year}`,
      Sys_BatchId: 1,
      Sys_FirstBatchID: 1,
      Sys_IsDeleted: false,
    },
    ...extra,
  }
}

function batch(iso3: string, partial: Partial<ImportBatch> = {}): ImportBatch {
  return {
    batchId: 1,
    iso3,
    series: '2026 round',
    format: 'JHAQ',
    receivedUtc: '2026-06-01T00:00:00.000Z',
    rowCount: 100,
    yearsCovered: [2000, 2024],
    status: 'processed',
    origin: 'eDamis (sftp)',
    ...partial,
  }
}

describe('reporting cycle (UC003)', () => {
  it('counts each status', () => {
    const summary = reportingCycle([
      contact('A', 'received'),
      contact('B', 'received'),
      contact('C', 'awaiting'),
      contact('D', 'overdue'),
      contact('E', 'not-requested'),
    ])
    expect(summary.total).toBe(5)
    expect(summary.received).toBe(2)
    expect(summary.awaiting).toBe(1)
    expect(summary.overdue).toBe(1)
    expect(summary.notRequested).toBe(1)
  })

  it('excludes countries never asked from the percentage', () => {
    // 2 of 4 asked = 50%. Counting the not-requested country would give 40%
    // and make a selective round look like a failing one.
    const summary = reportingCycle([
      contact('A', 'received'),
      contact('B', 'received'),
      contact('C', 'awaiting'),
      contact('D', 'overdue'),
      contact('E', 'not-requested'),
    ])
    expect(summary.percentReceived).toBe(50)
  })

  it('does not divide by zero when nobody was asked', () => {
    expect(reportingCycle([contact('E', 'not-requested')]).percentReceived).toBe(0)
    expect(reportingCycle([]).percentReceived).toBe(0)
  })
})

describe('due soon', () => {
  it('returns outstanding countries inside the window, soonest first', () => {
    const rows = dueSoon(
      [
        contact('A', 'awaiting', '2026-08-20'),
        contact('B', 'overdue', '2026-07-10'),
        contact('C', 'awaiting', '2026-12-01'),
        contact('D', 'received', '2026-08-02'),
      ],
      NOW,
      30,
    )
    expect(rows.map((r) => r.contact.iso3)).toEqual(['B', 'A'])
    expect(rows[0]?.daysOffset).toBe(-22)
  })
})

describe('publication queue (UC024)', () => {
  it('separates ready-to-publish from the rest', () => {
    const summary = publicationSummary([
      observation('A', 2020, 1, { publishingStatus: 'ready-to-publish' }),
      observation('A', 2021, 2),
      observation('A', 2022, null),
    ])
    expect(summary.total).toBe(3)
    expect(summary.readyToPublish).toBe(1)
    expect(summary.notPublish).toBe(2)
    expect(summary.withValue).toBe(2)
  })

  it('counts a metadata-only observation as reported, not missing', () => {
    // FR §1 is explicit that this is a valid observation. Folding it into
    // "missing" would misreport the corpus.
    const summary = publicationSummary([
      observation('A', 2020, null, { metadata: { COMMENT: 'Not available' } }),
      observation('A', 2021, null),
    ])
    expect(summary.metadataOnly).toBe(1)
    expect(summary.withValue).toBe(0)
  })
})

describe('submissions', () => {
  it('totals batches and rows, and keeps the latest date', () => {
    const summary = submissionSummary([
      batch('A', { rowCount: 500, receivedUtc: '2026-05-01T00:00:00.000Z' }),
      batch('B', { rowCount: 300, receivedUtc: '2026-07-01T00:00:00.000Z', status: 'failed' }),
      batch('C', { rowCount: 200, format: 'HAPT', status: 'processed-with-warnings' }),
    ])
    expect(summary.batches).toBe(3)
    expect(summary.rows).toBe(1000)
    expect(summary.failed).toBe(1)
    expect(summary.withWarnings).toBe(1)
    expect(summary.lastReceivedUtc).toBe('2026-07-01T00:00:00.000Z')
  })

  it('groups by format, largest first', () => {
    const summary = submissionSummary([
      batch('A', { rowCount: 100, format: 'JHAQ' }),
      batch('B', { rowCount: 900, format: 'HAPT' }),
      batch('C', { rowCount: 50, format: 'JHAQ' }),
    ])
    expect(summary.byFormat.map((f) => f.format)).toEqual(['HAPT', 'JHAQ'])
    expect(summary.byFormat[1]).toEqual({ format: 'JHAQ', batches: 2, rows: 150 })
  })

  it('handles an empty set', () => {
    const summary = submissionSummary([])
    expect(summary.rows).toBe(0)
    expect(summary.lastReceivedUtc).toBeNull()
  })
})

describe('completeness grid', () => {
  const years = [2020, 2021]

  it('scores against the expected count, not against the rows returned', () => {
    // ARG has one value in 2020 out of 4 expected; nothing in 2021.
    const grid = completenessGrid(
      [observation('ARG', 2020, 10), observation('ARG', 2020, null)],
      ['ARG'],
      years,
      4,
    )
    const row = grid.rows[0]
    expect(row?.cells[0]?.reported).toBe(1)
    expect(row?.cells[0]?.ratio).toBe(0.25)
    expect(row?.cells[1]?.reported).toBe(0)
    expect(row?.ratio).toBe(1 / 8)
  })

  it('a country with no rows at all scores zero, not complete', () => {
    // The failure mode that made `expected` a parameter: derived from the rows,
    // an absent country is 0/0 and reads as fully reported.
    const grid = completenessGrid([], ['KEN'], years, 4)
    expect(grid.rows[0]?.ratio).toBe(0)
    expect(grid.rows[0]?.cells).toHaveLength(2)
  })

  it('caps a cell at the expected count', () => {
    const rows = [1, 2, 3, 4, 5, 6].map((i) => observation('CAN', 2020, i))
    const grid = completenessGrid(rows, ['CAN'], [2020], 4)
    expect(grid.rows[0]?.cells[0]?.ratio).toBe(1)
  })

  it('sorts the year axis', () => {
    const grid = completenessGrid([], ['CAN'], [2022, 2020, 2021], 1)
    expect(grid.years).toEqual([2020, 2021, 2022])
  })

  it('gives zero its own band', () => {
    expect(completenessBand(0)).toBe('none')
    expect(completenessBand(0.01)).toBe('low')
    expect(completenessBand(0.5)).toBe('partial')
    expect(completenessBand(0.8)).toBe('high')
    expect(completenessBand(1)).toBe('full')
  })
})

describe('activity feed', () => {
  it('merges sources newest-first and caps the list', () => {
    const item = (id: string, at: string) => ({
      id,
      at,
      title: id,
      detail: '',
      kind: 'edit' as const,
    })
    const merged = mergeActivity(
      [item('a', '2026-01-01T00:00:00Z'), item('c', '2026-03-01T00:00:00Z')],
      [item('b', '2026-02-01T00:00:00Z')],
    )
    expect(merged.map((m) => m.id)).toEqual(['c', 'b', 'a'])

    const many = Array.from({ length: 30 }, (_, i) =>
      item(`x${i}`, `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`),
    )
    expect(mergeActivity(many)).toHaveLength(12)
  })
})
