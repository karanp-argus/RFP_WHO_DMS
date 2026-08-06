/**
 * Workbook UI state.
 *
 * Three things live here rather than in the page, each for a stated reason:
 *
 *  · **The clipboard**, because UC031 requires copy/paste *"between different
 *    workbooks"*. A clipboard held in the grid's own state would be lost the
 *    moment the user navigated to pick a different selection, which is exactly
 *    the journey the use case describes.
 *  · **The undo stack**, so it survives the grid remounting when a filter chip
 *    changes the selection. An undo history that resets when you narrow the view
 *    is worse than none, because it is silently wrong rather than obviously
 *    absent.
 *  · **The locks map** (UC033), because the lock is a property of the dataset,
 *    not of whoever happens to be looking at it.
 *
 * Observation *data* is not here. Edits are written straight through to the
 * `db.ts` overlay so the mock client serves them to every consumer; this store
 * only holds what the overlay cannot express.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyEdit, getEdit, revertEdit } from '@/data/db'
import type { Scale } from '@/domain/constants'
import {
  emptyUndoState,
  pushCommand,
  redo as redoStep,
  undo as undoStep,
  type CellChange,
  type CellSnapshot,
  type Clip,
  type Command,
  type PasteMode,
  type UndoState,
} from '@/domain/workbook'

/** UC033 — who is holding a country's data open, in the simulated second session. */
export interface LockInfo {
  iso3: string
  heldBy: string
  sinceUtc: string
}

interface WorkbookState {
  /* --- clipboard (UC031) --- */
  clip: Clip | null
  pasteMode: PasteMode
  setClip: (clip: Clip | null) => void
  setPasteMode: (mode: PasteMode) => void

  /* --- undo/redo --- */
  undoState: UndoState
  /** Apply a set of changes and record them as one undoable command. */
  commit: (label: string, changes: CellChange[]) => void
  undo: () => Command | null
  redo: () => Command | null

  /* --- dirty tracking for Save → xMart (UC046) --- */
  dirtyKeys: string[]
  markClean: () => void

  /* --- presentation --- */
  scale: Scale
  setScale: (scale: Scale) => void
  showCodes: boolean
  toggleShowCodes: () => void

  /**
   * UC034 (bonus) — the user's metadata field order in the drawer.
   * Persisted, because "reorder the fields" is worth nothing if it resets.
   */
  metadataFieldOrder: string[]
  setMetadataFieldOrder: (order: string[]) => void

  /* --- locking (UC033) --- */
  locks: LockInfo[]
  lockFor: (iso3: string) => LockInfo | undefined
  setSimulatedLock: (iso3: string, heldBy: string | null) => void
}

/**
 * Write one snapshot through to the overlay.
 *
 * A snapshot with every field absent means "this observation had no edit at
 * all" — the state before the very first change — so undoing back to it must
 * *remove* the overlay entry rather than write an empty one. Writing an empty
 * edit would leave the observation looking modified in the API log and in
 * Annex 3's `modifiedSince` filter, which is a lie about provenance.
 */
function applySnapshot(observationKey: string, snapshot: CellSnapshot, authorId: string): void {
  const touchesNothing =
    snapshot.value === undefined &&
    snapshot.formula === undefined &&
    snapshot.metadata === undefined &&
    snapshot.publishingStatus === undefined

  if (touchesNothing) {
    revertEdit(observationKey)
    return
  }

  applyEdit({
    observationKey,
    ...(snapshot.value !== undefined ? { value: snapshot.value } : {}),
    ...(snapshot.formula !== undefined ? { formula: snapshot.formula } : {}),
    ...(snapshot.metadata !== undefined ? { metadata: snapshot.metadata } : {}),
    ...(snapshot.publishingStatus !== undefined
      ? { publishingStatus: snapshot.publishingStatus }
      : {}),
    authorId,
  })
}

