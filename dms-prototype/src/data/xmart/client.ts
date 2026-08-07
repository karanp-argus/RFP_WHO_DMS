/**
 * The xMart client interface — THE swap point.
 *
 * DMS owns no master data (plan §1.1): xMart is the warehouse, DMS pulls what it
 * needs across an API (UC045) and pushes changes back (UC046). Every module in
 * the app talks to this interface and nothing else; no page reads `db.ts` or a
 * seed file directly. When xMart is real, one implementation is swapped and the
 * application above it does not change.
 *
 * Types only — no implementation, so `mockClient` and a future `httpClient` are
 * interchangeable.
 */

import type { SyncStatus } from '@/domain/integration'
import type {
  Classification,
  Country,
  Cross,
  Currency,
  DmsUser,
  Formula,
  ImportBatch,
  MetadataFieldDef,
  Observation,
  ObservationVersion,
  ReportingContact,
  Variable,
} from '@/domain/types'

/* ==========================================================================
   QUERIES
   ========================================================================== */

/**
 * An observation query.
 *
 * The filter set is deliberately the one Annex 3 mandates: business primary keys
 * (country code, single year or range), a UTC `modifiedSince` for incremental
 * pulls, soft-delete inclusion, and paging with a large page size.
 */
export interface ObservationQuery {
  /** ISO3 codes. Empty or omitted means all — Annex 3: "must be possible to return all data". */
  countries?: readonly string[]
  /** Explicit years, or use `yearFrom`/`yearTo` for a range. */
  years?: readonly number[]
  yearFrom?: number
  yearTo?: number
  /** Variable codes for single-dimension observations. */
  variables?: readonly string[]
  /** Cross codes (`HC.1xHF.1`) to include alongside `variables`. */
  crosses?: readonly string[]
  /** Annex 3: range-filterable UTC last-modified. ISO string. */
  modifiedSince?: string
  /** Annex 3: "indicate the exclusion or inclusion of soft-deleted records". */
  includeDeleted?: boolean
  /** 1-based. Annex 3 recommends a large page size, default 100,000. */
  page?: number
  pageSize?: number
}

export interface ObservationPage {
  rows: readonly Observation[]
  page: number
  pageSize: number
  /** Total matching rows before paging. */
  totalCount: number
  hasMore: boolean
  /** Max `Sys_CommitDateUtc` in this page, for incremental pull bookkeeping. */
  maxCommitDateUtc: string | null
}

/* ==========================================================================
   WRITES
   ========================================================================== */

/**
 * One change DMS pushes back to xMart.
 *
 * UC046: the payload "will include, among other data, the user id of the author"
 * and must transmit "values from workbooks as values, and formulas as formulas".
 */
export interface ObservationChange {
  observationKey: string
  value?: number | null
  formula?: string | null
  metadata?: Record<string, string>
  publishingStatus?: 'not-publish' | 'ready-to-publish'
  /** Soft delete only — Annex 3 requires deleted rows to remain retrievable. */
  isDeleted?: boolean
  /** UC046 — author of the change. */
  authorId: string
}

export interface PutResult {
  accepted: number
  rejected: number
  /** Batch id xMart assigned, echoed back for the API log. */
  batchId: number
  commitDateUtc: string
  errors: readonly { observationKey: string; reason: string }[]
}

/* ==========================================================================
   DATASET-LEVEL RESTORE (UC044)
   ========================================================================== */

/**
 * One observation that stood at a different value on a past date.
 *
 * UC044's last clause — *"an administrator can restore a whole dataset as of a
 * date"* — is a bulk as-of query, not a loop over the per-observation restore
 * the workbook already offers. Doing it per key would be thousands of round
 * trips against a real warehouse, so the interface exposes the shape the
 * operation actually needs.
 */
