/**
 * Architecture, per-source sync status and a manual pull (UC045, UC046, UC056).
 *
 * The "Pull from xMart" button is a real pull: it invalidates the query cache
 * and refetches the configuration through `XMartClient`, which is why the API
 * log fills up while the progress bar moves. A fake progress animation would
 * have been quicker and would have demonstrated nothing.
 */

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { DEMO_NOW } from '@/domain/constants'
import type { SyncHealth } from '@/domain/integration'
import { mockXMartClient } from '@/data/xmart/mockClient'
import { usePermissions } from '@/hooks/usePermissions'
import { useSyncStatus } from '@/hooks/useSetupData'
import { cn } from '@/lib/utils'
import { ArchitectureDiagram } from '../ArchitectureDiagram'

const HEALTH_ICON: Record<SyncHealth, typeof CheckCircle2> = {
  ok: CheckCircle2,
  stale: Clock,
  failed: AlertTriangle,
}

const HEALTH_CLASS: Record<SyncHealth, string> = {
  ok: 'text-who-pass',
  stale: 'text-who-warn',
  failed: 'text-who-fail',
}

const HEALTH_LABEL: Record<SyncHealth, string> = {
  ok: 'Healthy',
  stale: 'Behind schedule',
  failed: 'Failed',
}

function ago(iso: string): string {
  const hours = Math.round((DEMO_NOW.getTime() - Date.parse(iso)) / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 48) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** The steps a real incremental pull performs, in order. */
const PULL_STEPS = [
  { label: 'Requesting an access token', run: async () => {} },
  { label: 'Country and currency lists', run: () => mockXMartClient.getCountries() },
  { label: 'Classifications and variables', run: () => mockXMartClient.getVariables() },
  { label: 'Crosses and metadata fields', run: () => mockXMartClient.getCrosses() },
  { label: 'Formulas', run: () => mockXMartClient.getFormulas() },
  { label: 'Load batch status', run: () => mockXMartClient.getSyncStatus() },
] as const

export function OverviewTab() {
  const { canEdit } = usePermissions()
  const { data: statuses, isLoading } = useSyncStatus()
  const queryClient = useQueryClient()

  const [pullStep, setPullStep] = useState<number | null>(null)
  const [pulledAt, setPulledAt] = useState<string | null>(null)

  async function pull() {
    setPullStep(0)
    for (let i = 0; i < PULL_STEPS.length; i++) {
      setPullStep(i)
      await PULL_STEPS[i]?.run()
    }
    // Drop the cached configuration so the modules above genuinely re-read it.
    await queryClient.invalidateQueries({ queryKey: ['xmart'] })
    setPullStep(null)
    setPulledAt(new Date().toLocaleTimeString('en-GB'))
  }

  const running = pullStep != null
  const progress = running ? ((pullStep + 1) / PULL_STEPS.length) * 100 : 0

  return (
    <div className="space-y-5">
      <Card className="shadow-who-card">
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[length:var(--text-h5)] font-semibold text-who-heading">
                To-Be data architecture
              </h3>
              <p className="mt-1 max-w-3xl text-[length:var(--text-body-sm)] text-who-text-muted">
                DMS owns no master data. xMart is the warehouse, DMS pulls the slice it needs and
                pushes edits back, and everything downstream reads xMart — which is what UC056
                requires when it says the development has to be done in xMart.
              </p>
            </div>
            <Badge variant="secondary" className="font-mono">
              UC045 · UC046 · UC056
            </Badge>
          </div>
          <ArchitectureDiagram />
        </CardContent>
      </Card>

      <Card className="shadow-who-card">
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[length:var(--text-h5)] font-semibold text-who-heading">
                Source status
              </h3>
              <p className="mt-1 text-[length:var(--text-body-sm)] text-who-text-muted">
                Each source is judged against its own cadence — a nightly API silent for four days
                is late; a quarterly macro load is not.
              </p>
            </div>
            {canEdit('integration') ? (
              <Button onClick={pull} disabled={running} className="gap-1.5">
                <RefreshCw className={cn('size-4', running && 'animate-spin')} />
                {running ? 'Pulling…' : 'Pull from xMart'}
              </Button>
            ) : null}
          </div>

          {running ? (
            <div className="mb-4">
              <Progress value={progress} />
              <p className="mt-1.5 text-[length:var(--text-meta)] text-who-text-muted">
                {PULL_STEPS[pullStep]?.label} — step {pullStep + 1} of {PULL_STEPS.length}. Watch
                the call log fill up; these are real requests through XMartClient.
              </p>
            </div>
          ) : pulledAt ? (
            <p className="mb-4 rounded border border-who-pass/40 bg-who-pass/10 px-3 py-2 text-[length:var(--text-body-sm)] text-who-text">
              Configuration re-read from xMart at {pulledAt}. Every module above now holds the
              refreshed copy.
            </p>
          ) : null}

          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[length:var(--text-body-sm)]">
                <thead className="border-b border-who-border">
                  <tr>
                    {['Source', 'Channel', 'Cadence', 'Last sync', 'Rows', 'Status'].map((h) => (
                      <th
                        key={h}
                        className="px-2 py-2 text-left text-[length:var(--text-meta)] font-semibold tracking-wide text-who-heading uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(statuses ?? []).map((s) => {
                    const Icon = HEALTH_ICON[s.health]
                    return (
                      <tr key={s.source.id} className="border-b border-who-border/60 last:border-b-0">
                        <td className="px-2 py-2.5 align-top">
                          <span className="block font-semibold text-who-heading">
                            {s.source.label}
                          </span>
                          <span className="block max-w-[320px] text-[length:var(--text-meta)] text-who-text-muted">
                            {s.note}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 align-top text-who-text-muted">
                          {s.source.channel}
                          {s.source.format ? (
                            <Badge variant="secondary" className="ml-1.5 font-mono">
                              {s.source.format}
                            </Badge>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5 align-top text-who-text-muted">
                          {s.source.cadence}
                        </td>
                        <td className="px-2 py-2.5 align-top whitespace-nowrap text-who-text">
                          {ago(s.lastSyncUtc)}
                        </td>
                        <td className="px-2 py-2.5 align-top text-right tabular-nums text-who-text">
                          {s.rowCount.toLocaleString()}
                        </td>
                        <td className="px-2 py-2.5 align-top">
                          <span className={cn('flex items-center gap-1.5', HEALTH_CLASS[s.health])}>
                            <Icon className="size-4" aria-hidden />
                            {HEALTH_LABEL[s.health]}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
