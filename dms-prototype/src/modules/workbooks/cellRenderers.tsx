/**
 * Workbook cell rendering — six states, both themes.
 *
 * The colour semantics are lifted from the legacy DMS screenshots and are
 * deliberately untouched (plan §2.4 Decision 1): **blue is country-reported,
 * pink is a calculated indicator.** That is years of muscle memory for the HA
 * team and the one thing this rebuild does not get to improve. What the dark
 * theme changes is the values behind `--who-cell-value` and
 * `--who-cell-indicator`, never the meaning — so every colour here is a token,
 * as CLAUDE.md requires.
 *
 * The six states, and where each comes from:
 *
 * | State | Source | Treatment |
 * |---|---|---|
 * | reported value | country submission | plain, on `who-cell-value` |
 * | calculated indicator | formula engine | `who-cell-indicator` row tint, read-only |
 * | formula cell | UC031 — *"cells containing formulas with a different format (color, italic)"* | `who-cell-formula`, italic |
 * | publishing status | UC024 | corner marker, top-right |
 * | metadata present | §2.4 — replaces the legacy metadata sheet tab | dot marker, bottom-left, clickable |
 * | QC failure | UC052 | red ring for an error, amber for a warning |
 *
 * A blank renders as an em dash and **never as 0** — the formula engine goes to
 * some trouble to keep the two apart (`domain/formula/nullPolicy.ts`) and the
 * last renderer in the chain is exactly where that gets quietly undone.
 */

import { useEffect, useRef, useState } from 'react'

import { SCALE_DIVISORS } from '@/domain/constants'
import { BLANK } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useWorkbookGrid } from './gridContext'

/** The row shape `react-datasheet-grid` holds — one per grid row. */
export interface DsgRow {
  rowKey: string
  label: string
  code: string
  isCalculated: boolean
  /** Column key → the text in that cell. Rebuilt from the data on every load. */
  cells: Record<string, string>
}

/* --------------------------------------------------------------------------
   Value formatting
   -------------------------------------------------------------------------- */

/**
 * Values are held in NCU millions and displayed at the chosen scale.
 *
 * The legacy screenshot's scale selector defaults to "Millions (Default)", so
 * the identity case is the default and anything else divides — which is why the
 * divisor is relative to `millions` rather than to units.
 */
export function scaleValue(value: number | null, scale: keyof typeof SCALE_DIVISORS): number | null {
  if (value == null) return null
  const divisor = SCALE_DIVISORS[scale] / SCALE_DIVISORS.millions
  return value / divisor
}

export function formatCellValue(
  value: number | null,
  scale: keyof typeof SCALE_DIVISORS,
): string {
  const scaled = scaleValue(value, scale)
  if (scaled == null) return BLANK
  const magnitude = Math.abs(scaled)
  const decimals = magnitude >= 1000 ? 0 : magnitude >= 10 ? 1 : 2
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(scaled)
}

/* --------------------------------------------------------------------------
   The cell
   -------------------------------------------------------------------------- */

export interface WorkbookCellProps {
  rowData: DsgRow
  columnData: { columnKey: string }
  focus: boolean
  active: boolean
  setRowData: (row: DsgRow) => void
  stopEditing: (opts?: { nextRow?: boolean }) => void
}

