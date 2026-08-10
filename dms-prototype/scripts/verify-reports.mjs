/**
 * Phase 6 browser verification — the Reports module.
 *
 * A diagnostic harness, not a CI gate (the gates are `npx tsc -b`, `npm test`,
 * `npm run build`). Start the dev server first:
 *
 *     npm run dev -- --port 5199
 *     npm run verify:reports
 *
 * It walks the phase's stated acceptance path end to end: an administrator
 * builds a pivot report by dragging fields and saves it, a regular user runs it
 * for five countries, and five `.xlsx` files arrive via an in-app notification
 * whose download link actually saves them. The download is verified by
 * intercepting Playwright's `download` events — a link that opens and produces
 * nothing would otherwise pass a visual check.
 */

import { chromium } from 'playwright'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../artifacts/shots-p6/', import.meta.url))
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const BASE = process.env.DMS_URL ?? 'http://localhost:5199'

const errors = []
let pass = 0
let fail = 0

const check = (label, ok, detail = '') => {
  if (ok) {
    pass++
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    errors.push(label)
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1680, height: 1150 },
  acceptDownloads: true,
})
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`))
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

/**
 * Every file the page saved, so the notification link can be proved to work.
 *
 * The bytes are kept, not just the names: a link that fires a download event
 * and produces a zero-length or corrupt file would pass a name-only check, and
 * "the download link works" is the phase's stated acceptance criterion.
 */
const downloads = []
const savedFiles = []
page.on('download', async (d) => {
  downloads.push(d.suggestedFilename())
  const path = `${OUT}/${d.suggestedFilename()}`
  try {
    await d.saveAs(path)
    savedFiles.push(path)
  } catch {
    /* the assertion below reports it */
  }
})

const shot = (name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.png`, ...opts })

/**
 * The demo role switcher lives in the header's user block. Targeted by
 * position rather than by accessible name: the name is the signed-in person's
 * own, so it changes the moment the switch is used and a name-based selector
 * works exactly once.
 */
const switchRole = async (role) => {
  await page.locator('header button').last().click()
  await page.getByRole('menuitem', { name: new RegExp(`^${role}$`, 'i') }).click()
  await page.waitForTimeout(400)
}

await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Sign in with WHO account/i }).click()
await page.getByRole('heading', { name: 'Modules' }).waitFor()

/* ==========================================================================
   1. The module (UC035)
   ========================================================================== */

console.log('\n=== 1. Reports module — the UC035 grouping ===')
await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Reports', exact: true }).waitFor()
await page.waitForTimeout(400)

for (const tab of ['Predefined and custom', 'Data tracking', 'Background jobs']) {
  check(`the "${tab}" tab is present`, await page.getByRole('tab', { name: tab }).isVisible())
}
check(
  'predefined reports are delivered',
  (await page.getByRole('heading', { name: /^Predefined reports/ }).count()) === 1,
)
const predefinedRows = await page.locator('section:has(h3:text-is("Predefined reports")) li').count()
check('six predefined reports ship with DMS', predefinedRows === 6, `${predefinedRows} rows`)
check(
  'the custom section is separate (UC037)',
  (await page.getByRole('heading', { name: /^My custom reports/ }).count()) === 1,
)
await shot('01-report-list', { fullPage: true })

/* ==========================================================================
   2. Favourites and order survive a reload (UC040)
   ========================================================================== */

console.log('\n=== 2. UC040 — favourites and order persist ===')
const firstBefore = (await page.locator('section:has(h3:text-is("Predefined reports")) li').first().innerText()).split('\n')[0]

await page.getByRole('button', { name: /Add .* to favourites/ }).first().click()
await page.waitForTimeout(200)
check(
  'the star is now pressed',
  (await page.getByRole('button', { name: /Remove .* from favourites/ }).count()) >= 1,
)

