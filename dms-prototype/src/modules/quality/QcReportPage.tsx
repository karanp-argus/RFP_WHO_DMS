/**
 * One quality-check report (UC055).
 *
 * *"Generate a report of the quality checks, visualise it and download it."*
 * All three, in that order down the page: the summary tiles say what the run
 * found, the scatter shows where it sits, the table is what a reviewer works
 * from, and the two download buttons are at the top where someone who only
 * wants the file can reach them without scrolling past everything else.
 *
 * **A report whose findings are no longer in memory says so.** Findings are not
 * persisted — see `qcStore` for why — so a report opened after a reload has its
 * summary and its per-rule accounting but not its rows. Showing an empty table
 * there would be a lie about a run that found 900 things, so it offers to run
 * the same scope again instead.
 */

import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Download, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState, LoadingState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { QC_RULE_TYPE_LABELS, thresholdsFor, type QcFinding } from '@/domain/qc'
import { useQcRun } from '@/hooks/useQcRun'
import {
  allRules,
  recallFindings,
  useQcStore,
  useQcThresholds,
} from '@/stores/qcStore'
import { cn } from '@/lib/utils'
import { FindingsScatter } from './FindingsScatter'
import { FindingsTable } from './FindingsTable'
import { downloadFindingsCsv, downloadRunXlsx } from './exportFindings'
import { PassBadge, RuleOriginBadge } from './QcBadges'

/* --------------------------------------------------------------------------
   Summary tiles
   -------------------------------------------------------------------------- */

