/**
 * UC042 — the background job queue.
 *
 * *"In case of complex reports where there is high processing power required,
 * in order to avoid the web application to be blocked, the report processing
 * will take place in the background, so that the user can continue working with
 * DMS."*
 *
 * What is real here and what is not, stated plainly because the demo will be
 * asked: the pivot, the Excel files and the progress are **real** — the job
 * pivots and writes one country at a time and the bar tracks files finished,
 * not a timer. What a front-end prototype cannot do is survive the tab closing,
 * so the queue is session state and the files live in memory. A job whose files
 * have been dropped says so and offers to run it again, rather than presenting
 * a download button that does nothing.
 */

import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EmptyState } from '@/components/common/EmptyState'
import { downloadBlob } from '@/lib/exporters'
import { cn } from '@/lib/utils'
import {
  hasJobFiles,
  recallJobFile,
  useReportStore,
  type ReportJob,
} from '@/stores/reportStore'
import { downloadJobFiles } from '../jobFiles'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function JobCard({ job }: { job: ReportJob }) {
  const filesAvailable = hasJobFiles(job.id)
  const isRunning = job.status === 'queued' || job.status === 'running'

  return (
    <Card>
      <CardContent className="space-y-3 px-4 py-3">
        <div className="flex flex-wrap items-start gap-3">
          <span className="mt-0.5">
            {job.status === 'complete' ? (
              <CheckCircle2 className="size-5 text-who-pass" />
            ) : job.status === 'failed' ? (
              <AlertTriangle className="size-5 text-who-fail" />
            ) : (
              <Loader2 className="size-5 animate-spin text-who-primary-blue" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/reports/run/${job.reportId}`}
                className="text-[length:var(--text-body-sm)] font-semibold text-who-heading hover:text-who-primary-blue hover:underline"
              >
                {job.reportName}
              </Link>
              <Badge variant="secondary">
                {job.countries.length} countr{job.countries.length === 1 ? 'y' : 'ies'}
              </Badge>
              <span className="text-[length:var(--text-meta)] text-who-text-muted">
                requested by {job.requestedBy} ·{' '}
                {new Date(job.requestedUtc).toLocaleString('en-GB')}
              </span>
            </div>

            <p className="mt-1 text-[length:var(--text-meta)] text-who-text-muted">
              {/* Why this run was routed to the queue — never magic. */}
              {job.reason}
            </p>
            <p
              className={cn(
                'mt-1 text-[length:var(--text-meta)]',
                job.status === 'failed' ? 'text-who-fail' : 'text-who-text',
              )}
            >
              {job.error ?? job.step}
            </p>
          </div>

          {job.status === 'complete' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    className="gap-1.5"
                    disabled={!filesAvailable}
                    onClick={() => {
                      const saved = downloadJobFiles(job)
                      toast.success(
                        `Downloading ${saved} file${saved === 1 ? '' : 's'}.`,
                        saved < job.files.length
                          ? {
                              description: `${job.files.length - saved} were no longer held in memory.`,
                            }
                          : undefined,
                      )
                    }}
                  >
                    <Download className="size-3.5" />
                    {job.files.length === 1
                      ? 'Download'
                      : `Download all ${job.files.length}`}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {filesAvailable
                  ? 'Saves every file this job produced.'
                  : 'The generated files were held for this session only and have been dropped. Run the report again to rebuild them.'}
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        {isRunning ? (
          <Progress value={Math.round(job.progress * 100)} className="h-1.5" />
        ) : null}

        {job.files.length > 0 ? (
          <ul className="list-none space-y-1 border-t border-who-border pt-2">
            {job.files.map((file) => {
              const blob = recallJobFile(job.id, file.name)
              return (
                <li
                  key={file.name}
                  className="flex flex-wrap items-center gap-2 text-[length:var(--text-meta)]"
                >
                  <FileSpreadsheet className="size-3.5 shrink-0 text-who-icon" />
                  <span className="min-w-0 flex-1 truncate font-mono text-who-text">
                    {file.name}
                  </span>
                  <span className="text-who-text-muted">
                    {file.rows.toLocaleString('en-GB')} rows ×{' '}
                    {file.columns.toLocaleString('en-GB')} columns · {formatBytes(file.bytes)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2"
                    disabled={!blob}
                    onClick={() => blob && downloadBlob(blob, file.name)}
                  >
                    <Download className="size-3" />
                    Save
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function JobsTab() {
  const jobs = useReportStore((s) => s.jobs)
  const clearJobs = useReportStore((s) => s.clearJobs)

  if (jobs.length === 0) {
    return (
      <EmptyState
        message="No background report jobs this session"
        hint="A report flagged heavy, or one that produces a file per country, is handed to the queue and you carry on working. When it finishes, a notification arrives with the download link (UC042)."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[length:var(--text-meta)] text-who-text-muted">
          Jobs and their files are held for this browser session. Report definitions, favourites
          and list order persist; several megabytes of generated Excel deliberately do not.
        </p>
        <Button variant="outline" size="sm" className="ml-auto" onClick={clearJobs}>
          Clear the queue
        </Button>
      </div>

      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  )
}