// Drag the first predefined report below the second.
const handles = page.locator('section:has(h3:text-is("Predefined reports")) li button[aria-label^="Reorder"]')
const from = await handles.nth(0).boundingBox()
const to = await handles.nth(2).boundingBox()
if (from && to) {
  await page.mouse.move(from.x + 4, from.y + 4)
  await page.mouse.down()
  await page.mouse.move(to.x + 4, to.y + 10, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(300)
}
const firstAfter = (await page.locator('section:has(h3:text-is("Predefined reports")) li').first().innerText()).split('\n')[0]
check('dragging changed the order', firstAfter !== firstBefore, `${firstBefore} → ${firstAfter}`)

await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(500)
const firstReloaded = (await page.locator('section:has(h3:text-is("Predefined reports")) li').first().innerText()).split('\n')[0]
check('the order survives a reload (UC040 acceptance)', firstReloaded === firstAfter, firstReloaded)
check(
  'the favourite survives a reload',
  (await page.getByRole('button', { name: /Remove .* from favourites/ }).count()) >= 1,
)

await page.getByRole('switch', { name: 'Show favourites only' }).click()
await page.waitForTimeout(250)
const favouriteRows = await page.locator('section li').count()
check('"favourites only" filters the list', favouriteRows >= 1 && favouriteRows < predefinedRows, `${favouriteRows} rows`)
await page.getByRole('switch', { name: 'Show favourites only' }).click()
await page.waitForTimeout(250)

/* ==========================================================================
   3. The builder (UC036)
   ========================================================================== */

console.log('\n=== 3. An administrator builds a pivot report (UC036) ===')
await page.goto(`${BASE}/reports/builder/rep-hf-by-year`, { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Report builder' }).waitFor()
await page.waitForTimeout(900)

for (const bucket of ['Rows', 'Columns', 'Values', 'Filters']) {
  check(
    `the ${bucket} bucket is present`,
    (await page.locator(`p:has-text("${bucket}") + p`).count()) >= 1,
  )
}
check(
  'measures are offered separately from dimension fields',
  await page.getByText('of the observation value').first().isVisible(),
)

// Wait for the debounced live preview.
await page.waitForTimeout(1600)
const previewCells = await page.locator('table td').count()
check('the live preview rendered a table', previewCells > 10, `${previewCells} cells`)

// Drag "WHO region" from the palette onto the Variable chip already in Rows,
// which inserts it *before* — so the report becomes region › variable and the
// region grouping has something nested under it to total.
const regionField = page.locator('button:has-text("WHO region")').first()
const variableChip = page.locator('button[aria-label="Move Variable"]').first()
const fb = await regionField.boundingBox()
const rb = await variableChip.boundingBox()
if (fb && rb) {
  await page.mouse.move(fb.x + 20, fb.y + 10)
  await page.mouse.down()
  await page.mouse.move(rb.x + 2, rb.y + 2, { steps: 16 })
  await page.mouse.move(rb.x + 4, rb.y + 4, { steps: 4 })
  await page.mouse.up()
  await page.waitForTimeout(400)
}
const rowChips = await page.locator('button[aria-label^="Move WHO region"]').count()
check('dragging a field from the palette into Rows works', rowChips === 1)

// Switch on its subtotal — UC036's "groupings".
const subtotalToggle = page.getByRole('button', { name: /subtotal after each WHO region/i }).first()
if (await subtotalToggle.count()) {
  await subtotalToggle.click()
  await page.waitForTimeout(1800)
}
// A subtotal line renders Excel-style: the group's own label, then "Total" in
// the nested column, on the calculated-row tint.
const subtotalRows = await page.locator('th:text-is("Total")').count()
check('switching on a grouping produces subtotal lines', subtotalRows >= 1, `${subtotalRows} lines`)
await shot('02-builder', { fullPage: true })

// Save it as a new predefined report by editing the name first.
const nameField = page.locator('#report-name')
await nameField.fill('Phase 6 acceptance report')
await page.waitForTimeout(200)
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForTimeout(600)
check(
  'saving returns to the report list',
  page.url().endsWith('/reports'),
  page.url(),
)
check(
  'the saved report appears in the list',
  await page.getByText('Phase 6 acceptance report').first().isVisible(),
)

/* ==========================================================================
   4. Run for five countries in the background (UC042)
   ========================================================================== */

console.log('\n=== 4. A regular user runs it for five countries (UC042) ===')
await switchRole('Regular user')
await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
check(
  'a regular user can find the administrator’s predefined report',
  await page.getByText('Phase 6 acceptance report').first().isVisible(),
)
check(
  'a regular user is told what they may and may not author',
  await page.getByText(/administrator action \(UC036\)/).isVisible(),
)

await page.getByText('Phase 6 acceptance report').first().click()
await page.waitForTimeout(700)
check('the run page opened', page.url().includes('/reports/run/'), page.url())

// The demo set is exactly the five countries the acceptance beat names.
await page.getByRole('button', { name: /Reports demo set \(5\)/ }).click()
await page.waitForTimeout(400)
check(
  'the run is routed to the background, and says why',
  await page.getByText(/This run goes to the background/).isVisible(),
)
check(
  'the reason names five files',
  await page.getByText(/5 files to build/).isVisible(),
)
await shot('03-run-page', { fullPage: true })

await page.getByRole('button', { name: /Queue the report/ }).click()
await page.waitForTimeout(400)
check('queueing lands on the jobs tab', page.url().includes('tab=jobs'), page.url())

// Real work: five pivots and five workbooks. Give it room.
await page.waitForTimeout(6000)
const jobText = await page.locator('body').innerText()
check('the job completed', /files ready/.test(jobText))
const fileRows = await page.locator('li:has-text(".xlsx")').count()
check('five Excel files were produced, one per country', fileRows === 5, `${fileRows} files`)
await shot('04-jobs', { fullPage: true })

/* ==========================================================================
   5. The notification and its download link (UC042)
   ========================================================================== */

console.log('\n=== 5. The notification carries a working download link ===')
const bell = page.getByRole('button', { name: /Notifications, \d+ unread/ })
check('the header bell shows an unread count', await bell.isVisible())
await bell.click()
await page.waitForTimeout(300)
check(
  'a success notification names the report',
  await page.getByText('Phase 6 acceptance report is ready').first().isVisible(),
)
const downloadButton = page.getByRole('button', { name: /Download all 5 files/ }).first()
check('the notification carries a download link', await downloadButton.isVisible())
await shot('05-notification')

downloads.length = 0
await downloadButton.click()
// The five saves are staggered by 250ms so the browser does not drop them.
await page.waitForTimeout(2500)
check(
  'the link actually saves five .xlsx files',
  downloads.length === 5 && downloads.every((f) => f.endsWith('.xlsx')),
  downloads.join(', ') || 'nothing downloaded',
)
check(
  'each file is named for its country',
  new Set(downloads).size === 5 &&
    ['CAN', 'ARG', 'FRA', 'KEN', 'IDN'].every((iso) => downloads.some((f) => f.includes(iso))),
  downloads.join(', '),
)

// Real .xlsx files, not empty placeholders: an OOXML workbook is a zip, so it
// begins with the `PK` local-file header.
const written = savedFiles.filter((f) => fs.existsSync(f)).map((f) => fs.readFileSync(f))
check(
  'the saved files are real, non-empty Excel workbooks',
  written.length === 5 &&
    written.every((b) => b.length > 4000 && b[0] === 0x50 && b[1] === 0x4b),
  written.map((b) => `${(b.length / 1024).toFixed(0)}kB`).join(', ') || 'nothing written',
)

await page.keyboard.press('Escape')
await page.waitForTimeout(200)

/* ==========================================================================
   6. On-screen run, unit / currency / scale (UC035, UC042)
   ========================================================================== */

console.log('\n=== 6. On-screen run with the unit, currency and scale prompts ===')
await page.goto(`${BASE}/reports/run/rep-oecd-usd`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
check(
  'the scale selector keeps the legacy wording',
  (await page.getByText('Millions (Default)').count()) >= 1,
)
check(
  'the unit selector offers national currency and US dollars',
  await page.getByText(/US dollars \(converted at the reported exchange rate\)/).isVisible(),
)
// UC041: all six languages must be *selectable*. A disabled option looked the
// same as a live one in the old name-only check, which is how this passed while
// half the list was inert.
await page.locator('#run-language').click()
await page.waitForTimeout(250)
const languageOptions = page.getByRole('option')
const languageCount = await languageOptions.count()
let disabledLanguages = 0
for (let i = 0; i < languageCount; i++) {
  const disabled = await languageOptions.nth(i).getAttribute('data-disabled')
  if (disabled != null) disabledLanguages++
}
check(
  'UC041 offers all six WHO languages and none of them is disabled',
  languageCount === 6 && disabledLanguages === 0,
  `${languageCount} options, ${disabledLanguages} disabled`,
)
await page.keyboard.press('Escape')
await page.waitForTimeout(200)

await page.getByRole('button', { name: /Reports demo set \(5\)/ }).click()
await page.waitForTimeout(300)
await page.getByRole('radio', { name: /Display on screen/i }).click().catch(() => {})
await page.locator('label:has-text("Display on screen")').click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: /^Run report$/ }).click()
await page.waitForTimeout(3500)

const resultCells = await page.locator('table td').count()
check('the report rendered on screen', resultCells > 10, `${resultCells} cells`)
check(
  'the result is labelled with the unit it is in',
  (await page.locator('body').innerText()).includes('US$ millions'),
)
await shot('06-onscreen', { fullPage: true })

downloads.length = 0
await page.getByRole('button', { name: 'Download Excel' }).click()
await page.waitForTimeout(1200)
check(
  'an on-screen report can be downloaded afterwards (UC042)',
  downloads.length === 1 && downloads[0].endsWith('.xlsx'),
  downloads.join(', ') || 'nothing downloaded',
)

/* ==========================================================================
   6b. The same report, run in another language (UC041)
   ========================================================================== */

/**
 * The assertions are report-specific on purpose. This report puts **OECD
 * membership** and **Country** on the row axis with a subtotal per group, and no
 * `variable` field anywhere — so what it can prove is the field headers, the
 * translated grouping values and the subtotal template. Classification labels
 * are checked in 7b, on a report that actually renders them. A regex hoping to
 * find some French somewhere would pass on the wrong report and prove nothing.
 */
console.log('\n=== 6b. The same report run in French (UC041) ===')
await page.locator('#run-language').click()
await page.waitForTimeout(250)
await page.getByRole('option', { name: /^French$/ }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: /^Run report$/ }).click()
await page.waitForTimeout(3500)

const frenchBody = await page.locator('body').innerText()
check(
  'the row-axis field headers are translated',
  // Case-insensitive: the header cells are `uppercase` in CSS, and `innerText`
  // returns the rendered text, so "Appartenance" arrives as "APPARTENANCE".
  /appartenance/i.test(frenchBody) && /\bpays\b/i.test(frenchBody),
)
check(
  'the OECD grouping values are translated',
  frenchBody.includes('Hors OCDE') && frenchBody.includes('OCDE'),
)
await shot('06b-french', { fullPage: true })

downloads.length = 0
await page.getByRole('button', { name: 'Download Excel' }).click()
await page.waitForTimeout(1200)
check(
  'a French report exports as a real file (UC041 + UC042)',
  downloads.length === 1 && downloads[0].endsWith('.xlsx'),
  downloads.join(', ') || 'nothing downloaded',
)

/**
 * The subtotal *filler* word is checked in Russian, not French.
 *
 * On a two-level row axis the subtotal line renders as the group name in the
 * outer column and `chrome.total` in the inner one — and `chrome.total` is
 * "Total" in both English and French, so a French assertion could not tell a
 * translated cell from an untranslated one. `Итого` can. The `{label}` template
 * itself is asserted in `translations.test.ts`, where a one-level axis makes it
 * visible.
 */
await page.locator('#run-language').click()
await page.waitForTimeout(250)
await page.getByRole('option', { name: /^Russian$/ }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: /^Run report$/ }).click()
await page.waitForTimeout(3500)
const russianTable = await page.locator('table').innerText()
check(
  'the subtotal filler word and grouping values are translated (Russian)',
  russianTable.includes('Итого') && russianTable.includes('Не ОЭСР'),
)
await shot('06c-russian', { fullPage: true })