function Tile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'neutral' | 'fail' | 'warn' | 'pass'
}) {
  return (
    <Card className="min-w-40 flex-1">
      <CardContent className="px-4 py-3">
        <p className="text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
          {label}
        </p>
        <p
          className={cn(
            'mt-1 text-2xl leading-none font-bold tabular-nums',
            tone === 'fail' && 'text-who-fail',
            tone === 'warn' && 'text-who-warn',
            tone === 'pass' && 'text-who-pass',
            tone === 'neutral' && 'text-who-heading',
          )}
        >
          {typeof value === 'number' ? value.toLocaleString('en-GB') : value}
        </p>
        {hint ? (
          <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/* --------------------------------------------------------------------------
   The page
   -------------------------------------------------------------------------- */

export function QcReportPage() {
  const { runId = '' } = useParams()
  const runs = useQcStore((s) => s.runs)
  const ruleEdits = useQcStore((s) => s.ruleEdits)
  const removedRuleIds = useQcStore((s) => s.removedRuleIds)
  const thresholds = useQcThresholds()
  const { run, isRunning, result: freshResult } = useQcRun()

  const [ruleFilter, setRuleFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')

  const record = runs.find((r) => r.summary.id === runId)
  // A run made in this session is in memory; the fresh result covers the case
  // where "run again" has just replaced it under a new id.
  const findings: QcFinding[] | undefined =
    freshResult?.summary.id === runId ? freshResult.findings : recallFindings(runId)

  const rules = useMemo(() => allRules(ruleEdits, removedRuleIds), [ruleEdits, removedRuleIds])

  const filtered = useMemo(() => {
    if (!findings) return []
    return findings.filter(
      (f) =>
        (ruleFilter === 'all' || f.ruleId === ruleFilter) &&
        (severityFilter === 'all' || f.severity === severityFilter),
    )
  }, [findings, ruleFilter, severityFilter])

  /**
   * Threshold lines are only drawn when every plotted finding came from one
   * rule. Two rules measuring in percent and in sigma share an axis but not a
   * meaning, and a line across both would be read as applying to both.
   */
  const plotThresholds = useMemo(() => {
    if (ruleFilter === 'all') return null
    const rule = rules.find((r) => r.id === ruleFilter)
    return rule ? thresholdsFor(rule, thresholds) : null
  }, [ruleFilter, rules, thresholds])

  if (!record) {
    return (
      <>
        <PageHeader title="Quality check report" />
        <EmptyState
          message="That report is not in the history"
          hint="Reports are kept for the last twenty runs. Run the checks again to produce a new one."
          action={
            <Button asChild>
              <Link to="/quality-checks">Back to Quality Checks</Link>
            </Button>
          }
        />
      </>
    )
  }

  const { summary, ruleStats } = record
  const firedRules = ruleStats.filter((s) => s.errors + s.warnings > 0)
  const clean = ruleStats.length - firedRules.length

  return (
    <>
      <PageHeader
        title="Quality check report"
        description={`${summary.scope.label} · ${summary.scope.yearFrom}–${summary.scope.yearTo} · run ${new Date(summary.runUtc).toLocaleString('en-GB')}`}
        actions={
          <>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/quality-checks?tab=reports">
                <ArrowLeft className="size-3.5" />
                All reports
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!findings}
              onClick={() => findings && downloadFindingsCsv(filtered)}
            >
              <Download className="size-3.5" />
              CSV
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!findings}
              onClick={() => findings && downloadRunXlsx(summary, ruleStats, filtered)}
            >
              <FileSpreadsheet className="size-3.5" />
              Excel
            </Button>
          </>
        }
      />

      {/* --- summary tiles ------------------------------------------------ */}
      <div className="mb-4 flex flex-wrap gap-3">
        <Tile
          label="Failures"
          value={summary.errors}
          tone={summary.errors > 0 ? 'fail' : 'pass'}
          hint="Values that cannot be right"
        />
        <Tile
          label="Warnings"
          value={summary.warnings}
          tone={summary.warnings > 0 ? 'warn' : 'pass'}
          hint="Worth a reviewer's eye"
        />
        <Tile
          label="Countries affected"
          value={summary.countriesWithFindings}
          hint={`of ${summary.scope.countries.length} in scope`}
        />
        <Tile
          label="Values checked"
          value={summary.observationsChecked}
          hint={`across ${summary.ruleIds.length} rules`}
        />
        <Tile
          label="Rules clean"
          value={`${clean} / ${ruleStats.length}`}
          tone={clean === ruleStats.length ? 'pass' : 'neutral'}
          hint="Found nothing in scope"
        />
      </div>

      {!findings ? (
        <EmptyState
          message="This report's findings are no longer loaded"
          hint="Report summaries are kept across reloads; the findings themselves are held for the session only, so that a few large runs cannot fill the browser storage the workbook's unsaved edits depend on. Running the same scope again reproduces them exactly — the data is derived, not sampled."
          action={
            <Button
              className="gap-1.5"
              disabled={isRunning}
              onClick={async () => {
                const outcome = await run(rules, summary.scope)
                if (outcome) {
                  toast.success(
                    `Re-ran ${outcome.summary.ruleIds.length} rules — ${outcome.summary.errors} failures, ${outcome.summary.warnings} warnings.`,
                  )
                }
              }}
            >
              <RefreshCw className={cn('size-3.5', isRunning && 'animate-spin')} />
              Run this scope again
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {/* --- filters -------------------------------------------------- */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={ruleFilter} onValueChange={setRuleFilter}>
              <SelectTrigger className="w-80" aria-label="Filter by rule">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rules ({ruleStats.length})</SelectItem>
                {firedRules.map((s) => (
                  <SelectItem key={s.ruleId} value={s.ruleId}>
                    {s.ruleName} ({s.errors + s.warnings})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-44" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Failures and warnings</SelectItem>
                <SelectItem value="error">Failures only</SelectItem>
                <SelectItem value="warning">Warnings only</SelectItem>
              </SelectContent>
            </Select>

            <Badge variant="secondary">
              {filtered.length.toLocaleString('en-GB')} of {findings.length.toLocaleString('en-GB')}{' '}
              findings
            </Badge>
          </div>

          {/* --- the visualisation UC055 asks for ------------------------- */}
          <Card>
            <CardContent className="px-4 py-3">
              <p className="mb-1 text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                Findings by year and magnitude
              </p>
              <p className="mb-2 text-[length:var(--text-meta)] text-who-text-muted">
                {ruleFilter === 'all'
                  ? 'Filter to a single rule to see the thresholds that produced these findings drawn in.'
                  : `Dashed lines are the warning and failure thresholds for ${
                      rules.find((r) => r.id === ruleFilter)?.name ?? 'this rule'
                    }.`}{' '}
                Magnitude is on a log scale.
              </p>
              <FindingsScatter findings={filtered} thresholds={plotThresholds} />
            </CardContent>
          </Card>

          {/* --- per-rule accounting -------------------------------------- */}
          <Card>
            <CardContent className="px-4 py-3">
              <p className="mb-2 text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                What each rule found
              </p>
              <div className="flex flex-wrap gap-2">
                {ruleStats.map((s) => {
                  const total = s.errors + s.warnings
                  return (
                    <button
                      key={s.ruleId}
                      type="button"
                      onClick={() => setRuleFilter(ruleFilter === s.ruleId ? 'all' : s.ruleId)}
                      className={cn(
                        'flex max-w-72 items-start gap-2 rounded border px-2.5 py-1.5 text-left transition-colors',
                        ruleFilter === s.ruleId
                          ? 'border-who-primary-blue bg-who-accent-subtle'
                          : 'border-who-border hover:border-who-primary-blue',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[length:var(--text-body-sm)] text-who-text">
                          {s.ruleName}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1">
                          <RuleOriginBadge origin={s.ruleOrigin} />
                          <span className="text-[length:var(--text-meta)] text-who-text-muted">
                            {QC_RULE_TYPE_LABELS[s.ruleType]}
                          </span>
                        </span>
                        {/* UC048 made visible: an exclusion that leaves no trace
                            in the report is indistinguishable from a rule that
                            found nothing. */}
                        {s.excluded > 0 ? (
                          <span className="mt-1 block text-[length:var(--text-meta)] text-who-text-muted">
                            {s.excluded} countr{s.excluded === 1 ? 'y' : 'ies'} excluded from this
                            rule
                          </span>
                        ) : null}
                        {s.truncated ? (
                          <span className="mt-1 block text-[length:var(--text-meta)] text-who-warn">
                            Stopped early — the run reached its check budget.
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0">
                        {total === 0 ? (
                          <PassBadge />
                        ) : (
                          <span className="flex flex-col items-end gap-0.5">
                            {s.errors > 0 ? (
                              <span className="text-[length:var(--text-meta)] font-semibold text-who-fail tabular-nums">
                                {s.errors} fail
                              </span>
                            ) : null}
                            {s.warnings > 0 ? (
                              <span className="text-[length:var(--text-meta)] font-semibold text-who-warn tabular-nums">
                                {s.warnings} warn
                              </span>
                            ) : null}
                          </span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* --- the table ------------------------------------------------ */}
          {isRunning ? (
            <LoadingState label="Re-running the checks…" />
          ) : (
            <FindingsTable
              findings={filtered}
              yearFrom={summary.scope.yearFrom}
              yearTo={summary.scope.yearTo}
              onExport={(rows) => downloadFindingsCsv(rows)}
            />
          )}
        </div>
      )}
    </>
  )
}
