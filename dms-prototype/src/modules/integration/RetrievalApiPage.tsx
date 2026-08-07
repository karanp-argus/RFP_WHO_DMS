/**
 * The Annex 3 Data Retrieval API simulator.
 *
 * This is the API **xMart calls on DMS** — the opposite direction from the rest
 * of the integration module, and the one Annex 3 is written about. The plan's
 * instruction for this screen is literal: *walk the evaluator down the Annex 3
 * mandatory list on one screen.* So the page is three things stacked —
 * a request builder, a real response, and the checklist — and the checklist
 * marks the two rows a browser cannot exhibit as design commitments rather
 * than claiming them.
 *
 * The response is genuinely produced: the parameters go through `XMartClient`,
 * the rows come back from the mock warehouse, and the CSV that downloads is
 * the long format with `Sys_ID` and `Sys_CommitDateUtc` in it. Nothing here is
 * a screenshot of a request.
 */

import { useMemo, useState } from 'react'
import { CheckCircle2, Download, FileCode2, Play, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CountryPicker } from '@/components/common/CountryPicker'
import { PageHeader } from '@/components/layout/PageHeader'
import { FIRST_YEAR, LAST_YEAR } from '@/domain/constants'
import {
  ANNEX3_CATEGORY_LABELS,
  ANNEX3_MANDATORY_COUNT,
  ANNEX3_REQUIREMENTS,
  DEFAULT_RETRIEVAL_PARAMS,
  RETRIEVAL_DEFAULT_PAGE_SIZE,
  retrievalCurl,
  retrievalHeaders,
  retrievalProblems,
  retrievalQueryPairs,
  retrievalUrl,
  type Annex3Category,
  type RetrievalFormat,
  type RetrievalParams,
  type RetrievalResponseMeta,
} from '@/domain/integration'
import { mockXMartClient } from '@/data/xmart/mockClient'
import { toCsv, toLongFormat, LONG_FORMAT_COLUMNS } from '@/data/xmart/longFormat'
import type { Observation } from '@/domain/types'
import { downloadCsvText } from '@/lib/exporters'
import { cn } from '@/lib/utils'

/** Rows shown in the body preview. The CSV download carries the whole page. */
const PREVIEW_ROWS = 8

/** Columns the preview shows first, because they are the ones Annex 3 names. */
const PREVIEW_COLUMNS = [
  'SURVEY_FK',
  'HF',
  'VALUE',
  'Sys_ID',
  'Sys_CommitDateUtc',
  'Sys_IsDeleted',
] as const

interface RunState {
  params: RetrievalParams
  rows: readonly Observation[]
  csv: string
  meta: RetrievalResponseMeta
}

