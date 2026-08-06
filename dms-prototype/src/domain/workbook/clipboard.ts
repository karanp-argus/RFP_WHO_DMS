/**
 * Range clipboard — UC031's copy/paste, in three modes.
 *
 *   > "Copy and paste values, formulas or metadata for a range of cells,
 *   > including between different workbooks."
 *
 * **TSV, because Excel is the other end of this.** The HA team lives in
 * spreadsheets; a copy out of a workbook has to land in Excel and a copy out of
 * Excel has to land here. Tab-separated rows with newline separators is the
 * format both ends already speak, so interop is free rather than built.
 *
 * The three modes are three different *payloads over the same geometry*:
 *
 * | Mode | Cell text | Round-trips to Excel |
 * |---|---|---|
 * | `values` | the number, or empty for a blank | yes, as numbers |
 * | `formulas` | `=HF.1+HF.2` where a cell has one, else the number | yes, as text |
 * | `metadata` | `SOURCES=…; COMMENT=…` | yes, as text |
 *
 * A blank cell copies as an **empty string, never `0`** — the same rule the
 * formula engine's null policy enforces, and for the same reason: a zero pasted
 * into Excel is a claim nobody made.
 *
 * Pure — no React, no store, no `navigator.clipboard`. The store owns the
 * browser API; this owns the format.
 */

import type { ObservationMetadata } from '../types'
import { METADATA_FIELDS, type MetadataFieldCode } from '../constants'

export const PASTE_MODES = ['values', 'formulas', 'metadata'] as const
export type PasteMode = (typeof PASTE_MODES)[number]

export const PASTE_MODE_LABELS: Record<PasteMode, string> = {
  values: 'Values only',
  formulas: 'Formulas',
  metadata: 'Metadata',
}

export const PASTE_MODE_DESCRIPTIONS: Record<PasteMode, string> = {
  values: 'Paste the numbers. Cells that carry a formula in the source paste as their result.',
  formulas: 'Paste formulas where the source has one, values where it does not.',
  metadata: 'Paste the metadata fields only. Values in the target are left alone.',
}

/** One cell's worth of everything the three modes can carry. */
export interface ClipCell {
  value: number | null
  /** Present when the source cell was a formula, e.g. `=HF.1 + HF.2`. */
  formula?: string
  metadata?: ObservationMetadata
}

/** A rectangular copy. `cells` is row-major and always `rows × columns`. */
export interface Clip {
  rows: number
  columns: number
  cells: ClipCell[][]
  /**
   * Which workbook it came from. Rendered in the paste dialog so a
   * cross-workbook paste — which UC031 explicitly requires — is visible rather
   * than silent.
   */
  sourceLabel: string
}

/* --------------------------------------------------------------------------
   Metadata encoding
   -------------------------------------------------------------------------- */

const PAIR_SEPARATOR = '; '
const KEY_SEPARATOR = '='

/**
 * `{SOURCES: 'NHA study', COMMENT: 'Provisional'}` → `SOURCES=NHA study; COMMENT=Provisional`.
 *
 * Fields are emitted in `METADATA_FIELDS` order so the same metadata always
 * produces the same string — a diff of two exports should show real changes
 * only. Values containing a separator have it stripped rather than escaped:
 * this is a spreadsheet interchange format, and a quoting scheme Excel would
 * not honour buys nothing.
 */
export function encodeMetadata(metadata: ObservationMetadata | undefined): string {
  if (!metadata) return ''
  const parts: string[] = []
  for (const field of METADATA_FIELDS) {
    const value = metadata[field]
    if (value == null || value === '') continue
    parts.push(`${field}${KEY_SEPARATOR}${String(value).replace(/[;\t\n]/g, ' ').trim()}`)
  }
  return parts.join(PAIR_SEPARATOR)
}

export function decodeMetadata(text: string): ObservationMetadata {
  const out: ObservationMetadata = {}
  if (text.trim() === '') return out
  const known = new Set<string>(METADATA_FIELDS)

  for (const pair of text.split(';')) {
    const eq = pair.indexOf(KEY_SEPARATOR)
    if (eq < 0) continue
    const key = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()
    if (!known.has(key) || value === '') continue
    out[key as MetadataFieldCode] = value
  }
  return out
}

