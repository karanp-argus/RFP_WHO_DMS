/**
 * Annex 3 — the data retrieval API xMart calls on DMS.
 *
 * The annex is a *checklist*, and the plan's instruction for this screen is
 * literal: **"walk the evaluator down the Annex 3 mandatory list on one
 * screen."** So the list itself is data here rather than prose in a component:
 * the page renders every row, states how DMS answers it, and — crucially —
 * says which rows this prototype actually *demonstrates* versus which are
 * design commitments a front-end build cannot show. Overstating that is the
 * one thing that loses a WHO evaluation.
 *
 * The request builder is pure and lives here rather than reusing
 * `data/xmart/apiLog.ts`'s `buildRequestUrl`: that one formats a log line for
 * the Dev drawer, this one is the contract the annex is scored against, and
 * they must be free to differ without one silently changing the other.
 */

/** Where the simulated API is published. HTTPS only — Annex 3 mandates it. */
export const RETRIEVAL_BASE_URL = 'https://dms.who.int/api/v1'
export const RETRIEVAL_RESOURCE = 'observations'

/** Annex 3: "a page size of 100,000" to avoid an excessive number of calls. */
export const RETRIEVAL_DEFAULT_PAGE_SIZE = 100_000
export const RETRIEVAL_MAX_PAGE_SIZE = 250_000

export type RetrievalFormat = 'csv' | 'json'

export interface RetrievalParams {
  /** ISO3 codes. Empty means every country — Annex 3 requires unfiltered pulls. */
  countries: string[]
  yearFrom: number | null
  yearTo: number | null
  /** UTC ISO instant. Annex 3's range-filterable `LastModified`. */
  modifiedSince: string
  /** Annex 3: soft-deleted rows must be retrievable behind a filter. */
  includeDeleted: boolean
  page: number
  pageSize: number
  /** CSV is the mandated output; JSON is the nice-to-have. */
  format: RetrievalFormat
}

export const DEFAULT_RETRIEVAL_PARAMS: RetrievalParams = {
  countries: [],
  yearFrom: null,
  yearTo: null,
  modifiedSince: '',
  includeDeleted: false,
  page: 1,
  pageSize: RETRIEVAL_DEFAULT_PAGE_SIZE,
  format: 'csv',
}

/**
 * The query string, as name/value pairs in a fixed order.
 *
 * Ordered and returned as pairs rather than as an object so the page can show
 * the parameters as a table beside the URL — an evaluator checking "can you
 * filter on the business primary key" is looking for the parameter, not for
 * the string it was concatenated into.
 */
export function retrievalQueryPairs(params: RetrievalParams): [string, string][] {
  const pairs: [string, string][] = []
  if (params.countries.length > 0) pairs.push(['country', params.countries.join(',')])
  if (params.yearFrom != null) pairs.push(['yearFrom', String(params.yearFrom)])
  if (params.yearTo != null) pairs.push(['yearTo', String(params.yearTo)])
  if (params.modifiedSince) pairs.push(['modifiedSince', params.modifiedSince])
  // Emitted only when true: an absent filter and `includeDeleted=false` mean
  // the same thing, and the shorter URL is the one a reader can check.
  if (params.includeDeleted) pairs.push(['includeDeleted', 'true'])
  pairs.push(['page', String(params.page)])
  pairs.push(['pageSize', String(params.pageSize)])
  pairs.push(['format', params.format])
  return pairs
}

