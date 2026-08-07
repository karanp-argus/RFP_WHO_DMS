/**
 * Bundle report, and a regression guard on the route split (Phase 8 item 1).
 *
 *     npm run build && npm run audit:bundle
 *
 * The split itself is easy; **keeping** it is not, and that is what this file is
 * for. Every regression during Phase 8 had the same shape — one innocuous import
 * in a module that the app shell happens to reach, pulling a 400 kB library into
 * the first paint:
 *
 *  · the header's notification bell imported `downloadBlob` from `lib/exporters`
 *    for a download link, and **SheetJS (487 kB) landed on the sign-in screen**;
 *  · a `vendor-charts` group collected a shared low-level helper, so every chunk
 *    imported one function from it and **Recharts (369 kB) was preloaded** on the
 *    sign-in screen too.
 *
 * Neither is visible in the build output, which reports chunk sizes and says
 * nothing about which chunks are on the critical path. Both are obvious here.
 *
 * Exits non-zero if a forbidden library reaches the critical path, or if the
 * critical path grows past its budget. Read the budget as a tripwire, not a
 * target: it is set just above the current figure so that a regression trips it
 * and ordinary work does not.
 */

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const DIST = fileURLToPath(new URL('../dist/', import.meta.url))
const INDEX = path.join(DIST, 'index.html')

if (!fs.existsSync(INDEX)) {
  console.error('No build found. Run `npm run build` first.')
  process.exit(1)
}

/** Budget for everything index.html references directly, gzipped. */
const CRITICAL_BUDGET_GZIP_KB = 250

/**
 * Libraries that must never be on the critical path, and the module that would
 * put them there. Matched against the *contents* of the critical chunks, because
 * a chunk name is not evidence — `vendor-xlsx` reaching the entry and SheetJS
 * being inlined into `index-*.js` look identical to a user and different to a
 * filename check.
 */
const FORBIDDEN = [
  { name: 'SheetJS (xlsx)', probe: /XLSX\.utils|sheet_to_json|book_new/, via: 'lib/exporters.ts — import from lib/download.ts instead' },
  { name: 'Recharts', probe: /recharts|CartesianGrid|ResponsiveContainer/, via: 'modules/quality/FindingsScatter.tsx' },
  { name: 'react-datasheet-grid', probe: /dsg-container|dsg-cell-gutter/, via: 'modules/workbooks/WorkbookGrid.tsx' },
]

const html = fs.readFileSync(INDEX, 'utf8')
const critical = [...new Set([...html.matchAll(/assets\/([A-Za-z0-9_.-]+\.(?:js|css))/g)].map((m) => m[1]))]

const gzipKb = (buf) => zlib.gzipSync(buf, { level: 9 }).length / 1024
const kb = (n) => n.toFixed(1).padStart(8)

console.log('=== critical path (referenced directly by index.html) ===')
let rawTotal = 0
let gzTotal = 0
const rows = []
for (const file of critical) {
  const buf = fs.readFileSync(path.join(DIST, 'assets', file))
  const gz = gzipKb(buf)
  rawTotal += buf.length / 1024
  gzTotal += gz
  rows.push({ file, raw: buf.length / 1024, gz })
}
for (const r of rows.sort((a, b) => b.gz - a.gz)) {
  console.log(`${kb(r.raw)} kB  ${kb(r.gz)} kB gz  ${r.file}`)
}
console.log(`${kb(rawTotal)} kB  ${kb(gzTotal)} kB gz  — ${critical.length} files, TOTAL`)

/* --- lazy chunks, for context ---------------------------------------------- */

const all = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => f.endsWith('.js'))
const lazy = all.filter((f) => !critical.includes(f))
const lazyRaw = lazy.reduce((s, f) => s + fs.statSync(path.join(DIST, 'assets', f)).size / 1024, 0)
console.log(`\n=== lazy: ${lazy.length} chunks, ${lazyRaw.toFixed(0)} kB raw, loaded on demand ===`)
const biggest = lazy
  .map((f) => ({ f, raw: fs.statSync(path.join(DIST, 'assets', f)).size / 1024 }))
  .sort((a, b) => b.raw - a.raw)
  .slice(0, 8)
for (const b of biggest) console.log(`${kb(b.raw)} kB  ${b.f}`)

/* --- the guards ------------------------------------------------------------ */

console.log('\n=== guards ===')
let failures = 0

const criticalJs = critical
  .filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(path.join(DIST, 'assets', f), 'utf8'))
  .join('\n')

for (const lib of FORBIDDEN) {
  const present = lib.probe.test(criticalJs)
  console.log(`  ${present ? 'FAIL' : 'ok  '}  ${lib.name} is not on the critical path`)
  if (present) {
    console.log(`          reached via ${lib.via}`)
    failures++
  }
}

const withinBudget = gzTotal <= CRITICAL_BUDGET_GZIP_KB
console.log(
  `  ${withinBudget ? 'ok  ' : 'FAIL'}  critical path ${gzTotal.toFixed(1)} kB gz ≤ ${CRITICAL_BUDGET_GZIP_KB} kB budget`,
)
if (!withinBudget) failures++

// Every page component should be its own chunk — if `routes.tsx` loses a `lazy()`
// the page is inlined into the entry and the split silently narrows.
const PAGES = [
  'HomePage', 'SetupPage', 'WorkbookPage', 'WorkbookSelectPage', 'QcListPage',
  'QcRuleEditorPage', 'QcReportPage', 'ReportsListPage', 'ReportBuilderPage',
  'ReportRunPage', 'XMartStatusPage', 'RetrievalApiPage', 'UsersListPage',
  'RolePermissionsPage', 'NotificationsPage',
]
const missing = PAGES.filter((p) => !lazy.some((f) => f.startsWith(p + '-')))
console.log(`  ${missing.length === 0 ? 'ok  ' : 'FAIL'}  all ${PAGES.length} page modules are lazy chunks`)
if (missing.length) {
  console.log(`          not split: ${missing.join(', ')} — check React.lazy in src/routes.tsx`)
  failures++
}

const has404 = fs.existsSync(path.join(DIST, '404.html'))
console.log(`  ${has404 ? 'ok  ' : 'FAIL'}  404.html written for static hosts with SPA rewrite`)
if (!has404) failures++

console.log(failures === 0 ? '\nOK' : `\nFAIL — ${failures} guard(s) tripped`)
process.exit(failures === 0 ? 0 : 1)
