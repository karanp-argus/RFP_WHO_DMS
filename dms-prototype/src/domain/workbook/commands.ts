/**
 * The undo/redo command stack.
 *
 * A **bounded** stack of reversible commands, each carrying the before and
 * after state of every observation it touched. Reversible-by-snapshot rather
 * than reversible-by-inverse-operation: a workbook edit can change a value, a
 * formula, five metadata fields and a publishing status at once, and computing
 * an inverse for each of those is more code and more ways to be subtly wrong
 * than simply remembering what was there.
 *
 * Bounded at `UNDO_LIMIT` because this is a data-entry surface a presenter may
 * hammer: an unbounded stack that accumulates every paste of a 25×60 range is a
 * memory leak with a friendly name.
 *
 * Pure — no React, no store. The store applies what `undo`/`redo` hand back.
 */

import type { PublishingStatus } from '../constants'
import type { ObservationMetadata } from '../types'

/** Everything about one observation that a workbook edit can change. */
export interface CellSnapshot {
  value?: number | null
  /** `null` means "the formula was removed", absent means "not touched". */
  formula?: string | null
  metadata?: ObservationMetadata
  publishingStatus?: PublishingStatus
}

export interface CellChange {
  observationKey: string
  before: CellSnapshot
  after: CellSnapshot
}

export interface Command {
  /** Shown on the undo button's tooltip: "Undo paste of 48 cells". */
  label: string
  changes: CellChange[]
}

export interface UndoState {
  past: Command[]
  future: Command[]
}

/** Deep enough for a demo to be forgiving, shallow enough to stay bounded. */
export const UNDO_LIMIT = 50

export function emptyUndoState(): UndoState {
  return { past: [], future: [] }
}

/**
 * Record a command.
 *
 * Pushing **clears the redo stack**, which is the standard rule: once you edit
 * after undoing, the branch you undid is gone. Doing anything else produces a
 * tree, and a tree needs a UI nobody asked for.
 */
export function pushCommand(state: UndoState, command: Command, limit = UNDO_LIMIT): UndoState {
  if (command.changes.length === 0) return state
  const past = [...state.past, command]
  return {
    past: past.length > limit ? past.slice(past.length - limit) : past,
    future: [],
  }
}

export interface StepResult {
  state: UndoState
  /** The snapshots to apply, already oriented in the direction of travel. */
  apply: { observationKey: string; snapshot: CellSnapshot }[]
  command: Command
}

export function canUndo(state: UndoState): boolean {
  return state.past.length > 0
}

export function canRedo(state: UndoState): boolean {
  return state.future.length > 0
}

export function undo(state: UndoState): StepResult | null {
  const command = state.past[state.past.length - 1]
  if (!command) return null
  return {
    state: { past: state.past.slice(0, -1), future: [command, ...state.future] },
    apply: command.changes.map((c) => ({ observationKey: c.observationKey, snapshot: c.before })),
    command,
  }
}

export function redo(state: UndoState): StepResult | null {
  const command = state.future[0]
  if (!command) return null
  return {
    state: { past: [...state.past, command], future: state.future.slice(1) },
    apply: command.changes.map((c) => ({ observationKey: c.observationKey, snapshot: c.after })),
    command,
  }
}

/** "48 cells" / "1 cell" — used to build command labels consistently. */
export function pluralCells(n: number): string {
  return `${n} cell${n === 1 ? '' : 's'}`
}
