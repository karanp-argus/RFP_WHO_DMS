/**
 * Running a report (UC035, UC036, UC041, UC042).
 *
 * UC036 describes the run as a prompt, not a button: *"execution of the report
 * may require the selection of one or multiple variables values ... the user
 * will have the chance to generate it for display on screen (with possibility
 * to download afterwards) or for download only"*. So the page is parameters
 * first, result second, and the delivery choice is explicit rather than implied
 * by which button was pressed.
 *
 * **The routing decision is shown before it is made.** A run that will go to
 * the background says so, and says why, above the Run button — a report that
 * silently vanishes into a queue is the behaviour UC042 is trying to replace,
 * not the one it asks for.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Download,
  FileSpreadsheet,
  Monitor,
  Pencil,
  Play,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CountryPicker } from '@/components/common/CountryPicker'
import { EmptyState, LoadingState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { VariablePicker } from '@/components/common/VariablePicker'
import { YEARS } from '@/domain/constants'
import {
  defaultParameters,
  estimateCoordinates,
  yearRange,
  type ReportRunParameters,
} from '@/domain/report'
import { REPORT_DEMO_COUNTRIES, REPORT_DEMO_SCOPE_LABEL } from '@/data/seed/reports'
import { useReportRun } from '@/hooks/useReportRun'
import { useVariables } from '@/hooks/useSetupData'
import { allReports, useReportStore } from '@/stores/reportStore'
import { cn } from '@/lib/utils'
import { PivotTableView } from './PivotTableView'
import { PresentationControls } from './PresentationControls'
import { downloadReportXlsx } from './exportReport'

export function ReportRunPage() {
  const { reportId = '' } = useParams()
  const navigate = useNavigate()
  const { data: variables } = useVariables()

  const definitionEdits = useReportStore((s) => s.definitionEdits)
  const removedIds = useReportStore((s) => s.removedIds)

  const report = useMemo(
    () => allReports(definitionEdits, removedIds).find((r) => r.id === reportId),
    [definitionEdits, removedIds, reportId],
  )

  const [params, setParams] = useState<ReportRunParameters | null>(null)
  useEffect(() => {
    if (report) setParams(defaultParameters(report))
  }, [report])

  const { run, runInBackground, route, result, isRunning, error, phase } = useReportRun()

  if (!report) {
    return (
      <>
        <PageHeader title="Run report" />
        <EmptyState
          message="That report does not exist"
          hint="It may have been deleted, or it belongs to another user (UC037)."
          action={
            <Button asChild>
              <Link to="/reports">Back to Reports</Link>
            </Button>
          }
        />
      </>
    )
  }

  if (!params) return <LoadingState label="Loading the report…" />

  const update = (patch: Partial<ReportRunParameters>) =>
    setParams((p) => (p ? { ...p, ...patch } : p))

  const codes = params.variables.length > 0 ? params.variables : report.variables
  const coordinates = estimateCoordinates(
    params.countries,
    yearRange(params.yearFrom, params.yearTo),
    codes,
  )
  const routing = route(report, params)
  const canRun = params.countries.length > 0 && codes.length > 0 && !isRunning

  async function handleRun() {
    if (!params || !report) return

    if (routing.background) {
      const jobId = runInBackground(report, params, routing.reason)
      if (!jobId) {
        toast.error('Configuration is still loading from xMart. Try again in a moment.')
        return
      }
      toast.success('Running in the background.', {
        description:
          'Carry on working — a notification will arrive with the download link when it is done (UC042).',
      })
      navigate('/reports?tab=jobs')
      return
    }

    const outcome = await run(report, params)
    if (!outcome) return

    if (params.delivery === 'download') {
      downloadReportXlsx({
        definition: report,
        parameters: params,
        table: outcome.table,
        runBy: 'You',
        runUtc: outcome.runUtc,
      })
      toast.success('Excel file downloaded.')
      return
    }
    toast.success(
      `${outcome.table.rows.length} rows × ${outcome.table.columns.length} columns.`,
      { description: `${outcome.table.valuesRead.toLocaleString('en-GB')} values read.` },
    )
  }

  return (
    <>
      <PageHeader
        title={report.name}
        description={report.description}
        actions={
          <>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/reports">
                <ArrowLeft className="size-3.5" />
                All reports
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to={`/reports/builder/${report.id}`}>
                <Pencil className="size-3.5" />
                Layout
              </Link>
            </Button>
          </>
        }
      />

      {/* --- parameters ------------------------------------------------- */}
      <Card className="mb-4">
        <CardContent className="space-y-4 px-4 py-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label>Countries</Label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <div className="min-w-[240px] flex-1">
                  <CountryPicker
                    selected={params.countries}
                    onChange={(c) => update({ countries: c })}
                    placeholder="Choose countries…"
                    ariaLabel="Countries to run the report for"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => update({ countries: [...REPORT_DEMO_COUNTRIES] })}
                >
                  {/* Labelled as a prototype affordance, per CLAUDE.md. */}
                  {REPORT_DEMO_SCOPE_LABEL} ({REPORT_DEMO_COUNTRIES.length})
                </Button>
              </div>
            </div>

            <div>
              <Label>Variables</Label>
              <div className="mt-1">
                <VariablePicker
                  variables={variables ?? []}
                  selected={params.variables}
                  onChange={(v) => update({ variables: v })}
                  placeholder="Use the report’s own selection…"
                />
              </div>
              {params.variables.length === 0 && report.variables.length > 0 ? (
                <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
                  Using the report’s {report.variables.length} saved variables.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="run-year-from" className="text-[length:var(--text-meta)]">
                From year
              </Label>
              <Select
                value={String(params.yearFrom)}
                onValueChange={(v) => update({ yearFrom: Math.min(Number(v), params.yearTo) })}
              >
                <SelectTrigger id="run-year-from" className="mt-1 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="run-year-to" className="text-[length:var(--text-meta)]">
                To year
              </Label>
              <Select
                value={String(params.yearTo)}
                onValueChange={(v) => update({ yearTo: Math.max(Number(v), params.yearFrom) })}
              >
                <SelectTrigger id="run-year-to" className="mt-1 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Badge variant="secondary" className="mb-2">
              {coordinates.toLocaleString('en-GB')} country × year × variable combinations
            </Badge>
          </div>

          <PresentationControls
            presentation={params.presentation}
            idPrefix="run"
            onChange={(p) => update({ presentation: p, language: p.language })}
          />

          {/* --- UC036: on screen, or download only ----------------------- */}
          <div>
            <Label>Delivery</Label>
            <RadioGroup
              value={params.delivery}
              onValueChange={(v) => update({ delivery: v as 'screen' | 'download' })}
              className="mt-1 flex flex-wrap gap-3"
            >
              <label className="flex cursor-pointer items-center gap-2 rounded border border-who-border px-3 py-2 text-[length:var(--text-body-sm)]">
                <RadioGroupItem value="screen" id="delivery-screen" />
                <Monitor className="size-4 text-who-icon" />
                <span>
                  Display on screen
                  <span className="block text-[length:var(--text-meta)] text-who-text-muted">
                    Download afterwards if you want it
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded border border-who-border px-3 py-2 text-[length:var(--text-body-sm)]">
                <RadioGroupItem value="download" id="delivery-download" />
                <FileSpreadsheet className="size-4 text-who-icon" />
                <span>
                  Download only
                  <span className="block text-[length:var(--text-meta)] text-who-text-muted">
                    {report.oneFilePerCountry
                      ? 'One Excel file per country'
                      : 'A single Excel file'}
                  </span>
                </span>
              </label>
            </RadioGroup>
          </div>

          {/* --- the routing decision, stated ---------------------------- */}
          {routing.background ? (
            <p className="flex items-start gap-2 rounded border border-who-border bg-who-page-bg px-3 py-2 text-[length:var(--text-meta)] text-who-text">
              <Clock className="mt-0.5 size-3.5 shrink-0 text-who-primary-blue" />
              <span>
                <strong className="font-semibold">This run goes to the background.</strong>{' '}
                {routing.reason} You can carry on working; a notification will arrive with the
                download link when it finishes (UC042).
              </span>
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button className="gap-1.5" disabled={!canRun} onClick={() => void handleRun()}>
              <Play className="size-3.5" />
              {routing.background
                ? 'Queue the report'
                : params.delivery === 'download'
                  ? 'Generate and download'
                  : 'Run report'}
            </Button>
            {isRunning ? (
              <span className="text-[length:var(--text-meta)] text-who-text-muted">
                {phase === 'fetching' ? 'Pulling observations from xMart…' : 'Building the pivot…'}
              </span>
            ) : null}
            {error ? (
              <span className="flex items-center gap-1.5 text-[length:var(--text-meta)] text-who-fail">
                <AlertTriangle className="size-3.5" />
                {error}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* --- the result --------------------------------------------------- */}
      {isRunning && !result ? <LoadingState label="Building the report…" /> : null}

      {result ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {result.table.rows.length.toLocaleString('en-GB')} rows ×{' '}
              {result.table.columns.length.toLocaleString('en-GB')} columns
            </Badge>
            <Badge variant="secondary">
              {result.table.valuesRead.toLocaleString('en-GB')} values
            </Badge>
            {result.table.units.length > 0 ? (
              <Badge variant="outline" className="text-who-text-muted">
                {result.table.units.join(' · ')}
              </Badge>
            ) : null}
            {result.table.unconverted > 0 ? (
              <Badge variant="outline" className="border-who-warn/50 text-who-warn">
                {result.table.unconverted} not converted — no exchange rate
              </Badge>
            ) : null}

            <Button
              size="sm"
              className="ml-auto gap-1.5"
              onClick={() => {
                downloadReportXlsx({
                  definition: report,
                  parameters: result.parameters,
                  table: result.table,
                  runBy: 'You',
                  runUtc: result.runUtc,
                })
                toast.success('Excel file downloaded.')
              }}
            >
              <Download className="size-3.5" />
              Download Excel
            </Button>
          </div>

          {result.table.truncated ? (
            <p
              className={cn(
                'flex items-start gap-2 rounded border border-who-warn/40 px-3 py-2',
                'text-[length:var(--text-meta)] text-who-warn',
              )}
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {result.table.truncationNote}
            </p>
          ) : null}

          <PivotTableView table={result.table} decimals={result.parameters.presentation.decimals} />
        </div>
      ) : null}
    </>
  )
}
