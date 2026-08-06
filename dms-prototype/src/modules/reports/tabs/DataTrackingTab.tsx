/**
 * UC039 — the data tracking report.
 *
 * *"Based on the log of the status of the submission of countries data ...
 * select one or multiple countries and view the data submission status of those
 * countries ... based on xMart metadata of imports with details like the last
 * time data was received for that country, to which series it belongs to, or
 * the format in which it was received."*
 *
 * Two views of the same `LOAD_BATCH_LIST` pull, because the use case asks a
 * question with two halves. **By country** answers *"where do we stand"* — one
 * line per country with its most recent submission and how long ago it was.
 * **Every batch** answers *"what happened"* — the full log, which is what
 * someone chasing a failed load actually needs.
 *
 * The elapsed-time column is measured from `DEMO_NOW`, not the wall clock, so
 * "412 days ago" is the same number in every screenshot — the rule the whole
 * seeded corpus follows.
 */

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CalendarClock, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CountryPicker } from '@/components/common/CountryPicker'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState, LoadingState } from '@/components/common/EmptyState'
import { ModuleTabs } from '@/components/layout/ModuleTabs'
import { DEMO_NOW, SOURCE_FORMAT_LABELS } from '@/domain/constants'
import type { ImportBatch } from '@/domain/types'
import { COUNTRY_BY_ISO3 } from '@/data/seed/countries'
import { REPORT_DEMO_COUNTRIES } from '@/data/seed/reports'
import { useImportBatches } from '@/hooks/useSetupData'
import { downloadCsv, downloadXlsx } from '@/lib/exporters'
import { cn } from '@/lib/utils'

/* --------------------------------------------------------------------------
   Derived rows
   -------------------------------------------------------------------------- */

interface CountryStatus {
  iso3: string
  country: string
  lastReceivedUtc: string | null
  daysAgo: number | null
  series: string
  format: string
  rowCount: number
  yearsCovered: string
  batchId: number | null
  status: ImportBatch['status'] | 'none'
  origin: string
  submissions: number
}

function daysBetween(fromIso: string): number {
  return Math.round((DEMO_NOW.getTime() - new Date(fromIso).getTime()) / 86_400_000)
}

function statusesFor(
  selected: readonly string[],
  batches: readonly ImportBatch[],
): CountryStatus[] {
  const byCountry = new Map<string, ImportBatch[]>()
  for (const b of batches) {
    const list = byCountry.get(b.iso3)
    if (list) list.push(b)
    else byCountry.set(b.iso3, [b])
  }

  return selected.map((iso3) => {
    const country = COUNTRY_BY_ISO3.get(iso3)?.NAME_SHORT_EN ?? iso3
    // The client already sorts newest first, but the report should not depend
    // on that: a country whose batches arrived unsorted would silently show the
    // wrong "last received" date, which is the one number this report is for.
    const list = [...(byCountry.get(iso3) ?? [])].sort((a, b) =>
      b.receivedUtc.localeCompare(a.receivedUtc),
    )
    const latest = list[0]

    if (!latest) {
      return {
        iso3,
        country,
        lastReceivedUtc: null,
        daysAgo: null,
        series: '—',
        format: '—',
        rowCount: 0,
        yearsCovered: '—',
        batchId: null,
        status: 'none',
        origin: '—',
        submissions: 0,
      }
    }

    return {
      iso3,
      country,
      lastReceivedUtc: latest.receivedUtc,
      daysAgo: daysBetween(latest.receivedUtc),
      series: latest.series,
      format: latest.format,
      rowCount: latest.rowCount,
      yearsCovered: `${latest.yearsCovered[0]}–${latest.yearsCovered[1]}`,
      batchId: latest.batchId,
      status: latest.status,
      origin: latest.origin,
      submissions: list.length,
    }
  })
}

/* --------------------------------------------------------------------------
   Presentation
   -------------------------------------------------------------------------- */

/** Indexed by a plain string: a country with no submissions has no format. */
const FORMAT_LABELS: Record<string, string> = SOURCE_FORMAT_LABELS

const STATUS_LABELS: Record<CountryStatus['status'], string> = {
  processed: 'Processed',
  'processed-with-warnings': 'Processed with warnings',
  failed: 'Failed',
  none: 'Nothing received',
}

function StatusBadge({ status }: { status: CountryStatus['status'] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        status === 'processed' && 'border-who-pass/50 text-who-pass',
        status === 'processed-with-warnings' && 'border-who-warn/50 text-who-warn',
        status === 'failed' && 'border-who-fail/50 text-who-fail',
        status === 'none' && 'text-who-text-muted',
      )}
    >
      {STATUS_LABELS[status]}
    </Badge>
  )
}

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('en-GB') : '—'
}

/**
 * How overdue a submission looks.
 *
 * The HA reporting cycle is annual, so a country last heard from over a year
 * ago is behind and one over two years ago is a follow-up case. The bands are
 * stated here rather than buried in a colour so the report can be argued with.
 */
