/**
 * UC044's last clause — *"an administrator can restore a whole dataset as of a
 * date."*
 *
 * Phase 4 built the per-observation half (compare up to 10 versions, restore
 * one). This is the bulk half, and it is deliberately **preview then apply**:
 * a dataset restore rewrites values across thousands of cells, and an
 * administrator who cannot see what would change before it changes has no way
 * to tell a correction from an accident.
 *
 * Only observations with version history can be restored, and only those whose
 * as-of value differs from today's are listed. An observation whose history
 * does not reach back to the chosen date is left alone rather than blanked —
 * restoring it to "nothing" would delete data on the strength of missing
 * evidence.
 */

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, History, RotateCcw, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CountryPicker } from '@/components/common/CountryPicker'
import { EmptyState } from '@/components/common/EmptyState'
import { FIRST_YEAR, LAST_YEAR } from '@/domain/constants'
import { REPORT_DEMO_COUNTRIES } from '@/data/seed/reports'
import { applyEdits } from '@/data/db'
import { mockXMartClient } from '@/data/xmart/mockClient'
import type { DatasetAsOfResult } from '@/data/xmart/client'
import { usePermissions } from '@/hooks/usePermissions'
import { formatValue } from '@/lib/format'
import { useNotificationStore } from '@/stores/notificationStore'

/** How many rows of the preview to render. The count above it is the truth. */
const PREVIEW_ROWS = 50

