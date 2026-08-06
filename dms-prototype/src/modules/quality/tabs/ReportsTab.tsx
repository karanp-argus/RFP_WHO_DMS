/**
 * The report history (UC055).
 *
 * *"...and a persistent report history in the module."* Persistent is the
 * operative word and it is why the summaries are in `localStorage` while the
 * findings are not: a history that survives a reload is the requirement, and a
 * history that fills the browser's storage quota with a hundred thousand
 * findings would take the workbook's unsaved edits down with it.
 *
 * Each row therefore says plainly whether its findings are still loaded. That
 * is more useful than hiding the distinction: the run is reproducible exactly,
 * because the corpus is derived rather than sampled, so "run it again" gives
 * back the same report rather than a similar one.
 */

import { Link } from 'react-router-dom'
import { CircleCheck, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/common/EmptyState'
import { recallFindings, useQcStore } from '@/stores/qcStore'
import { usePermissions } from '@/hooks/usePermissions'
import { cn } from '@/lib/utils'

export function ReportsTab() {
  const runs = useQcStore((s) => s.runs)
  const clearHistory = useQcStore((s) => s.clearHistory)
  const { canEdit } = usePermissions()

  if (runs.length === 0) {
    return (
      <EmptyState
        message="No quality checks have been run yet"
        hint="Run the rules from the Rules tab, or from the toolbar of any open workbook, and the report will appear here."
        action={
          <Button asChild>
            <Link to="/quality-checks?tab=rules">Go to the rules</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-[length:var(--text-body-sm)] text-who-text-muted">
          The last {runs.length} run{runs.length === 1 ? '' : 's'}. Summaries are kept across
          reloads; findings are held for the session.
        </p>
        {canEdit('quality') ? (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={clearHistory}>
            <Trash2 className="size-3.5" />
            Clear history
          </Button>
        ) : null}
      </div>

      <ul className="list-none divide-y divide-who-border/60 rounded border border-who-border bg-who-surface">
        {runs.map(({ summary, ruleStats }) => {
          const loaded = recallFindings(summary.id) != null
          const clean = summary.errors === 0 && summary.warnings === 0
          return (
            <li key={summary.id}>
              <Link
                to={`/quality-checks/reports/${summary.id}`}
                className="flex flex-wrap items-center gap-3 px-3 py-3 hover:bg-who-accent-subtle"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                      {summary.scope.label}
                    </span>
                    <Badge variant="secondary">
                      {summary.scope.countries.length} countr
                      {summary.scope.countries.length === 1 ? 'y' : 'ies'}
                    </Badge>
                    <Badge variant="outline">
                      {summary.scope.yearFrom}–{summary.scope.yearTo}
                    </Badge>
                    {summary.scope.kind === 'workbook' ? (
                      <Badge variant="outline" className="border-who-primary-blue/50 text-who-primary-blue">
                        From a workbook
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
                    {new Date(summary.runUtc).toLocaleString('en-GB')} · {ruleStats.length} rules ·{' '}
                    {summary.observationsChecked.toLocaleString('en-GB')} values checked
                    {!loaded ? ' · findings not loaded' : ''}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  {clean ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex items-center gap-1.5 text-who-pass">
                          <CircleCheck className="size-4" />
                          <span className="text-[length:var(--text-body-sm)] font-semibold">
                            Clean
                          </span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Every rule passed over this scope</TooltipContent>
                    </Tooltip>
                  ) : (
                    <>
                      <Count
                        value={summary.errors}
                        label="failures"
                        className="text-who-fail"
                      />
                      <Count
                        value={summary.warnings}
                        label="warnings"
                        className="text-who-warn"
                      />
                    </>
                  )}
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Count({
  value,
  label,
  className,
}: {
  value: number
  label: string
  className?: string
}) {
  return (
    <span className="text-right">
      <span
        className={cn(
          'block text-lg leading-none font-bold tabular-nums',
          value === 0 ? 'text-who-text-muted' : className,
        )}
      >
        {value.toLocaleString('en-GB')}
      </span>
      <span className="block text-[length:var(--text-meta)] text-who-text-muted">{label}</span>
    </span>
  )
}