export function RetrievalApiPage() {
  const [params, setParams] = useState<RetrievalParams>({
    ...DEFAULT_RETRIEVAL_PARAMS,
    countries: ['CAN'],
    yearFrom: 2020,
    yearTo: 2022,
    // A page size the opening request actually exceeds — Canada 2020–2022 is
    // ~360 rows — so the paging headers and the `rel="next"` link are visible
    // on arrival rather than asserted. The Annex 3 default stays 100,000 and
    // the field below says so.
    pageSize: 200,
  })
  const [busy, setBusy] = useState(false)
  const [run, setRun] = useState<RunState | null>(null)

  const problems = useMemo(() => retrievalProblems(params), [params])
  const url = useMemo(() => retrievalUrl(params), [params])
  const pairs = useMemo(() => retrievalQueryPairs(params), [params])

  async function send() {
    if (problems.length > 0) return
    setBusy(true)
    const started = performance.now()
    try {
      const page = await mockXMartClient.getObservations({
        countries: params.countries,
        yearFrom: params.yearFrom ?? undefined,
        yearTo: params.yearTo ?? undefined,
        modifiedSince: params.modifiedSince || undefined,
        includeDeleted: params.includeDeleted,
        page: params.page,
        pageSize: params.pageSize,
      })
      const csv = toCsv(page.rows.map(toLongFormat))
      setRun({
        params,
        rows: page.rows,
        csv,
        meta: {
          page: page.page,
          pageSize: page.pageSize,
          totalCount: page.totalCount,
          hasMore: page.hasMore,
          maxCommitDateUtc: page.maxCommitDateUtc,
          durationMs: Math.round(performance.now() - started),
          // The CSV is what would go on the wire, so its own length is the
          // Content-Length rather than an estimate.
          byteLength: new TextEncoder().encode(csv).length,
        },
      })
    } finally {
      setBusy(false)
    }
  }

  const headers = run ? retrievalHeaders(run.params, run.meta) : []

  return (
    <>
      <PageHeader
        title="Data Retrieval API"
        description="Annex 3 — the API xMart calls on DMS to pull data back out. Build a request, send it, and download the CSV it returns."
        actions={
          <Badge variant="secondary" className="font-mono">
            {ANNEX3_MANDATORY_COUNT} of {ANNEX3_MANDATORY_COUNT} mandatory requirements
          </Badge>
        }
      />

      {/* ---- Request builder -------------------------------------------- */}
      <Card className="mb-5 shadow-who-card">
        <CardContent className="p-5">
          <h3 className="mb-4 flex items-center gap-2 text-[length:var(--text-h5)] font-semibold text-who-heading">
            <Wrench className="size-4 text-who-primary-blue" aria-hidden />
            Request
          </h3>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-1.5 lg:col-span-3">
              <Label>Country (business primary key)</Label>
              <CountryPicker
                selected={params.countries}
                onChange={(countries) => setParams({ ...params, countries })}
                placeholder="No filter — return every country"
                ariaLabel="Countries to retrieve"
              />
              <p className="text-[length:var(--text-meta)] text-who-text-muted">
                Leave empty to return all data unfiltered, which Annex 3 requires.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="api-year-from">First year</Label>
              <Input
                id="api-year-from"
                type="number"
                min={FIRST_YEAR}
                max={LAST_YEAR}
                value={params.yearFrom ?? ''}
                placeholder="Any"
                onChange={(e) =>
                  setParams({
                    ...params,
                    yearFrom: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="api-year-to">Last year</Label>
              <Input
                id="api-year-to"
                type="number"
                min={FIRST_YEAR}
                max={LAST_YEAR}
                value={params.yearTo ?? ''}
                placeholder="Any"
                onChange={(e) =>
                  setParams({
                    ...params,
                    yearTo: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="api-modified">modifiedSince (UTC)</Label>
              <Input
                id="api-modified"
                value={params.modifiedSince}
                placeholder="2026-01-01T00:00:00Z"
                onChange={(e) => setParams({ ...params, modifiedSince: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="api-page">Page</Label>
              <Input
                id="api-page"
                type="number"
                min={1}
                value={params.page}
                onChange={(e) => setParams({ ...params, page: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="api-page-size">Page size</Label>
              <Input
                id="api-page-size"
                type="number"
                min={1}
                value={params.pageSize}
                onChange={(e) => setParams({ ...params, pageSize: Number(e.target.value) })}
              />
              <p className="text-[length:var(--text-meta)] text-who-text-muted">
                Annex 3 default is {RETRIEVAL_DEFAULT_PAGE_SIZE.toLocaleString()}; a smaller value
                is set here so paging is visible.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="api-format">Format</Label>
              <Select
                value={params.format}
                onValueChange={(v) => setParams({ ...params, format: v as RetrievalFormat })}
              >
                <SelectTrigger id="api-format" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (mandated)</SelectItem>
                  <SelectItem value="json">JSON (nice to have)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 lg:col-span-3">
              <Checkbox
                checked={params.includeDeleted}
                onCheckedChange={(v) => setParams({ ...params, includeDeleted: v === true })}
                aria-label="Include soft-deleted records"
              />
              <span className="text-[length:var(--text-body-sm)] text-who-text">
                Include soft-deleted records —{' '}
                <span className="text-who-text-muted">
                  DMS never hard-deletes an observation, so a row removed in the UI stays
                  retrievable and keeps its commit date.
                </span>
              </span>
            </label>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
              Generated request
            </p>
            <pre className="overflow-x-auto rounded border border-who-border bg-who-page-bg p-3 font-mono text-[length:var(--text-meta)] break-all whitespace-pre-wrap text-who-text">
              GET {url}
            </pre>
            <pre className="overflow-x-auto rounded border border-who-border bg-who-page-bg p-3 font-mono text-[length:var(--text-meta)] whitespace-pre-wrap text-who-text-muted">
              {retrievalCurl(params)}
            </pre>
            <p className="text-[length:var(--text-meta)] text-who-hint">
              The bearer token is a placeholder. DMS would issue one through the OAuth 2.0
              client-credentials flow against WHO Entra ID; this prototype has no auth server and
              printing a plausible-looking JWT would imply one.
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={send} disabled={busy || problems.length > 0} className="gap-1.5">
              <Play className="size-4" />
              {busy ? 'Sending…' : 'Send request'}
            </Button>
            {run ? (
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => downloadCsvText(run.csv, 'dms-retrieval-api')}
              >
                <Download className="size-4" />
                Download the CSV ({run.rows.length.toLocaleString()} rows)
              </Button>
            ) : null}
          </div>

          {problems.length > 0 ? (
            <ul className="mt-3 list-none space-y-1">
              {problems.map((p) => (
                <li
                  key={p}
                  className="rounded border border-who-fail/40 bg-who-fail/10 px-3 py-2 text-[length:var(--text-body-sm)] text-who-fail"
                >
                  {p}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1">
            {pairs.map(([k, v]) => (
              <span key={k} className="text-[length:var(--text-meta)]">
                <span className="font-mono text-who-primary-blue">{k}</span>
                <span className="text-who-text-muted"> = {v}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ---- Response ---------------------------------------------------- */}
      {run ? (
        <Card className="mb-5 shadow-who-card">
          <CardContent className="p-5">
            <h3 className="mb-4 flex items-center gap-2 text-[length:var(--text-h5)] font-semibold text-who-heading">
              <FileCode2 className="size-4 text-who-primary-blue" aria-hidden />
              Response
              <Badge variant="secondary">200 OK</Badge>
            </h3>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_1fr]">
              <div>
                <p className="mb-2 text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
                  Headers
                </p>
                <dl className="space-y-1 font-mono text-[length:var(--text-meta)]">
                  {headers.map(([name, value]) => (
                    <div key={name} className="flex gap-2">
                      <dt className="shrink-0 text-who-primary-blue">{name}:</dt>
                      <dd className="min-w-0 break-all text-who-text-muted">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-2 text-[length:var(--text-meta)] text-who-hint">
                  Paging metadata travels in headers, not wrapped around the body — a JSON envelope
                  would defeat Annex 3’s own reason for preferring CSV.
                </p>
              </div>

              <div className="min-w-0">
                <p className="mb-2 text-[length:var(--text-meta)] tracking-wide text-who-text-muted uppercase">
                  Body — first {Math.min(PREVIEW_ROWS, run.rows.length)} of{' '}
                  {run.rows.length.toLocaleString()} rows, {LONG_FORMAT_COLUMNS.length} columns
                </p>
                <div className="overflow-x-auto rounded border border-who-border">
                  <table className="w-full border-collapse font-mono text-[length:var(--text-meta)]">
                    <thead className="border-b border-who-border">
                      <tr>
                        {PREVIEW_COLUMNS.map((c) => (
                          <th
                            key={c}
                            className="px-2 py-1.5 text-left font-semibold whitespace-nowrap text-who-heading"
                          >
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {run.rows.slice(0, PREVIEW_ROWS).map((o) => {
                        const row = toLongFormat(o)
                        return (
                          <tr
                            key={row.Sys_ID as string}
                            className="border-b border-who-border/60 last:border-b-0"
                          >
                            {PREVIEW_COLUMNS.map((c) => (
                              <td
                                key={c}
                                className="px-2 py-1.5 whitespace-nowrap text-who-text-muted"
                              >
                                {row[c] === '' || row[c] == null ? '—' : String(row[c])}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[length:var(--text-meta)] text-who-hint">
                  <span className="font-mono">Sys_ID</span> is the DMS internal identifier Annex 3
                  asks for and <span className="font-mono">Sys_CommitDateUtc</span> is the
                  range-filterable UTC last-modified. Both are columns of the downloaded file.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ---- The checklist ----------------------------------------------- */}
      <Card className="shadow-who-card">
        <CardContent className="p-5">
          <h3 className="mb-1 flex items-center gap-2 text-[length:var(--text-h5)] font-semibold text-who-heading">
            <CheckCircle2 className="size-4 text-who-pass" aria-hidden />
            Annex 3, line by line
          </h3>
          <p className="mb-4 max-w-3xl text-[length:var(--text-body-sm)] text-who-text-muted">
            Every requirement in the annex, how DMS answers it, and whether this prototype
            demonstrates it or commits to it. Two mandatory rows — OAuth 2.0 and HTTPS — are
            server-side properties a browser cannot exhibit, and they say so.
          </p>

          {(['mandatory', 'should-have', 'nice-to-have'] as Annex3Category[]).map((category) => {
            const rows = ANNEX3_REQUIREMENTS.filter((r) => r.category === category)
            if (rows.length === 0) return null
            return (
              <section key={category} className="mb-5 last:mb-0">
                <h4 className="mb-2 text-[length:var(--text-meta)] font-semibold tracking-wide text-who-text-muted uppercase">
                  {ANNEX3_CATEGORY_LABELS[category]} ({rows.length})
                </h4>
                <ul className="list-none space-y-2">
                  {rows.map((r) => (
                    <li
                      key={r.id}
                      className="rounded border border-who-border bg-who-surface p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="max-w-3xl text-[length:var(--text-body-sm)] font-semibold text-who-heading">
                          {r.requirement}
                        </p>
                        <Badge
                          variant={r.evidence === 'demonstrated' ? 'default' : 'outline'}
                          className={cn(
                            r.evidence === 'design' && 'border-who-warn text-who-warn',
                          )}
                        >
                          {r.evidence === 'demonstrated' ? 'Shown here' : 'Design commitment'}
                        </Badge>
                      </div>
                      <p className="mt-1 max-w-4xl text-[length:var(--text-body-sm)] text-who-text-muted">
                        {r.answer}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </CardContent>
      </Card>
    </>
  )
}