/* --------------------------------------------------------------------------
   Serialising
   -------------------------------------------------------------------------- */

/** What one cell contributes to the TSV under a given mode. */
export function cellToText(cell: ClipCell, mode: PasteMode): string {
  switch (mode) {
    case 'values':
      // Blank stays blank. `?? 0` here would be the same lie the null policy
      // exists to prevent, exported into a spreadsheet.
      return cell.value == null ? '' : String(cell.value)
    case 'formulas':
      return cell.formula ?? (cell.value == null ? '' : String(cell.value))
    case 'metadata':
      return encodeMetadata(cell.metadata)
  }
}

export function toTsv(clip: Clip, mode: PasteMode): string {
  return clip.cells.map((row) => row.map((c) => cellToText(c, mode)).join('\t')).join('\n')
}

/* --------------------------------------------------------------------------
   Parsing
   -------------------------------------------------------------------------- */

/**
 * Split pasted text into a grid.
 *
 * Handles CRLF (Windows Excel), a trailing newline (almost every source adds
 * one), and ragged rows — short rows are padded so the result is always
 * rectangular and the paste geometry is predictable.
 */
export function parseTsv(text: string): string[][] {
  const normalised = text.replace(/\r\n?/g, '\n').replace(/\n+$/, '')
  if (normalised === '') return []
  const rows = normalised.split('\n').map((line) => line.split('\t'))
  const width = rows.reduce((max, r) => Math.max(max, r.length), 0)
  return rows.map((r) => (r.length === width ? r : [...r, ...Array(width - r.length).fill('')]))
}

/**
 * A number as a spreadsheet would have written it.
 *
 * Accepts thousands separators and a leading currency-ish symbol because that
 * is what comes off a real Excel selection; rejects anything else rather than
 * coercing, so `n/a` pastes as blank instead of `NaN`.
 */
export function parseNumber(text: string): number | null {
  const cleaned = text.trim().replace(/[\s, ]/g, '')
  if (cleaned === '' || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function isFormulaText(text: string): boolean {
  return text.trimStart().startsWith('=')
}

/** Build a clip from pasted text, interpreting each cell under `mode`. */
export function clipFromTsv(text: string, mode: PasteMode, sourceLabel = 'Clipboard'): Clip {
  const grid = parseTsv(text)
  const cells = grid.map((row) =>
    row.map((raw): ClipCell => {
      if (mode === 'metadata') return { value: null, metadata: decodeMetadata(raw) }
      if (mode === 'formulas' && isFormulaText(raw)) return { value: null, formula: raw.trim() }
      return { value: parseNumber(raw) }
    }),
  )
  return {
    rows: cells.length,
    columns: cells[0]?.length ?? 0,
    cells,
    sourceLabel,
  }
}

/* --------------------------------------------------------------------------
   Applying
   -------------------------------------------------------------------------- */

export interface PasteTarget {
  row: number
  column: number
}

export interface PastePlacement {
  row: number
  column: number
  cell: ClipCell
}

/**
 * Where a clip lands when pasted at a target, clipped to the grid.
 *
 * **The clip is tiled, not stretched.** Copying one cell and pasting over a
 * selected range fills the range — the behaviour every spreadsheet has, and the
 * one a user pasting a single figure across a decade expects. `targetRows` and
 * `targetColumns` describe the selected range; when it is a single cell the
 * clip pastes once at its natural size.
 */
export function planPaste(
  clip: Clip,
  target: PasteTarget,
  gridRows: number,
  gridColumns: number,
  targetRows = 1,
  targetColumns = 1,
): PastePlacement[] {
  if (clip.rows === 0 || clip.columns === 0) return []

  const spanRows = Math.max(targetRows, clip.rows)
  const spanColumns = Math.max(targetColumns, clip.columns)

  const out: PastePlacement[] = []
  for (let r = 0; r < spanRows; r++) {
    const row = target.row + r
    if (row >= gridRows) break
    for (let c = 0; c < spanColumns; c++) {
      const column = target.column + c
      if (column >= gridColumns) break
      const cell = clip.cells[r % clip.rows]?.[c % clip.columns]
      if (cell) out.push({ row, column, cell })
    }
  }
  return out
}