const STALE_DAYS = 365
const VERY_STALE_DAYS = 730

/* --------------------------------------------------------------------------
   The tab
   -------------------------------------------------------------------------- */

export function DataTrackingTab() {
  const [selected, setSelected] = useState<string[]>([...REPORT_DEMO_COUNTRIES])
  const [ran, setRan] = useState<string[]>([...REPORT_DEMO_COUNTRIES])
  const [view, setView] = useState('countries')

  const { data: batches, isLoading } = useImportBatches(ran)

  const statuses = useMemo(
    () => (batches ? statusesFor(ran, batches) : []),
    [batches, ran],
  )

  const countryColumns = useMemo<ColumnDef<CountryStatus, unknown>[]>(
    () => [
      { id: 'country', header: 'Country', accessorKey: 'country' },
      { id: 'iso3', header: 'ISO3', accessorKey: 'iso3' },
      {
        id: 'lastReceived',
        header: 'Last received',
        accessorFn: (r) => r.lastReceivedUtc ?? '',
        cell: (ctx) => formatDate(ctx.row.original.lastReceivedUtc),
      },
      {
        id: 'daysAgo',
        header: 'Days ago',
        accessorFn: (r) => r.daysAgo ?? Number.MAX_SAFE_INTEGER,
        cell: (ctx) => {
          const days = ctx.row.original.daysAgo
          if (days == null) return <span className="text-who-text-muted">—</span>
          return (
            <span
              className={cn(
                'tabular-nums',
                days >= VERY_STALE_DAYS
                  ? 'font-semibold text-who-fail'
                  : days >= STALE_DAYS
                    ? 'text-who-warn'
                    : 'text-who-text',
              )}
            >
              {days.toLocaleString('en-GB')}
            </span>
          )
        },
      },
      { id: 'series', header: 'Series', accessorKey: 'series' },
      {
        id: 'format',
        header: 'Format',
        accessorKey: 'format',
        cell: (ctx) => (
          <span title={FORMAT_LABELS[ctx.row.original.format] ?? ''}>
            {ctx.row.original.format}
          </span>
        ),
      },
      {
        id: 'rowCount',
        header: 'Rows',
        accessorKey: 'rowCount',
        cell: (ctx) => (
          <span className="tabular-nums">
            {ctx.row.original.rowCount.toLocaleString('en-GB')}
          </span>
        ),
      },
      { id: 'yearsCovered', header: 'Years covered', accessorKey: 'yearsCovered' },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: (ctx) => <StatusBadge status={ctx.row.original.status} />,
      },
      { id: 'origin', header: 'Received via', accessorKey: 'origin' },
      {
        id: 'submissions',
        header: 'Submissions',
        accessorKey: 'submissions',
        cell: (ctx) => (
          <span className="tabular-nums">{ctx.row.original.submissions}</span>
        ),
      },
      {
        id: 'batchId',
        header: 'Batch',
        accessorFn: (r) => r.batchId ?? '',
        cell: (ctx) => (
          <span className="font-mono text-[length:var(--text-meta)]">
            {ctx.row.original.batchId ?? '—'}
          </span>
        ),
      },
    ],
    [],
  )

  const batchColumns = useMemo<ColumnDef<ImportBatch, unknown>[]>(
    () => [
      {
        id: 'country',
        header: 'Country',
        accessorFn: (b) => COUNTRY_BY_ISO3.get(b.iso3)?.NAME_SHORT_EN ?? b.iso3,
      },
      {
        id: 'receivedUtc',
        header: 'Received',
        accessorKey: 'receivedUtc',
        cell: (ctx) => formatDate(ctx.row.original.receivedUtc),
      },
      { id: 'series', header: 'Series', accessorKey: 'series' },
      { id: 'format', header: 'Format', accessorKey: 'format' },
      {
        id: 'rowCount',
        header: 'Rows',
        accessorKey: 'rowCount',
        cell: (ctx) => (
          <span className="tabular-nums">
            {ctx.row.original.rowCount.toLocaleString('en-GB')}
          </span>
        ),
      },
      {
        id: 'yearsCovered',
        header: 'Years covered',
        accessorFn: (b) => `${b.yearsCovered[0]}–${b.yearsCovered[1]}`,
      },
      {
        id: 'status',
        header: 'Status',
        accessorKey: 'status',
        cell: (ctx) => <StatusBadge status={ctx.row.original.status} />,
      },
      { id: 'origin', header: 'Received via', accessorKey: 'origin' },
      {
        id: 'batchId',
        header: 'Batch',
        accessorKey: 'batchId',
        cell: (ctx) => (
          <span className="font-mono text-[length:var(--text-meta)]">
            {ctx.row.original.batchId}
          </span>
        ),
      },
    ],
    [],
  )

  const overdue = statuses.filter((s) => s.daysAgo == null || s.daysAgo >= STALE_DAYS).length
  const failed = statuses.filter((s) => s.status === 'failed').length

  return (
    <div className="space-y-4">
      {/* --- the parameter prompt ------------------------------------------ */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 px-4 py-3">
          <div className="min-w-[280px] flex-1">
            <p className="mb-1 text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
              Countries
            </p>
            <CountryPicker
              selected={selected}
              onChange={setSelected}
              placeholder="Choose countries…"
              ariaLabel="Countries in the data tracking report"
            />
          </div>
          <Button
            className="gap-1.5"
            disabled={selected.length === 0}
            onClick={() => setRan([...selected])}
          >
            <Play className="size-3.5" />
            Run report
          </Button>
        </CardContent>
      </Card>

      {ran.length === 0 ? (
        <EmptyState
          message="Choose one or more countries"
          hint="The data tracking report reads the xMart import log for the countries you select (UC039)."
        />
      ) : isLoading ? (
        <LoadingState label="Pulling the xMart import log…" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{ran.length} countries</Badge>
            <Badge variant="secondary">{batches?.length ?? 0} submissions</Badge>
            {overdue > 0 ? (
              <Badge variant="outline" className="border-who-warn/50 gap-1 text-who-warn">
                <CalendarClock className="size-3" />
                {overdue} not heard from in over a year
              </Badge>
            ) : null}
            {failed > 0 ? (
              <Badge variant="outline" className="border-who-fail/50 text-who-fail">
                {failed} whose latest load failed
              </Badge>
            ) : null}
          </div>

          <ModuleTabs
            tabs={[
              { id: 'countries', label: 'By country', count: statuses.length },
              { id: 'batches', label: 'Every submission', count: batches?.length ?? 0 },
            ]}
            active={view}
            onChange={setView}
          />

          {view === 'countries' ? (
            <DataTable
              data={statuses}
              columns={countryColumns}
              searchPlaceholder="Search countries…"
              getRowId={(r) => r.iso3}
              pageSize={25}
              exportLabel="Export CSV"
              onExport={(rows) =>
                downloadCsv(
                  rows.map((r) => ({
                    Country: r.country,
                    ISO3: r.iso3,
                    'Last received': formatDate(r.lastReceivedUtc),
                    'Days ago': r.daysAgo ?? '',
                    Series: r.series,
                    Format: r.format,
                    Rows: r.rowCount,
                    'Years covered': r.yearsCovered,
                    Status: STATUS_LABELS[r.status],
                    'Received via': r.origin,
                    Submissions: r.submissions,
                    Batch: r.batchId ?? '',
                  })),
                  [
                    'Country',
                    'ISO3',
                    'Last received',
                    'Days ago',
                    'Series',
                    'Format',
                    'Rows',
                    'Years covered',
                    'Status',
                    'Received via',
                    'Submissions',
                    'Batch',
                  ],
                  'data-tracking',
                )
              }
              toolbar={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadXlsx(
                      [
                        {
                          name: 'By country',
                          headers: [
                            'Country',
                            'ISO3',
                            'Last received',
                            'Days ago',
                            'Series',
                            'Format',
                            'Rows',
                            'Years covered',
                            'Status',
                            'Received via',
                            'Submissions',
                            'Batch',
                          ],
                          rows: statuses.map((r) => ({
                            Country: r.country,
                            ISO3: r.iso3,
                            'Last received': formatDate(r.lastReceivedUtc),
                            'Days ago': r.daysAgo ?? '',
                            Series: r.series,
                            Format: r.format,
                            Rows: r.rowCount,
                            'Years covered': r.yearsCovered,
                            Status: STATUS_LABELS[r.status],
                            'Received via': r.origin,
                            Submissions: r.submissions,
                            Batch: r.batchId ?? '',
                          })),
                        },
                        {
                          name: 'Every submission',
                          headers: [
                            'Country',
                            'Received',
                            'Series',
                            'Format',
                            'Rows',
                            'Years covered',
                            'Status',
                            'Received via',
                            'Batch',
                          ],
                          rows: (batches ?? []).map((b) => ({
                            Country: COUNTRY_BY_ISO3.get(b.iso3)?.NAME_SHORT_EN ?? b.iso3,
                            Received: formatDate(b.receivedUtc),
                            Series: b.series,
                            Format: b.format,
                            Rows: b.rowCount,
                            'Years covered': `${b.yearsCovered[0]}–${b.yearsCovered[1]}`,
                            Status: STATUS_LABELS[b.status],
                            'Received via': b.origin,
                            Batch: b.batchId,
                          })),
                        },
                      ],
                      'data-tracking',
                    )
                  }
                >
                  Export Excel
                </Button>
              }
              emptyMessage="No submissions recorded for these countries."
            />
          ) : (
            <DataTable
              data={batches ?? []}
              columns={batchColumns}
              searchPlaceholder="Search submissions…"
              getRowId={(b) => String(b.batchId)}
              pageSize={25}
              emptyMessage="No submissions recorded for these countries."
            />
          )}
        </>
      )}
    </div>
  )
}