// Back to English: section 7 asserts on the English word "mixed", which is
// itself part of the report vocabulary and reads "mixte" in French.
await page.locator('#run-language').click()
await page.waitForTimeout(250)
await page.getByRole('option', { name: /^English$/ }).click()
await page.waitForTimeout(300)

/* ==========================================================================
   7. The national-currency guard
   ========================================================================== */

console.log('\n=== 7. A cross-currency total is refused, not faked ===')
await page.locator('#run-unit').click()
await page.getByRole('option', { name: /National currency/ }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: /^Run report$/ }).click()
await page.waitForTimeout(3000)
const mixedCells = await page.getByText('mixed', { exact: true }).count()
check(
  'subtotals across different national currencies show "mixed", not a number',
  mixedCells >= 1,
  `${mixedCells} cells`,
)
await shot('07-mixed-currency', { fullPage: true })

/* ==========================================================================
   7b. Classification labels and the Arabic caveat (UC041)
   ========================================================================== */

/**
 * `rep-hf-by-year` is the report with the SHA financing schemes on the row
 * axis, so it is the one that can prove classification labels are translated.
 * One country keeps the run in the foreground — the report is
 * `oneFilePerCountry`, so several would correctly go to the background queue
 * and there would be no table on screen to read.
 */
console.log('\n=== 7b. Classification labels in French, then the Arabic caveat ===')
await page.goto(`${BASE}/reports/run/rep-hf-by-year`, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)

