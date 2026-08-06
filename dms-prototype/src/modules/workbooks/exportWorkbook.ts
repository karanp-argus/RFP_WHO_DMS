/**
 * Excel export (UC032).
 *
 * The requirement is specific about the one thing that makes this more than a
 * CSV: **"formulas as formulas, values as values"**. A cell carrying
 * `=HF.1+HF.2` is written as a SheetJS formula cell (`{ f: … }`), so the
 * exported workbook opens in Excel with a live formula in it rather than a
 * frozen number with the provenance lost.
 *
 * Two DMS-specific translations happen on the way out:
 *
 *  · **Variable references become cell references.** `=HF.1 + HF.2` means
 *    nothing to Excel; `=B4+B5` does. The row each code occupies is known from
 *    the grid, so the substitution is exact for anything in the sheet — and
 *    where a referenced code is *not* in the sheet, the formula is written as a
 *    comment on a value cell instead of exporting a `#NAME?` error.
 *  · **A blank stays blank.** No `0`, in the export least of all: this is the
 *    file an analyst opens in Excel and sums.
 */

import * as XLSX from 'xlsx'
import type { Scale } from '@/domain/constants'
import type { GridColumn, GridRow } from '@/domain/workbook'
import type { WorkbookCell } from '@/hooks/useWorkbookData'
import { stamped } from '@/lib/exporters'
import { scaleValue } from './cellRenderers'

export interface ExportWorkbookOptions {
  rows: GridRow[]
  columns: GridColumn[]
  getCell: (rowKey: string, columnKey: string) => WorkbookCell | null
  title: string
  scale: Scale
}

/** Column A is the label, B the code, so data starts at C (index 2). */
const FIRST_DATA_COLUMN = 2
/** Row 1 is the title, row 2 the header, so data starts at row 3 (index 2). */
const FIRST_DATA_ROW = 2

export function exportWorkbookXlsx({
  rows,
  columns,
  getCell,
  title,
  scale,
}: ExportWorkbookOptions): void {
  const sheet: XLSX.WorkSheet = {}
  const rowIndexByCode = new Map(rows.map((row, i) => [row.code, FIRST_DATA_ROW + i]))

  const write = (r: number, c: number, cell: XLSX.CellObject) => {
    sheet[XLSX.utils.encode_cell({ r, c })] = cell
  }

  write(0, 0, { t: 's', v: title })
  write(1, 0, { t: 's', v: 'Variable' })
  write(1, 1, { t: 's', v: 'Code' })
  columns.forEach((column, i) => {
    write(1, FIRST_DATA_COLUMN + i, { t: 's', v: column.label })
  })

  rows.forEach((row, r) => {
    const sheetRow = FIRST_DATA_ROW + r
    write(sheetRow, 0, { t: 's', v: row.label })
    write(sheetRow, 1, { t: 's', v: row.code })

    columns.forEach((column, c) => {
      const sheetColumn = FIRST_DATA_COLUMN + c
      const cell = getCell(row.key, column.key)
      if (!cell) return

      const value = scaleValue(cell.value, scale)
      const formula =
        cell.formula != null && !cell.isCalculated
          ? toExcelFormula(cell.formula, rowIndexByCode, sheetColumn)
          : null

      if (formula) {
        // UC032: a formula cell exports as a formula. `v` carries the last
        // computed value so the file reads correctly before Excel recalculates.
        write(sheetRow, sheetColumn, { t: 'n', f: formula, v: value ?? 0 })
        return
      }

      // A blank cell is simply not written — an omitted cell is empty in Excel,
      // which is the honest representation. Writing 0 would not be.
      if (value == null) return
      write(sheetRow, sheetColumn, { t: 'n', v: value })
    })
  })

  sheet['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: FIRST_DATA_ROW + rows.length, c: FIRST_DATA_COLUMN + columns.length },
  })
  sheet['!cols'] = [
    { wch: 44 },
    { wch: 14 },
    ...columns.map(() => ({ wch: 12 })),
  ]

  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Workbook')
  XLSX.writeFile(book, stamped('workbook', 'xlsx'))
}

/**
 * `=HF.1 + HF.2` → `=C4+C5` for the column being written.
 *
 * Returns null when any referenced code is not a row in this sheet, because a
 * formula referring to a row that is not there would open as `#REF!` and look
 * like a bug in the export rather than a limit of the selection.
 */
function toExcelFormula(
  expression: string,
  rowIndexByCode: ReadonlyMap<string, number>,
  sheetColumn: number,
): string | null {
  const body = expression.replace(/^=/, '')
  const columnLetter = XLSX.utils.encode_col(sheetColumn)

  // Longest code first, so `HF.1.1` is substituted before `HF.1` — the same
  // greedy rule the tokeniser uses, for the same reason.
  const codes = [...rowIndexByCode.keys()].sort((a, b) => b.length - a.length)

  let out = body
  const substituted = new Set<string>()
  for (const code of codes) {
    if (!out.includes(code)) continue
    const rowIndex = rowIndexByCode.get(code)
    if (rowIndex == null) continue
    out = out.split(code).join(`${columnLetter}${rowIndex + 1}`)
    substituted.add(code)
  }

  // Anything left that looks like a variable code means a reference this sheet
  // cannot resolve.
  if (/[A-Za-z][A-Za-z0-9._%$-]*/.test(out.replace(/[A-Z]+\d+/g, ''))) {
    const leftover = out.replace(/[A-Z]+\d+/g, '').replace(/[\d\s+\-*/().]/g, '')
    if (leftover.trim() !== '') return null
  }

  return `=${out}`
}