export interface DatasetAsOfChange {
  observationKey: string
  iso3: string
  year: number
  /** Variable or cross code, for the preview table. */
  code: string
  currentValue: number | null
  asOfValue: number | null
  /** Commit stamp of the version that was current on the as-of date. */
  asOfCommitDateUtc: string
  asOfAuthor: string
}

export interface DatasetAsOfResult {
  asOfUtc: string
  /** Observations examined. */
  scanned: number
  /** Of those, how many carry any version history at all. */
  withHistory: number
  /** Only the ones whose as-of value differs from the current one. */
  changes: readonly DatasetAsOfChange[]
  /** True when the scan hit its budget before finishing the requested slice. */
  truncated: boolean
}

/**
 * Ceiling on a single as-of scan.
 *
 * Every observation in the slice needs its version history rebuilt, which is
 * an order of magnitude more work per row than a plain read. A whole-corpus
 * restore is a warehouse-side job, not something a browser should attempt, and
 * reporting the truncation is more honest than quietly stopping.
 */
export const DATASET_AS_OF_MAX_SCAN = 60_000

/* ==========================================================================
   THE INTERFACE
   ========================================================================== */

export interface XMartClient {
  /* --- Configuration data (UC014: "import all the information related to
     Countries, Currencies, Classifications and Categories, Crosses, Metadata
     and Formulas with all their associated attributes from xMart") --- */
  getCountries(): Promise<readonly Country[]>
  getCurrencies(): Promise<readonly Currency[]>
  getClassifications(): Promise<readonly Classification[]>
  getVariables(): Promise<readonly Variable[]>
  getCrosses(): Promise<readonly Cross[]>
  getFormulas(): Promise<readonly Formula[]>
  getMetadataFields(): Promise<readonly MetadataFieldDef[]>

  /* --- Observations --- */
  getObservations(query: ObservationQuery): Promise<ObservationPage>
  /** UC043/UC044 — up to 10 prior versions of one observation. */
  getVersions(observationKey: string): Promise<readonly ObservationVersion[]>
  /**
   * Prior versions for many observations in one round trip.
   *
   * UC053's *"growth between two data versions"* rule needs the version history
   * of every observation it checks — thousands of them for a regional run. Per
   * key that is thousands of requests, which is not how anybody would build it
   * against a real warehouse, so the interface offers the bulk form the rule
   * actually needs rather than making the caller loop.
   */
  getVersionsBulk(
    observationKeys: readonly string[],
  ): Promise<ReadonlyMap<string, readonly ObservationVersion[]>>
  /**
   * UC044 — what a slice looked like on a past date, and what would change if
   * it were restored. Read-only: applying the result is a `putObservations`.
   */
  getDatasetAsOf(query: ObservationQuery, asOfUtc: string): Promise<DatasetAsOfResult>
  /** UC046 — push DMS edits back to the warehouse. */
  putObservations(changes: readonly ObservationChange[]): Promise<PutResult>

  /* --- Operational metadata --- */
  /** UC039 — import batches, backing the data tracking report. */
  getImportBatches(countries?: readonly string[]): Promise<readonly ImportBatch[]>
  /** UC023 — logged communications with countries. */
  getReportingContacts(): Promise<readonly ReportingContact[]>
  /** UC045/UC056 — per-source load status for the integration page. */
  getSyncStatus(): Promise<readonly SyncStatus[]>
  /** Users are managed in Entra ID; DMS reads and updates its own role mapping. */
  getUsers(): Promise<readonly DmsUser[]>
}

/**
 * Latency band for the mock client, in ms.
 *
 * Not decoration: real xMart calls are not instant, and a prototype that returns
 * synchronously teaches the wrong thing about loading states. Every consumer goes
 * through TanStack Query, so skeletons and error states get exercised.
 */
export const MOCK_LATENCY_MS: [number, number] = [150, 400]

/** Annex 3: "a page size of 100,000" to avoid many round trips. */
export const DEFAULT_PAGE_SIZE = 100_000
