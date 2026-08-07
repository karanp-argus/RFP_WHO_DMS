/**
 * UC052 — *"run the quality checks from a workbook"*, and see the result on the
 * data rather than on another screen.
 *
 * The panel sits **below** the grid rather than replacing it, for the same
 * reason the metadata drawer sits beside it (plan §2.4): a finding you have to
 * leave the data to read is a finding you cannot act on. Selecting one moves
 * the grid's active cell to the offending value, so reading the list and fixing
 * the data are the same motion.
 *
 * The cells themselves are ringed by `cellRenderers.tsx`, which has had the
 * states since Phase 4 and read them from a `findingFor` that returned
 * `undefined` for everything. This is what fills it in.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, ExternalLink, ShieldCheck, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { QC_RULE_TYPE_LABELS, type QcFinding, type QcRunSummary } from '@/domain/qc'
import { RuleOriginBadge, SeverityBadge } from '@/modules/quality/QcBadges'
import { formatDeviation } from '@/modules/quality/FindingsTable'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { cn } from '@/lib/utils'

export interface QcFindingsPanelProps {
  summary: QcRunSummary
  findings: readonly QcFinding[]
  /** Findings whose cell is not in the current view — counted, never hidden silently. */
  offScreenCount: number
  activeObservationKey: string | null
  onSelect: (finding: QcFinding) => void
  onClose: () => void
}

export function QcFindingsPanel({
  summary,
  findings,
  offScreenCount,
  activeObservationKey,
  onSelect,
  onClose,
}: QcFindingsPanelProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [severity, setSeverity] = useState<string>('all')

  // Phase 8 item 3: Esc closes every drawer and panel. This one is not a Radix
  // portal — it is a sibling of the grid — so it does not get it for free.
  useEscapeKey(true, onClose)

  const shown = useMemo(
    () => (severity === 'all' ? findings : findings.filter((f) => f.severity === severity)),
    [findings, severity],
  )

  return (
    <section
      aria-label="Quality check findings"
      className="rounded border border-who-border bg-who-surface"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-who-border px-3 py-2">
        <ShieldCheck
          className={cn(
            'size-4',
            summary.errors > 0
              ? 'text-who-fail'
              : summary.warnings > 0
                ? 'text-who-warn'
                : 'text-who-pass',
          )}
          aria-hidden
        />
        <h3 className="text-[length:var(--text-body-sm)] font-semibold text-who-heading">
          Quality checks
        </h3>

        {summary.errors === 0 && summary.warnings === 0 ? (
          <Badge className="border-who-pass/50 bg-who-pass/10 text-who-pass">
            Everything in view passed
          </Badge>
        ) : (
          <>
            {summary.errors > 0 ? (
              <Badge className="border-who-fail/50 bg-who-fail/10 text-who-fail">
                {summary.errors} failure{summary.errors === 1 ? '' : 's'}
              </Badge>
            ) : null}
            {summary.warnings > 0 ? (
              <Badge className="border-who-warn/50 bg-who-warn/10 text-who-warn">
                {summary.warnings} warning{summary.warnings === 1 ? '' : 's'}
              </Badge>
            ) : null}
          </>
        )}

        <span className="text-[length:var(--text-meta)] text-who-text-muted">
          {summary.ruleIds.length} applicable rule{summary.ruleIds.length === 1 ? '' : 's'} ·{' '}
          {summary.observationsChecked.toLocaleString('en-GB')} values checked
        </span>

        {/* Findings on cells outside the current filter are counted rather than
            dropped: a panel that shows six of nine findings and says nothing is
            worse than one that shows six and says so. */}
        {offScreenCount > 0 ? (
          <Badge variant="outline" className="text-who-text-muted">
            {offScreenCount} outside the current view
          </Badge>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          {findings.length > 0 ? (
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger className="h-7 w-40 text-[length:var(--text-meta)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All findings</SelectItem>
                <SelectItem value="error">Failures only</SelectItem>
                <SelectItem value="warning">Warnings only</SelectItem>
              </SelectContent>
            </Select>
          ) : null}

          <Button asChild variant="outline" size="sm" className="h-7 gap-1.5">
            <Link to={`/quality-checks/reports/${summary.id}`}>
              <ExternalLink className="size-3.5" />
              Full report
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand findings' : 'Collapse findings'}
          >
            {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
            aria-label="Dismiss findings"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </header>

      {collapsed ? null : (
        <ul className="max-h-56 list-none overflow-y-auto">
          {shown.map((finding) => {
            const isActive = finding.observationKey === activeObservationKey
            return (
              <li key={finding.id}>
                <button
                  type="button"
                  onClick={() => onSelect(finding)}
                  className={cn(
                    'flex w-full flex-wrap items-start gap-2 border-b border-who-border/60 px-3 py-2 text-left',
                    'hover:bg-who-accent-subtle',
                    isActive && 'bg-who-accent-subtle',
                  )}
                >
                  <SeverityBadge severity={finding.severity} />
                  <span className="font-mono text-[length:var(--text-meta)] whitespace-nowrap text-who-text-muted">
                    {finding.iso3} · {finding.year} · {finding.code}
                  </span>
                  <span className="min-w-0 flex-1 text-[length:var(--text-body-sm)] text-who-text">
                    {finding.message}
                    {finding.note ? (
                      <span className="mt-0.5 block text-[length:var(--text-meta)] text-who-text-muted italic">
                        {finding.note}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-[length:var(--text-meta)] font-semibold tabular-nums text-who-text">
                      {formatDeviation(finding)}
                    </span>
                    <RuleOriginBadge origin={finding.ruleOrigin} />
                    <span className="hidden max-w-40 truncate text-[length:var(--text-meta)] text-who-text-muted lg:inline">
                      {QC_RULE_TYPE_LABELS[finding.ruleType]}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}

          {shown.length === 0 ? (
            <li className="px-3 py-4 text-center text-[length:var(--text-meta)] text-who-text-muted">
              {findings.length === 0
                ? 'No findings on the data currently in view.'
                : 'No findings match that filter.'}
            </li>
          ) : null}
        </ul>
      )}
    </section>
  )
}
