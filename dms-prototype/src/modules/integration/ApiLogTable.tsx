/**
 * The xMart API call log (UC045, UC046).
 *
 * Every call the mock client makes is recorded with the HTTP shape it *would*
 * take against the real warehouse, its parameters, the row count and the
 * latency. That is the honest way to demonstrate the architecture: DMS owns no
 * master data, and a page that asserts it is worth less than a log an
 * evaluator can watch fill up while they click.
 *
 * Shared by the header's drawer and the integration page so the two can never
 * disagree about what happened.
 */

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { clearApiLog, subscribeApiLog, type ApiCall } from '@/data/xmart/apiLog'
import { cn } from '@/lib/utils'

/** Live view of the log. A plain subscription — the log is not React state. */
export function useApiLog(): readonly ApiCall[] {
  const [calls, setCalls] = useState<readonly ApiCall[]>([])
  useEffect(() => subscribeApiLog(setCalls), [])
  return calls
}

export interface ApiLogSummary {
  total: number
  pulls: number
  pushes: number
  rows: number
  errors: number
  /** Mean latency in ms across the logged calls, 0 when there are none. */
  meanMs: number
}

export function summariseApiLog(calls: readonly ApiCall[]): ApiLogSummary {
  const total = calls.length
  return {
    total,
    pulls: calls.filter((c) => c.direction === 'pull').length,
    pushes: calls.filter((c) => c.direction === 'push').length,
    rows: calls.reduce((sum, c) => sum + c.rowCount, 0),
    errors: calls.filter((c) => c.status === 'error').length,
    meanMs: total === 0 ? 0 : Math.round(calls.reduce((s, c) => s + c.durationMs, 0) / total),
  }
}

export function ApiLogTable({
  calls,
  onClear,
  compact = false,
}: {
  calls: readonly ApiCall[]
  onClear?: () => void
  /** Drawer mode — narrower, no parameter column. */
  compact?: boolean
}) {
  const summary = useMemo(() => summariseApiLog(calls), [calls])

  if (calls.length === 0) {
    return (
      <EmptyState
        message="No xMart calls yet in this session"
        hint="Open a module — every read and write goes through XMartClient and lands here with the request it would have sent."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--text-meta)] text-who-text-muted">
        <span>
          <strong className="text-who-heading">{summary.total}</strong> calls
        </span>
        <span>
          {summary.pulls} pull · {summary.pushes} push
        </span>
        <span>
          <strong className="text-who-heading">{summary.rows.toLocaleString()}</strong> rows
        </span>
        <span>~{summary.meanMs} ms mean</span>
        {summary.errors > 0 ? (
          <span className="text-who-fail">{summary.errors} failed</span>
        ) : null}
        {onClear ? (
          <Button variant="ghost" size="sm" className="ml-auto gap-1.5" onClick={onClear}>
            <Trash2 className="size-3.5" />
            Clear
          </Button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded border border-who-border bg-who-surface">
        <table className="w-full border-collapse text-[length:var(--text-meta)]">
          <thead className="border-b border-who-border">
            <tr>
              {['', 'Method', 'Request', ...(compact ? [] : ['Parameters']), 'Rows', 'ms'].map(
                (h, i) => (
                  <th
                    key={`${h}-${i}`}
                    className="px-2 py-2 text-left font-semibold tracking-wide text-who-heading uppercase"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <tr
                key={call.id}
                className={cn(
                  'border-b border-who-border/60 last:border-b-0 align-top',
                  call.status === 'error' && 'bg-who-fail/10',
                )}
              >
                <td className="px-2 py-1.5">
                  {call.direction === 'pull' ? (
                    <ArrowDownToLine className="size-3.5 text-who-primary-blue" aria-label="Pull" />
                  ) : (
                    <ArrowUpFromLine className="size-3.5 text-who-warn" aria-label="Push" />
                  )}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <span className="font-mono text-who-heading">{call.method}</span>
                  {call.status === 'error' ? (
                    <Badge variant="destructive" className="ml-1.5">
                      error
                    </Badge>
                  ) : null}
                </td>
                <td className="max-w-[420px] px-2 py-1.5">
                  <span className="block truncate font-mono text-who-text-muted">
                    {call.request}
                  </span>
                  {call.error ? (
                    <span className="block text-who-fail">{call.error}</span>
                  ) : null}
                </td>
                {compact ? null : (
                  <td className="max-w-[360px] px-2 py-1.5">
                    <span className="block truncate font-mono text-who-hint">
                      {Object.entries(call.params)
                        .filter(([, v]) => v !== '' && v != null)
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join('  ·  ') || '—'}
                    </span>
                  </td>
                )}
                <td className="px-2 py-1.5 text-right tabular-nums text-who-text">
                  {call.rowCount.toLocaleString()}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-who-text-muted">
                  {call.durationMs}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[length:var(--text-meta)] text-who-hint">
        Latency is simulated ({'150–400 ms'}) so the modules above exercise real loading states.
        Everything else — the request shape, the parameters, the row counts — is what the call
        actually did.
      </p>
    </div>
  )
}

export { clearApiLog }