export function retrievalUrl(
  params: RetrievalParams,
  base = RETRIEVAL_BASE_URL,
): string {
  const qs = retrievalQueryPairs(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  return `${base}/${RETRIEVAL_RESOURCE}?${qs}`
}

/**
 * The same request as a `curl` an evaluator can paste.
 *
 * The bearer token is a placeholder and says so — DMS would issue one through
 * the OAuth 2.0 client-credentials flow, and printing a plausible-looking JWT
 * here would imply an auth server this prototype does not have.
 */
export function retrievalCurl(params: RetrievalParams, token = '$ACCESS_TOKEN'): string {
  return [
    `curl -X GET '${retrievalUrl(params)}' \\`,
    `  -H 'Authorization: Bearer ${token}' \\`,
    `  -H 'Accept: ${params.format === 'csv' ? 'text/csv' : 'application/json'}'`,
  ].join('\n')
}

export function retrievalProblems(params: RetrievalParams): string[] {
  const out: string[] = []
  if (params.yearFrom != null && params.yearTo != null && params.yearFrom > params.yearTo) {
    out.push('The first year is after the last year.')
  }
  if (params.page < 1) out.push('Page numbers start at 1.')
  if (params.pageSize < 1) out.push('Page size must be at least 1.')
  if (params.pageSize > RETRIEVAL_MAX_PAGE_SIZE) {
    out.push(`Page size is capped at ${RETRIEVAL_MAX_PAGE_SIZE.toLocaleString()} rows.`)
  }
  if (params.modifiedSince && Number.isNaN(Date.parse(params.modifiedSince))) {
    out.push('modifiedSince must be a UTC timestamp, e.g. 2026-01-01T00:00:00Z.')
  }
  return out
}

/* ==========================================================================
   Response metadata
   ========================================================================== */

export interface RetrievalResponseMeta {
  page: number
  pageSize: number
  totalCount: number
  hasMore: boolean
  /** Max `Sys_CommitDateUtc` in the page — the caller's next `modifiedSince`. */
  maxCommitDateUtc: string | null
  durationMs: number
  byteLength: number
}

/**
 * Response headers the real API would return.
 *
 * Paging metadata goes in headers rather than wrapped around the body because
 * the body is CSV: a JSON envelope carrying `{meta, rows}` would defeat the
 * annex's own reason for preferring CSV — *"1/3 the size of json and by
 * definition tabular"* — and force the caller to parse two formats.
 */
export function retrievalHeaders(
  params: RetrievalParams,
  meta: RetrievalResponseMeta,
): [string, string][] {
  const pageCount = Math.max(1, Math.ceil(meta.totalCount / Math.max(1, meta.pageSize)))
  const headers: [string, string][] = [
    ['Content-Type', params.format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json'],
    ['Content-Length', String(meta.byteLength)],
    ['X-Total-Count', String(meta.totalCount)],
    ['X-Page', String(meta.page)],
    ['X-Page-Size', String(meta.pageSize)],
    ['X-Page-Count', String(pageCount)],
    ['X-Last-Modified-Utc', meta.maxCommitDateUtc ?? '—'],
    ['X-Response-Time-Ms', String(meta.durationMs)],
  ]
  if (meta.hasMore) {
    headers.push([
      'Link',
      `<${retrievalUrl({ ...params, page: meta.page + 1 })}>; rel="next"`,
    ])
  }
  return headers
}

/* ==========================================================================
   The checklist
   ========================================================================== */

export type Annex3Category = 'mandatory' | 'should-have' | 'nice-to-have'

/**
 * How far this prototype goes on a given row.
 *
 * `demonstrated` — you can see it happen on the page, right now.
 * `design`       — a server-side property no front-end build can exhibit; the
 *                  answer states the intended implementation instead.
 */
export type Annex3Evidence = 'demonstrated' | 'design'

export interface Annex3Requirement {
  id: string
  category: Annex3Category
  /** The requirement, close to the annex's own wording. */
  requirement: string
  /** How DMS answers it. */
  answer: string
  evidence: Annex3Evidence
}

export const ANNEX3_REQUIREMENTS: readonly Annex3Requirement[] = [
  {
    id: 'a3-http-get',
    category: 'mandatory',
    requirement: 'The API must be callable over HTTP GET.',
    answer:
      'A single GET on /api/v1/observations. Every filter is a query parameter, so the request is cacheable and reproducible from a URL.',
    evidence: 'demonstrated',
  },
  {
    id: 'a3-csv',
    category: 'mandatory',
    requirement:
      'CSV output — “1/3 the size of json and by definition tabular format”.',
    answer:
      'CSV is the default. Columns are the xMart long format in its own order, so the response round-trips back into the warehouse without a mapping step.',
    evidence: 'demonstrated',
  },
  {
    id: 'a3-pk-filter',
    category: 'mandatory',
    requirement:
      'Filtering on the business primary keys: country code, a single year or a year range.',
    answer:
      'country (repeatable, comma-separated), yearFrom and yearTo. Omitting yearTo gives a single year; omitting both gives the full series.',
    evidence: 'demonstrated',
  },
  {
    id: 'a3-internal-id',
    category: 'mandatory',
    requirement: 'Return the DMS internal identifier for later linking back.',
    answer:
      'Sys_ID is a column of every row, alongside Sys_RowId and the batch identifiers. It is the key the workbook and the version history use.',
    evidence: 'demonstrated',
  },
  {
    id: 'a3-paging',
    category: 'mandatory',
    requirement: 'Paging, with a page size around 100,000 to limit round trips.',
    answer:
      'page and pageSize, defaulting to 100,000 and capped at 250,000. X-Total-Count, X-Page-Count and a Link: rel="next" header tell the caller when to stop.',
    evidence: 'demonstrated',
  },
  {
    id: 'a3-last-modified',
    category: 'mandatory',
    requirement:
      'A UTC LastModified that is range-filterable and reflects updates, inserts and deletes.',
    answer:
      'modifiedSince filters on Sys_CommitDateUtc. An edit in the workbook restamps it, a soft delete restamps it too, and X-Last-Modified-Utc returns the page maximum so the next incremental pull starts exactly where this one ended.',
    evidence: 'demonstrated',
  },
  {
    id: 'a3-unfiltered',
    category: 'mandatory',
    requirement: 'The ability to return all data, unfiltered.',
    answer:
      'Every filter is optional. With none supplied the call returns the whole corpus, paged — roughly 970,000 rows here.',
    evidence: 'demonstrated',
  },
  {
    id: 'a3-soft-delete',
    category: 'mandatory',
    requirement:
      'Retrieval of soft-deleted records, with a filter to include or exclude them.',
    answer:
      'includeDeleted=true adds them; Sys_IsDeleted marks which. DMS never hard-deletes an observation, so a row removed in the UI is still retrievable and still carries its commit date.',
    evidence: 'demonstrated',
  },
  {
    id: 'a3-oauth',
    category: 'mandatory',
    requirement: 'OAuth 2.0 authentication.',
    answer:
      'Client-credentials flow against WHO Entra ID; the access token is presented as a bearer token. The request builder shows the header — this prototype has no auth server, so the token is a placeholder and is labelled as one.',
    evidence: 'design',
  },
  {
    id: 'a3-https',
    category: 'mandatory',
    requirement: 'HTTPS only.',
    answer:
      'The published base URL is https and plain HTTP is not served. Nothing about the payload changes; it is a deployment property.',
    evidence: 'design',
  },
  {
    id: 'a3-streaming',
    category: 'should-have',
    requirement: 'Streaming of large result sets.',
    answer:
      'Chunked transfer encoding, writing rows as they are read rather than buffering the page. This is what makes the UC057 25-million-row figure a memory-flat operation; it cannot be exhibited in a browser prototype.',
    evidence: 'design',
  },
  {
    id: 'a3-json',
    category: 'nice-to-have',
    requirement: 'JSON output as an alternative to CSV.',
    answer:
      'format=json returns the same rows as an array of objects, keyed by the same column names.',
    evidence: 'demonstrated',
  },
  {
    id: 'a3-non-pk-filter',
    category: 'nice-to-have',
    requirement: 'Filtering on fields other than the primary key.',
    answer:
      'The same query surface accepts variable codes and a publishing-status filter. Not exposed on this form, to keep the mandatory rows the thing the page is about.',
    evidence: 'design',
  },
]

export const ANNEX3_MANDATORY_COUNT = ANNEX3_REQUIREMENTS.filter(
  (r) => r.category === 'mandatory',
).length

export const ANNEX3_CATEGORY_LABELS: Record<Annex3Category, string> = {
  mandatory: 'Mandatory',
  'should-have': 'Should have',
  'nice-to-have': 'Nice to have',
}
