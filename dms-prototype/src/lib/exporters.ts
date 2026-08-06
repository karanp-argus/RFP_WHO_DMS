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

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick — revoking synchronously can cancel the download
  // in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Timestamped filename stem, so repeated exports do not collide. */
export function stamped(stem: string, ext: string): string {
  // Uses the wall clock deliberately: this names a file the user just created,
  // it is not seeded demo data.
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  return `${stem}-${ts}.${ext}`
}

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

/** Raw CSV text → download, for the Annex 3 retrieval simulator. */
export function downloadCsvText(csv: string, filenameStem: string): void {
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), stamped(filenameStem, 'csv'))
}

export interface SheetSpec {
  name: string
  headers: readonly string[]
  rows: readonly Record<string, unknown>[]
}

/**
 * One or more sheets → .xlsx download.
 *
 * UC021's import step needs the header row to match the export exactly, so
 * headers are written explicitly rather than inferred from the first object.
 */
export function downloadXlsx(sheets: readonly SheetSpec[], filenameStem: string): void {
  const wb = XLSX.utils.book_new()

  for (const sheet of sheets) {
    const aoa: unknown[][] = [
      [...sheet.headers],
      ...sheet.rows.map((r) => sheet.headers.map((h) => r[h] ?? '')),
    ]
    const ws = XLSX.utils.aoa_to_sheet(aoa)
    // Give every column a workable width — an export nobody has to resize
    // reads as finished.
    ws['!cols'] = sheet.headers.map((h) => ({
      wch: Math.min(42, Math.max(12, String(h).length + 4)),
    }))
    // Excel caps sheet names at 31 characters.
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31))
  }

  XLSX.writeFile(wb, stamped(filenameStem, 'xlsx'))
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
