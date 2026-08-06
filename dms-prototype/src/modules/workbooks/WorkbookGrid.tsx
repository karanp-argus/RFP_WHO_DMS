/**
 * The workbook grid.
 *
 * `react-datasheet-grid` over `@tanstack/react-virtual`, configured so all four
 * of plan §2.4's chrome replacements hold:
 *
 *  · **frozen year header row** — DSG's `.dsg-row-header` is `position: sticky`;
 *  · **frozen variable label + code column** — the `gutterColumn`, widened from
 *    its default row-number width and given real content. It is the only slot
 *    DSG makes `position: sticky; left: 0`, which the day-1 spike confirmed
 *    works, so the planned fallback of a second synchronised grid was dropped;
 *  · **frozen corner** — the gutter's own header slot;
 *  · **virtualised continuous scroll** — no pagination on a data-entry surface,
 *    because paging breaks range copy/paste, which UC031 requires.
 *
 * Selection lives in DSG and is mirrored up through `onActiveCellChange` and
 * `onSelectionChange`. That mirroring is what lets the metadata drawer open
 * *beside* the grid without the grid unmounting or losing its place — the §2.4
 * acceptance test for this phase.
 */

import { useCallback, useMemo, useRef } from 'react'
import { DataSheetGrid, type Column, type DataSheetGridRef } from 'react-datasheet-grid'
import 'react-datasheet-grid/dist/style.css'
import type { GridColumn, GridRow } from '@/domain/workbook'
import {
  RowHeaderComponent,
  WorkbookCellComponent,
  type DsgRow,
} from './cellRenderers'
import { WorkbookGridContext, type WorkbookGridContextValue } from './gridContext'

/** Geometry. The label column matches the sidebar's 260px so the two align. */
const LABEL_COLUMN_WIDTH = 260
const YEAR_COLUMN_WIDTH = 96
const ROW_HEIGHT = 34
const HEADER_HEIGHT = 36

export interface GridCellRef {
  rowKey: string
  columnKey: string
}

export interface GridRangeRef {
  minRow: number
  maxRow: number
  minColumn: number
  maxColumn: number
}

export interface WorkbookGridProps {
  rows: GridRow[]
  columns: GridColumn[]
  context: WorkbookGridContextValue
  height: number
  /** Fired when a cell's text is committed — the page turns it into an edit. */
  onCellCommit: (rowKey: string, columnKey: string, text: string) => void
  onActiveCellChange: (cell: GridCellRef | null) => void
  onSelectionChange: (range: GridRangeRef | null) => void
  gridRef?: React.RefObject<DataSheetGridRef | null>
}

