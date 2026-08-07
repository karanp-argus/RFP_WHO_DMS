/**
 * The To-Be data architecture (UC045, UC046, UC056).
 *
 * Plan §1.1's architectural takeaway is the thing this describes: **DMS owns no
 * master data.** xMart is the warehouse; country submissions land there through
 * their existing channels, DMS pulls the slice it needs (UC045) and pushes
 * edits back (UC046), and everything downstream reads xMart rather than DMS.
 * UC056 is why the direction matters — *"the development has to be done in
 * xMart"*, so a DMS that held its own copy would be the wrong shape however
 * well it worked.
 *
 * Held as data so the page can render it as a live diagram rather than an
 * image: an image goes stale the first time the flow changes and nobody
 * notices, and this one is also what the sync table is keyed on.
 */

import type { SourceFormat } from '@/domain/constants'

export type NodeKind = 'source' | 'warehouse' | 'dms' | 'consumer'

export interface ArchitectureNode {
  id: string
  label: string
  kind: NodeKind
  /** One line, shown under the label. */
  detail: string
}

export interface ArchitectureFlow {
  from: string
  to: string
  label: string
  /** The use case this edge realises; blank for edges outside DMS's scope. */
  useCase: string
  /** Edges DMS itself performs, as opposed to ones that already exist. */
  isDms: boolean
}

export const ARCHITECTURE_NODES: readonly ArchitectureNode[] = [
  {
    id: 'countries',
    label: 'Member States',
    kind: 'source',
    detail: 'JHAQ, HAQ, mini questionnaire and HAPT cross tables',
  },
  {
    id: 'agencies',
    label: 'WB / IMF / UN',
    kind: 'source',
    detail: 'GDP, government expenditure, population, exchange rates',
  },
  {
    id: 'xmart',
    label: 'xMart',
    kind: 'warehouse',
    detail: 'The warehouse. Master data, load batches, system columns, history',
  },
  {
    id: 'dms',
    label: 'Health Accounts DMS',
    kind: 'dms',
    detail: 'Workbooks, formulas, quality checks, reports',
  },
  {
    id: 'publications',
    label: 'GHED and publications',
    kind: 'consumer',
    detail: 'Global Health Expenditure Database and downstream reporting',
  },
]

export const ARCHITECTURE_FLOWS: readonly ArchitectureFlow[] = [
  {
    from: 'countries',
    to: 'xmart',
    label: 'Submissions via eDamis, OneDrive and the HAPT API',
    useCase: '',
    isDms: false,
  },
  {
    from: 'agencies',
    to: 'xmart',
    label: 'Macroeconomic series loaded on a published schedule',
    useCase: '',
    isDms: false,
  },
  {
    from: 'xmart',
    to: 'dms',
    label: 'Configuration and observations pulled on demand',
    useCase: 'UC045',
    isDms: true,
  },
  {
    from: 'dms',
    to: 'xmart',
    label: 'Edits pushed back with the author’s user id',
    useCase: 'UC046',
    isDms: true,
  },
  {
    from: 'xmart',
    to: 'publications',
    label: 'Published series read from the warehouse, never from DMS',
    useCase: 'UC056',
    isDms: false,
  },
]

/* ==========================================================================
   Per-source sync status
   ========================================================================== */

export interface SyncSource {
  id: string
  label: string
  /** How the data arrives. */
  channel: string
  /** The submission format, where one applies. */
  format: SourceFormat | null
  /** Expected cadence, for the "is this late?" judgement. */
  cadence: string
  /** Days after which a missed sync is worth flagging. */
  staleAfterDays: number
  detail: string
}

export const SYNC_SOURCES: readonly SyncSource[] = [
  {
    id: 'edamis',
    label: 'eDamis',
    channel: 'SFTP drop, polled by xMart',
    format: 'JHAQ',
    cadence: 'Continuous during the reporting round',
    staleAfterDays: 7,
    detail: 'The primary channel for the Joint Health Accounts Questionnaire.',
  },
  {
    id: 'onedrive',
    label: 'OneDrive shared folder',
    channel: 'Watched folder',
    format: 'HAQ',
    cadence: 'Ad hoc',
    staleAfterDays: 30,
    detail: 'Questionnaires and MET files sent directly to the HA team (UC028).',
  },
  {
    id: 'hapt',
    label: 'HAPT',
    channel: 'REST API',
    format: 'HAPT',
    cadence: 'Nightly',
    staleAfterDays: 3,
    detail: 'Cross tables produced by the Health Accounts Production Tool.',
  },
  {
    id: 'longformat',
    label: 'Manual long-format upload',
    channel: 'Upload through DMS Setup',
    format: 'LongFormat',
    cadence: 'Ad hoc',
    staleAfterDays: 60,
    detail: 'Corrections and back-series loaded by the team itself.',
  },
  {
    id: 'macro',
    label: 'World Bank / IMF / UN',
    channel: 'Scheduled xMart load',
    format: null,
    cadence: 'Quarterly',
    staleAfterDays: 120,
    detail: 'GDP, general government expenditure, population and exchange rates.',
  },
]

export type SyncHealth = 'ok' | 'stale' | 'failed'

export interface SyncStatus {
  source: SyncSource
  lastSyncUtc: string
  rowCount: number
  health: SyncHealth
  /** Whole days since the last successful sync. */
  ageDays: number
  note: string
}

/**
 * Classify a sync against its own cadence.
 *
 * Pure so the "stale" judgement is one rule rather than a colour chosen per
 * row: a nightly API silent for four days is late, a quarterly macro load
 * silent for four days is not, and a single threshold would be wrong for one
 * of them.
 */
export function syncHealth(source: SyncSource, ageDays: number, failed: boolean): SyncHealth {
  if (failed) return 'failed'
  return ageDays > source.staleAfterDays ? 'stale' : 'ok'
}