// The picker's trigger declares `role="combobox"`, so `getByRole('button')`
// never matches it — the aria-label is what disambiguates it from the Select
// triggers on the same page, which are comboboxes too.
await page.getByRole('combobox', { name: 'Countries to run the report for' }).click()
await page.waitForTimeout(300)
await page.getByPlaceholder(/Search by name or ISO3 code/i).fill('Canada')
await page.waitForTimeout(400)
await page.getByRole('option', { name: /Canada/ }).first().click()
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

// This report is `oneFilePerCountry`, so `defaultParameters` opens it on
// download-only and the run button reads "Generate and download". Switch to
// on-screen delivery, which is what leaves a table to read the labels from.
await page.locator('label:has-text("Display on screen")').click()
await page.waitForTimeout(200)

await page.locator('#run-language').click()
await page.waitForTimeout(250)
await page.getByRole('option', { name: /^French$/ }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: /^Run report$/ }).click()
await page.waitForTimeout(3500)

const schemeTable = await page.locator('table').innerText()
check(
  'SHA 2011 classification labels come back in French',
  /Régimes publics|Paiements directs des ménages|Régimes de financement/.test(schemeTable),
  schemeTable.split('\n')[1] ?? '',
)
await shot('07b-french-schemes', { fullPage: true })

// Arabic is the one language with a stated limit, and the limit has to be on
// screen rather than only in the README.
await page.locator('#run-language').click()
await page.waitForTimeout(250)
await page.getByRole('option', { name: /^Arabic/ }).click()
await page.waitForTimeout(300)
check(
  'selecting Arabic states that right-to-left layout is not implemented',
  (await page.locator('body').innerText()).includes('Right-to-left layout is not implemented'),
)
await page.getByRole('button', { name: /^Run report$/ }).click()
await page.waitForTimeout(3500)
check(
  'Arabic labels are rendered, not left in English',
  // U+0600-U+06FF is the Arabic block.
  /[\u0600-\u06FF]/.test(await page.locator('table').innerText()),
)
await shot('07c-arabic-schemes', { fullPage: true })