export function DatasetRestoreTab() {
  const { isAdmin, user } = usePermissions()
  const queryClient = useQueryClient()
  const push = useNotificationStore((s) => s.push)

  const [countries, setCountries] = useState<string[]>([...REPORT_DEMO_COUNTRIES.slice(0, 2)])
  const [asOf, setAsOf] = useState('2026-01-01')
  const [yearFrom, setYearFrom] = useState(FIRST_YEAR)
  const [yearTo, setYearTo] = useState(LAST_YEAR)

  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<DatasetAsOfResult | null>(null)
  const [applied, setApplied] = useState<number | null>(null)

  if (!isAdmin) {
    return (
      <EmptyState
        message="Dataset-level restore is an administrator action"
        hint="UC044 gives every user version compare and single-observation restore — those live in the workbook, on the cell’s right-click menu. Restoring a whole dataset as of a date is limited to administrators."
      />
    )
  }

  async function preview() {
    setBusy(true)
    setApplied(null)
    try {
      const out = await mockXMartClient.getDatasetAsOf(
        { countries, yearFrom, yearTo },
        `${asOf}T00:00:00.000Z`,
      )
      setResult(out)
    } finally {
      setBusy(false)
    }
  }

  async function apply() {
    if (!result || result.changes.length === 0) return
    setBusy(true)
    try {
      const authorId = user?.id ?? 'unknown'
      // UC046 — the restore is a push like any other edit, carrying the author.
      const put = await mockXMartClient.putObservations(
        result.changes.map((c) => ({
          observationKey: c.observationKey,
          value: c.asOfValue,
          authorId,
        })),
      )
      // And it lands in the local overlay so the workbook shows it immediately.
      applyEdits(
        result.changes.map((c) => ({
          observationKey: c.observationKey,
          value: c.asOfValue,
          authorId,
        })),
      )
      await queryClient.invalidateQueries({ queryKey: ['xmart'] })
      setApplied(put.accepted)
      push({
        kind: 'success',
        title: 'Dataset restored',
        body: `${put.accepted.toLocaleString()} observations restored to their value as of ${asOf}, pushed to xMart as batch ${put.batchId}.`,
        href: '/integration?tab=restore',
      })
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <Card className="shadow-who-card">
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[length:var(--text-h5)] font-semibold text-who-heading">
                Restore a dataset as of a date
              </h3>
              <p className="mt-1 max-w-3xl text-[length:var(--text-body-sm)] text-who-text-muted">
                Finds the version of each observation that was current on the chosen date and shows
                what would change. Nothing is written until you apply it.
              </p>
            </div>
            <Badge variant="secondary" className="font-mono">
              UC044
            </Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_1fr]">
            <div className="space-y-1.5">
              <Label>Countries</Label>
              <CountryPicker
                selected={countries}
                onChange={setCountries}
                ariaLabel="Countries to restore"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restore-asof">As of</Label>
              <Input
                id="restore-asof"
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restore-from">First year</Label>
              <Input
                id="restore-from"
                type="number"
                value={yearFrom}
                onChange={(e) => setYearFrom(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="restore-to">Last year</Label>
              <Input
                id="restore-to"
                type="number"
                value={yearTo}
                onChange={(e) => setYearTo(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button
              onClick={preview}
              disabled={busy || countries.length === 0}
              className="gap-1.5"
            >
              <Search className="size-4" />
              {busy && !result ? 'Scanning history…' : 'Preview changes'}
            </Button>
            {result && result.changes.length > 0 ? (
              <Button variant="outline" onClick={apply} disabled={busy} className="gap-1.5">
                <RotateCcw className="size-4" />
                Restore {result.changes.length.toLocaleString()} observations
              </Button>
            ) : null}
          </div>

          {applied != null ? (
            <p className="mt-3 rounded border border-who-pass/40 bg-who-pass/10 px-3 py-2 text-[length:var(--text-body-sm)] text-who-text">
              {applied.toLocaleString()} observations restored and pushed back to xMart with your
              user id attached (UC046). Open a workbook for one of these countries to see it.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {result ? (
        <Card className="shadow-who-card">
          <CardContent className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--text-body-sm)]">
              <span className="flex items-center gap-1.5 font-semibold text-who-heading">
                <History className="size-4" aria-hidden />
                {result.changes.length.toLocaleString()} would change
              </span>
              <span className="text-who-text-muted">
                {result.scanned.toLocaleString()} observations scanned ·{' '}
                {result.withHistory.toLocaleString()} carry version history
              </span>
              {result.truncated ? (
                <span className="flex items-center gap-1.5 text-who-warn">
                  <AlertTriangle className="size-4" aria-hidden />
                  Scan budget reached — narrow the countries or the year range.
                </span>
              ) : null}
            </div>

            {result.changes.length === 0 ? (
              <EmptyState
                message="Nothing to restore"
                hint="No observation in this slice held a different value on that date. Try an earlier date, or a country with more revision history."
              />
            ) : (
              <>
                <div className="overflow-x-auto rounded border border-who-border">
                  <table className="w-full border-collapse text-[length:var(--text-body-sm)]">
                    <thead className="border-b border-who-border">
                      <tr>
                        {['Country', 'Year', 'Variable', 'Now', `As of ${asOf}`, 'Version by'].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-3 py-2 text-left text-[length:var(--text-meta)] font-semibold tracking-wide text-who-heading uppercase"
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {result.changes.slice(0, PREVIEW_ROWS).map((c) => (
                        <tr
                          key={c.observationKey}
                          className="border-b border-who-border/60 last:border-b-0"
                        >
                          <td className="px-3 py-2 text-who-text">{c.iso3}</td>
                          <td className="px-3 py-2 tabular-nums text-who-text">{c.year}</td>
                          <td className="px-3 py-2 font-mono text-who-text-muted">{c.code}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-who-text">
                            {c.currentValue == null ? '—' : formatValue(c.currentValue)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold text-who-primary-blue">
                            {c.asOfValue == null ? '—' : formatValue(c.asOfValue)}
                          </td>
                          <td className="px-3 py-2 text-[length:var(--text-meta)] text-who-text-muted">
                            {c.asOfAuthor}
                            <span className="block text-who-hint">
                              {c.asOfCommitDateUtc.slice(0, 10)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {result.changes.length > PREVIEW_ROWS ? (
                  <p className="mt-2 text-[length:var(--text-meta)] text-who-text-muted">
                    Showing the first {PREVIEW_ROWS} of {result.changes.length.toLocaleString()}.
                    Applying restores all of them.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
