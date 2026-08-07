/**
 * Download helpers for CSV and Excel.
 *
 * UC021 requires export/import round-tripping of component values "so that I can
 * edit the exported file and reimport to edit or add elements", and Annex 3 makes
 * CSV the mandatory interchange format. SheetJS is loaded from the CDN tarball,
 * not npm — see CLAUDE.md for why.
 */

import * as XLSX from 'xlsx'
import Papa from 'papaparse'

/*
 * `triggerDownload`, `stamped`, `downloadBlob` and `downloadCsvText` now live in
 * `lib/download.ts`, which imports nothing. They are re-exported here so the
 * dozen existing call sites keep working, but a module that ONLY needs to save
 * bytes must import them from `lib/download` — importing them from this file
 * pulls SheetJS in with them. See the note at the top of `lib/download.ts`: the
 * header's notification bell did exactly that, and put 487 kB of spreadsheet
 * writer into the sign-in screen's critical path.
 */
export { downloadBlob, downloadCsvText, stamped, triggerDownload } from './download'

import { stamped, triggerDownload } from './download'

/** Rows of plain objects → CSV download. Column order follows `headers`. */
export function downloadCsv<T extends Record<string, unknown>>(
  rows: readonly T[],
  headers: readonly string[],
  filenameStem: string,
): void {
  const csv = Papa.unparse(
    {
      fields: headers as string[],
      data: rows.map((r) => headers.map((h) => r[h] ?? '')),
    },
    // CRLF: the consumers here are Excel and xMart tooling on Windows.
    { newline: '\r\n' },
  )
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), stamped(filenameStem, 'csv'))
}

export interface SheetSpec {
  name: string
  headers: readonly string[]
  rows: readonly Record<string, unknown>[]
}

/**
 * A sheet given as a rectangle rather than as objects.
 *
 * Needed by the Phase 6 pivot export, where the header is several rows deep and
 * the same column label repeats — neither of which a `headers: string[]` plus
 * keyed rows can express. Kept alongside `SheetSpec` rather than replacing it:
 * the object form is what the flat exports read naturally as.
 */
export interface GridSheetSpec {
  name: string
  /** Rows of cells, header rows included. Written verbatim. */
  aoa: readonly (readonly (string | number | null)[])[]
  /** Column widths in characters; derived from the first row when omitted. */
  widths?: readonly number[]
  /**
   * Excel number format applied to every numeric cell, e.g. `#,##0.0`.
   *
   * A *display* format, not a rounding: the cell keeps the full value the
   * engine produced, so a reader who widens the column or builds their own
   * formula on top of it gets the real number. Writing pre-rounded values
   * instead would quietly make the file less accurate than the screen it came
   * from.
   */
  numberFormat?: string
}

function buildWorkbook(sheets: readonly (SheetSpec | GridSheetSpec)[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()

  for (const sheet of sheets) {
    let aoa: unknown[][]
    let widths: readonly number[] | undefined
    if ('aoa' in sheet) {
      aoa = sheet.aoa.map((r) => [...r])
      widths = sheet.widths
    } else {
      aoa = [[...sheet.headers], ...sheet.rows.map((r) => sheet.headers.map((h) => r[h] ?? ''))]
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa)

    if ('aoa' in sheet && sheet.numberFormat) {
      const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined
          if (cell?.t === 'n') cell.z = sheet.numberFormat
        }
      }
    }

    // Give every column a workable width — an export nobody has to resize
    // reads as finished.
    const firstRow = aoa[0] ?? []
    ws['!cols'] = (widths ?? firstRow.map((h) => String(h ?? '').length + 4)).map((w) => ({
      wch: Math.min(48, Math.max(12, Number(w) || 12)),
    }))

    // Frozen panes are deliberately not written: they are a SheetJS Pro
    // feature and the community build silently drops `!freeze`, so setting it
    // would look like a working feature in the code and produce nothing in the
    // file. The pivot export puts its row labels in the leftmost columns
    // instead, which is what makes a wide sheet readable without them.

    // Excel caps sheet names at 31 characters.
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31))
  }

  return wb
}

/**
 * One or more sheets → .xlsx download.
 *
 * UC021's import step needs the header row to match the export exactly, so
 * headers are written explicitly rather than inferred from the first object.
 */
export function downloadXlsx(
  sheets: readonly (SheetSpec | GridSheetSpec)[],
  filenameStem: string,
): void {
  XLSX.writeFile(buildWorkbook(sheets), stamped(filenameStem, 'xlsx'))
}

/**
 * The same workbook as a `Blob`, without downloading it.
 *
 * UC042's background jobs build files *before* anybody asks for them — the
 * notification arrives later and carries the download link — so the bytes have
 * to exist in memory first. `writeFile` cannot do that; it triggers a save.
 */
export function xlsxBlob(sheets: readonly (SheetSpec | GridSheetSpec)[]): Blob {
  const out = XLSX.write(buildWorkbook(sheets), { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/* --------------------------------------------------------------------------
   Import (UC021)
   -------------------------------------------------------------------------- */

export interface ImportResult {
  headers: string[]
  rows: Record<string, string>[]
  /** Problems found while validating, surfaced as a summary to the user. */
  errors: string[]
}

/**
 * Read an uploaded .xlsx or .csv back into rows.
 *
 * UC021 also specifies a virus scan and a format check on import. A front-end
 * prototype cannot scan, so the format/schema check is what we implement and the
 * scan is called out as a server-side step in the UI copy — claiming otherwise
 * would be dishonest.
 */
export async function readSpreadsheet(
  file: File,
  expectedHeaders: readonly string[],
): Promise<ImportResult> {
  const errors: string[] = []
  let headers: string[] = []
  let rows: Record<string, string>[] = []

  const isCsv = /\.csv$/i.test(file.name)

  if (isCsv) {
    const text = await file.text()
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    })
    headers = parsed.meta.fields ?? []
    rows = parsed.data
    for (const e of parsed.errors.slice(0, 5)) {
      errors.push(`Row ${e.row ?? '?'}: ${e.message}`)
    }
  } else {
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const firstName = wb.SheetNames[0]
    const ws = firstName ? wb.Sheets[firstName] : undefined
    if (!ws) {
      return { headers: [], rows: [], errors: ['The workbook contains no sheets.'] }
    }
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false })
    const headerRow = aoa[0]
    if (!headerRow) {
      return { headers: [], rows: [], errors: ['The first sheet is empty.'] }
    }
    headers = headerRow.map((h) => String(h ?? '').trim())
    rows = aoa.slice(1).map((r) => {
      const obj: Record<string, string> = {}
      headers.forEach((h, i) => {
        obj[h] = r[i] == null ? '' : String(r[i])
      })
      return obj
    })
  }

  // Schema check: every expected column must be present. Extra columns are
  // tolerated, because a user may well have added notes alongside.
  const missing = expectedHeaders.filter((h) => !headers.includes(h))
  if (missing.length > 0) {
    errors.unshift(`Missing required column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}`)
  }
  if (rows.length === 0) errors.push('The file contains no data rows.')

  return { headers, rows, errors }
}