/* ==========================================================================
   8. Data tracking (UC039)
   ========================================================================== */

console.log('\n=== 8. Data tracking report (UC039) ===')
await page.goto(`${BASE}/reports?tab=data-tracking`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const trackingRows = await page.locator('table tbody tr').count()
check('a row per selected country', trackingRows === 5, `${trackingRows} rows`)
for (const header of ['Last received', 'Series', 'Format', 'Rows', 'Batch']) {
  check(
    `the report shows "${header}"`,
    (await page.getByRole('columnheader', { name: new RegExp(`^${header}$`, 'i') }).count()) >= 1,
  )
}
await page.getByRole('tab', { name: /Every submission/ }).click()
await page.waitForTimeout(600)
check(
  'the full import log is available too',
  (await page.locator('table tbody tr').count()) >= 5,
)
await shot('08-data-tracking', { fullPage: true })

/* ==========================================================================
   9. UC037 — a custom report is private to its author
   ========================================================================== */

console.log('\n=== 9. UC037 — custom reports are private ===')
await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await page.getByRole('button', { name: /Duplicate Phase 6 acceptance report/ }).click()
await page.waitForTimeout(700)
await page.locator('#report-name').fill('My private working copy')
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForTimeout(600)
check(
  'a regular user’s copy is created as a custom report',
  await page
    .locator('section:has(h3:text-is("My custom reports"))')
    .getByRole('button', { name: 'My private working copy', exact: true })
    .isVisible(),
)

await switchRole('Administrator')
await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' })
await page.waitForTimeout(500)
check(
  'an administrator does not see another user’s custom report (UC037)',
  (await page.getByRole('button', { name: 'My private working copy', exact: true }).count()) === 0,
)
await shot('09-uc037-privacy', { fullPage: true })

/* ==========================================================================
   Result
   ========================================================================== */

const consoleErrors = errors.filter((e) => e.startsWith('['))
console.log(`\n${'='.repeat(60)}`)
console.log(`  ${pass} PASS, ${fail} FAIL, ${consoleErrors.length} console errors`)
if (consoleErrors.length > 0) for (const e of consoleErrors) console.log(`  ${e}`)
console.log(`  screenshots → artifacts/shots-p6/`)
console.log('='.repeat(60))

await browser.close()
process.exit(fail > 0 || consoleErrors.length > 0 ? 1 : 0)
