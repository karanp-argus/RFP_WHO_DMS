/**
 * The local overlay.
 *
 * Seeded observations are *derived* rather than stored (see
 * `generators/observations.ts`), so there is nothing to persist for them. What
 * does need persisting is the far smaller set of things a user changed during a
 * demo: edited values, formulas, metadata, publishing status, soft deletes.
 *
 * That split is what keeps `localStorage` viable. Persisting ~970,000 derivable
 * observations would blow the 5 MB quota many times over; persisting a few dozen
 * edits costs kilobytes, survives a reload, and makes "Reset demo data"
 * instantaneous — it just clears the overlay.
 */

import { DEMO_NOW, type PublishingStatus } from '@/domain/constants'
import type { ObservationMetadata } from '@/domain/types'

const STORAGE_KEY = 'dms-data'
const SCHEMA_VERSION = 1

/** A user edit layered over the derived value for one observation. */
export interface ObservationEdit {
  observationKey: string
  /** Present if the value was changed. `null` means explicitly cleared. */
  value?: number | null
  /** Present if a formula was set. `null` means the formula was removed. */
  formula?: string | null
  metadata?: ObservationMetadata
  publishingStatus?: PublishingStatus
  isDeleted?: boolean
  /** UC046 — carried to xMart with the change. */
  authorId: string
  editedUtc: string
}

interface Overlay {
  schemaVersion: number
  /** Keyed by observation key. */
  edits: Record<string, ObservationEdit>
  /** Batch id assigned to the next push, so ids advance across a session. */
  nextBatchId: number
}

function emptyOverlay(): Overlay {
  return { schemaVersion: SCHEMA_VERSION, edits: {}, nextBatchId: 890_001 }
}

function load(): Overlay {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyOverlay()
    const parsed = JSON.parse(raw) as Overlay
    // A schema bump discards rather than migrates: this is demo state, and a
    // silent half-migration would be worse than a clean slate.
    if (parsed.schemaVersion !== SCHEMA_VERSION) return emptyOverlay()
    return { ...emptyOverlay(), ...parsed }
  } catch {
    return emptyOverlay()
  }
}

let overlay: Overlay = load()

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay))
  } catch {
    // Quota or private-mode failure must never break the demo — the session
    // continues in memory and simply does not survive a reload.
  }
}

/* ==========================================================================
   Reads
   ========================================================================== */

export function getEdit(observationKey: string): ObservationEdit | undefined {
  return overlay.edits[observationKey]
}

export function getAllEdits(): readonly ObservationEdit[] {
  return Object.values(overlay.edits)
}

export function editCount(): number {
  return Object.keys(overlay.edits).length
}

/** Keys of everything edited in this session, for the dirty-state indicator. */
export function editedKeys(): readonly string[] {
  return Object.keys(overlay.edits)
}

/* ==========================================================================
   Writes
   ========================================================================== */

/**
 * Layer an edit over the derived value. Merges with any existing edit for the
 * same observation so successive changes accumulate rather than replace.
 */
export function applyEdit(edit: Omit<ObservationEdit, 'editedUtc'>): ObservationEdit {
  const existing = overlay.edits[edit.observationKey]
  const merged: ObservationEdit = {
    ...existing,
    ...edit,
    metadata: { ...existing?.metadata, ...edit.metadata },
    editedUtc: new Date(DEMO_NOW.getTime()).toISOString(),
  }
  overlay.edits[edit.observationKey] = merged
  persist()
  return merged
}

export function applyEdits(edits: readonly Omit<ObservationEdit, 'editedUtc'>[]): void {
  for (const e of edits) {
    const existing = overlay.edits[e.observationKey]
    overlay.edits[e.observationKey] = {
      ...existing,
      ...e,
      metadata: { ...existing?.metadata, ...e.metadata },
      editedUtc: new Date(DEMO_NOW.getTime()).toISOString(),
    }
  }
  persist()
}

/** Drop one edit, reverting the observation to its derived value. */
export function revertEdit(observationKey: string): void {
  delete overlay.edits[observationKey]
  persist()
}

export function nextBatchId(): number {
  const id = overlay.nextBatchId
  overlay.nextBatchId = id + 1
  persist()
  return id
}

/**
 * Clear all local state. Backs the header's "Reset demo data" action — because
 * the seed is derived, this is a full reset to pristine with no regeneration.
 */
export function resetDemoData(): void {
  overlay = emptyOverlay()
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore — in-memory reset above is what matters.
  }
}

export { STORAGE_KEY as DB_STORAGE_KEY }