/**
 * The current overlay state of one observation, as an undoable snapshot.
 *
 * An observation with **no** overlay entry returns `{}` — and that empty
 * snapshot is meaningful, not a missing value: it is what undo restores to in
 * order to remove the edit entirely and leave the observation reading as
 * unmodified. Every command records one of these as its `before`.
 */
export function currentSnapshot(observationKey: string): CellSnapshot {
  const edit = getEdit(observationKey)
  if (!edit) return {}
  const snapshot: CellSnapshot = {}
  if ('value' in edit) snapshot.value = edit.value ?? null
  if ('formula' in edit) snapshot.formula = edit.formula ?? null
  if (edit.metadata) snapshot.metadata = edit.metadata
  if (edit.publishingStatus) snapshot.publishingStatus = edit.publishingStatus
  return snapshot
}

/**
 * Author of record for overlay writes made by the store.
 *
 * Set once at sign-in rather than read from `authStore` here, because a domain-
 * adjacent store importing an auth store would make both harder to test and
 * would create the only import cycle in the app.
 */
let currentAuthorId = 'unknown'
export function setWorkbookAuthor(authorId: string): void {
  currentAuthorId = authorId
}

export const useWorkbookStore = create<WorkbookState>()(
  persist(
    (set, get) => ({
      clip: null,
      pasteMode: 'values',
      setClip: (clip) => set({ clip }),
      setPasteMode: (pasteMode) => set({ pasteMode }),

      undoState: emptyUndoState(),

      commit: (label, changes) => {
        if (changes.length === 0) return
        for (const change of changes) {
          applySnapshot(change.observationKey, change.after, currentAuthorId)
        }
        set((s) => ({
          undoState: pushCommand(s.undoState, { label, changes }),
          dirtyKeys: [...new Set([...s.dirtyKeys, ...changes.map((c) => c.observationKey)])],
        }))
      },

      undo: () => {
        const step = undoStep(get().undoState)
        if (!step) return null
        for (const { observationKey, snapshot } of step.apply) {
          applySnapshot(observationKey, snapshot, currentAuthorId)
        }
        set({ undoState: step.state })
        return step.command
      },

      redo: () => {
        const step = redoStep(get().undoState)
        if (!step) return null
        for (const { observationKey, snapshot } of step.apply) {
          applySnapshot(observationKey, snapshot, currentAuthorId)
        }
        set((s) => ({
          undoState: step.state,
          dirtyKeys: [...new Set([...s.dirtyKeys, ...step.apply.map((a) => a.observationKey)])],
        }))
        return step.command
      },

      dirtyKeys: [],
      markClean: () => set({ dirtyKeys: [] }),

      scale: 'millions',
      setScale: (scale) => set({ scale }),
      showCodes: true,
      toggleShowCodes: () => set((s) => ({ showCodes: !s.showCodes })),

      metadataFieldOrder: [],
      setMetadataFieldOrder: (metadataFieldOrder) => set({ metadataFieldOrder }),

      locks: [],
      lockFor: (iso3) => get().locks.find((l) => l.iso3 === iso3),
      setSimulatedLock: (iso3, heldBy) =>
        set((s) => ({
          locks:
            heldBy == null
              ? s.locks.filter((l) => l.iso3 !== iso3)
              : [
                  ...s.locks.filter((l) => l.iso3 !== iso3),
                  { iso3, heldBy, sinceUtc: new Date().toISOString() },
                ],
        })),
    }),
    {
      name: 'dms-workbook',
      /**
       * Only the display preferences survive a reload.
       *
       * The clipboard and the undo stack are session state: restoring an undo
       * history whose commands describe overlay entries that "Reset demo data"
       * may since have cleared would let a presenter undo their way into a
       * state that never existed. The locks are simulated and should start
       * clear so a demo opens unblocked.
       */
      partialize: (s) => ({
        scale: s.scale,
        showCodes: s.showCodes,
        pasteMode: s.pasteMode,
        metadataFieldOrder: s.metadataFieldOrder,
      }),
    },
  ),
)
