/**
 * Saving bytes the browser already has. **No SheetJS, no PapaParse — on purpose.**
 *
 * These four functions used to live in `lib/exporters.ts` beside the .xlsx
 * builders, which reads naturally until you look at the import graph. The header's
 * notification bell offers a download link for a completed UC042 report job, so it
 * imports `downloadBlob` → `lib/exporters` → `xlsx`, and **SheetJS's 487 kB landed
 * in the entry chunk of every page including the sign-in screen** — for the sake
 * of one `URL.createObjectURL` call.
 *
 * The split is therefore load-bearing, not tidying: anything that only needs to
 * *save* bytes imports this file, and only code that needs to *build a spreadsheet*
 * imports `exporters.ts`. Verified by `scripts/bundle-report.mjs`, which fails if
 * `vendor-xlsx` reappears among the entry's static imports.
 */

/**
 * Hand a blob to the browser as a download.
 *
 * The object URL is revoked on the next tick rather than synchronously: revoking
 * it in the same frame as the click cancels the download in some browsers.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Save a blob already in hand — the download link on a completed job. */
export function downloadBlob(blob: Blob, filename: string): void {
  triggerDownload(blob, filename)
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

/** Raw CSV text → download, for the Annex 3 retrieval simulator. */
export function downloadCsvText(csv: string, filenameStem: string): void {
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), stamped(filenameStem, 'csv'))
}