export function WorkbookGrid({
  rows,
  columns,
  context,
  height,
  onCellCommit,
  onActiveCellChange,
  onSelectionChange,
  gridRef,
}: WorkbookGridProps) {
  const internalRef = useRef<DataSheetGridRef>(null)
  const ref = gridRef ?? internalRef

  /**
   * DSG's row objects.
   *
   * Rebuilt when the axes or the underlying data change. `cells` holds the
   * *editable text*, which is the formula where a cell has one and the raw
   * number otherwise — the display formatting happens in the renderer, so what
   * a user sees when they start typing is what is actually stored.
   */
  const data = useMemo<DsgRow[]>(
    () =>
      rows.map((row) => {
        const cells: Record<string, string> = {}
        for (const column of columns) {
          const cell = context.getCell(row.key, column.key)
          cells[column.key] =
            cell?.formula != null && !cell.isCalculated
              ? cell.formula
              : cell?.value == null
                ? ''
                : String(cell.value)
        }
        return {
          rowKey: row.key,
          label: row.label,
          code: row.code,
          isCalculated: row.isCalculated,
          cells,
        }
      }),
    [rows, columns, context],
  )

  /**
   * Columns, memoised on the axis alone.
   *
   * Everything volatile reaches the cell through context instead, because a new
   * column array makes DSG remount its cells and drop focus mid-keystroke.
   */
  const dsgColumns = useMemo<Partial<Column<DsgRow, { columnKey: string }, string>>[]>(
    () =>
      columns.map((column) => ({
        id: column.key,
        title: column.label,
        basis: YEAR_COLUMN_WIDTH,
        minWidth: YEAR_COLUMN_WIDTH,
        grow: 0,
        shrink: 0,
        columnData: { columnKey: column.key },
        component: WorkbookCellComponent as Column<DsgRow, { columnKey: string }, string>['component'],
        // Copy/paste is handled by the page so all three UC031 modes share one
        // path; DSG's per-column clipboard is deliberately left inert.
        copyValue: ({ rowData }) => rowData.cells[column.key] ?? '',
        pasteValue: ({ rowData }) => rowData,
        // `disableKeys` hands keystrokes to our own <input> while a cell is
        // being edited. `keepFocus` is deliberately NOT set: it would put every
        // clicked cell straight into edit mode, so a single click would replace
        // the value instead of selecting the cell — and range selection, which
        // UC031's copy/paste depends on, would be impossible.
        disableKeys: true,
        deleteValue: ({ rowData }) => ({
          ...rowData,
          cells: { ...rowData.cells, [column.key]: '' },
        }),
        isCellEmpty: ({ rowData }) => (rowData.cells[column.key] ?? '') === '',
      })),
    [columns],
  )

  const gutterColumn = useMemo<Partial<Column<DsgRow, unknown, string>>>(
    () => ({
      basis: LABEL_COLUMN_WIDTH,
      minWidth: LABEL_COLUMN_WIDTH,
      grow: 0,
      shrink: 0,
      title: <span className="px-2 text-[length:var(--text-meta)]">Variable</span>,
      component: RowHeaderComponent as Column<DsgRow, unknown, string>['component'],
    }),
    [],
  )

  /**
   * DSG hands back the whole array plus the rows it touched.
   *
   * Only the touched rows are diffed — a 25 × 60 workbook is 1,500 cells and
   * comparing all of them on every keystroke would be visible.
   */
  const handleChange = useCallback(
    (next: DsgRow[], operations: { type: string; fromRowIndex: number; toRowIndex: number }[]) => {
      for (const op of operations) {
        if (op.type !== 'UPDATE') continue
        for (let i = op.fromRowIndex; i < op.toRowIndex; i++) {
          const after = next[i]
          const before = data[i]
          if (!after || !before) continue
          for (const column of columns) {
            const a = after.cells[column.key] ?? ''
            const b = before.cells[column.key] ?? ''
            if (a !== b) onCellCommit(after.rowKey, column.key, a)
          }
        }
      }
    },
    [data, columns, onCellCommit],
  )

  const handleActiveCell = useCallback(
    (opts: { cell: { col: number; row: number; colId?: string } | null }) => {
      const cell = opts.cell
      const rowKey = cell ? rows[cell.row]?.key : undefined
      const columnKey = cell ? (cell.colId ?? columns[cell.col]?.key) : undefined
      onActiveCellChange(rowKey && columnKey ? { rowKey, columnKey } : null)
    },
    [rows, columns, onActiveCellChange],
  )

  const handleSelection = useCallback(
    (opts: { selection: { min: { row: number; col: number }; max: { row: number; col: number } } | null }) => {
      const s = opts.selection
      onSelectionChange(
        s
          ? {
              minRow: s.min.row,
              maxRow: s.max.row,
              minColumn: s.min.col,
              maxColumn: s.max.col,
            }
          : null,
      )
    },
    [onSelectionChange],
  )

  return (
    <WorkbookGridContext.Provider value={context}>
      <div className="dms-workbook-grid overflow-hidden rounded border border-who-border">
        <DataSheetGrid<DsgRow>
          ref={ref}
          value={data}
          onChange={handleChange}
          columns={dsgColumns as Partial<Column<DsgRow, unknown, unknown>>[]}
          gutterColumn={gutterColumn as never}
          rowKey={({ rowData }) => rowData.rowKey}
          height={height}
          rowHeight={ROW_HEIGHT}
          headerRowHeight={HEADER_HEIGHT}
          lockRows
          disableExpandSelection={false}
          onActiveCellChange={handleActiveCell}
          onSelectionChange={handleSelection}
          addRowsComponent={false}
        />
      </div>
    </WorkbookGridContext.Provider>
  )
}