export function WorkbookCellComponent({
  rowData,
  columnData,
  focus,
  setRowData,
  stopEditing,
}: WorkbookCellProps) {
  const { getCell, scale, editable, findingFor, onOpenMetadata, onOpenVersions } =
    useWorkbookGrid()
  const columnKey = columnData.columnKey
  const cell = getCell(rowData.rowKey, columnKey)
  const finding = cell ? findingFor(cell.observationKey) : undefined

  const inputRef = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState('')

  // Entering edit mode seeds the input with the formula when there is one, so
  // editing a formula cell shows the formula rather than its result — UC031.
  useEffect(() => {
    if (!focus) return
    const stored = rowData.cells[columnKey] ?? ''
    setDraft(stored)
    // Select-all on entry, so typing replaces as it does in a spreadsheet.
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [focus, rowData.cells, columnKey])

  if (!cell) return <div className="size-full" />

  const readOnly = !editable || cell.isCalculated

  if (focus && !readOnly) {
    return (
      <input
        ref={inputRef}
        className="size-full border-0 bg-who-surface px-2 text-right font-mono text-[length:var(--text-body-sm)] tabular-nums outline-none"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setRowData({ ...rowData, cells: { ...rowData.cells, [columnKey]: draft } })
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setRowData({ ...rowData, cells: { ...rowData.cells, [columnKey]: draft } })
            stopEditing({ nextRow: true })
          }
          if (e.key === 'Escape') stopEditing({ nextRow: false })
        }}
      />
    )
  }

  const isFormulaCell = cell.formula != null && !cell.isCalculated

  return (
    <div
      className={cn(
        'relative flex size-full items-center justify-end px-2 font-mono text-[length:var(--text-body-sm)] tabular-nums',
        // Blue = reported, pink = calculated. The legacy semantics, kept.
        cell.isCalculated ? 'bg-who-cell-indicator' : 'bg-who-cell-value',
        // UC031: a formula cell reads differently — colour and italic.
        isFormulaCell && 'text-who-cell-formula italic',
        cell.value == null && 'text-who-text-muted',
        // UC052 — QC findings ring the offending cell.
        finding?.severity === 'error' && 'ring-2 ring-who-fail ring-inset',
        finding?.severity === 'warning' && 'ring-2 ring-who-warn ring-inset',
      )}
      title={finding?.message}
      onContextMenu={(e) => {
        // UC043/UC044 — right-click opens the version history for this
        // observation. Preventing the browser menu is the whole point: the
        // alternative is a column of "history" buttons eating grid width.
        e.preventDefault()
        onOpenVersions(rowData.rowKey, columnKey)
      }}
    >
      {/* UC024 — publishing status as a corner marker, not a column. */}
      {cell.publishingStatus === 'ready-to-publish' ? (
        <span
          aria-label="Ready to publish"
          className="absolute top-0 right-0 size-0 border-t-[6px] border-l-[6px] border-t-who-pass border-l-transparent"
        />
      ) : null}

      {/* §2.4 — the marker that replaces the legacy metadata sheet tab.
          A corner triangle rather than an icon: over half the corpus carries
          metadata, and an icon on every second cell is noise that stops being
          read. It mirrors the status marker's shape so the two read as one
          family of corner flags. */}
      {cell.hasMetadata ? (
        <button
          type="button"
          aria-label="Open metadata"
          title="Has metadata — click to open"
          onMouseDown={(e) => {
            // mousedown, not click: DSG commits and moves the active cell on
            // click, which would close the drawer we are about to open.
            e.stopPropagation()
            e.preventDefault()
            onOpenMetadata(rowData.rowKey, columnKey)
          }}
          className="absolute bottom-0 left-0 size-0 border-r-[6px] border-b-[6px] border-r-transparent border-b-who-primary-blue opacity-60 hover:opacity-100"
        />
      ) : null}

      {/* An unsaved edit is visible until Save → xMart clears it (UC046). */}
      {cell.isEdited ? (
        <span
          aria-label="Edited, not yet saved"
          className="absolute top-0 left-0 size-1.5 rounded-full bg-who-primary-blue"
        />
      ) : null}

      <span className="truncate">
        {isFormulaCell ? cell.formula : formatCellValue(cell.value, scale)}
      </span>
    </div>
  )
}

/* --------------------------------------------------------------------------
   The frozen label column
   -------------------------------------------------------------------------- */

/**
 * The left gutter: variable label over its code.
 *
 * This is `react-datasheet-grid`'s `gutterColumn`, which is the one slot it
 * makes `position: sticky; left: 0`. Widening it and giving it real content is
 * how the workbook gets a frozen label column without a second synchronised
 * grid — the fallback the plan had reserved and which turned out not to be
 * needed.
 */
export function RowHeaderComponent({ rowData }: { rowData: DsgRow }) {
  const { showCodes } = useWorkbookGrid()

  return (
    <div
      className={cn(
        'flex size-full flex-col justify-center overflow-hidden px-2 text-left',
        rowData.isCalculated ? 'bg-who-cell-indicator' : 'bg-who-surface',
      )}
    >
      <span
        className={cn(
          'truncate text-[length:var(--text-meta)] leading-tight',
          rowData.isCalculated ? 'font-semibold text-who-heading' : 'text-who-text',
        )}
        title={rowData.label}
      >
        {rowData.label}
      </span>
      {showCodes ? (
        <span className="truncate font-mono text-[length:var(--text-meta)] leading-tight text-who-text-muted">
          {rowData.code}
        </span>
      ) : null}
    </div>
  )
}
