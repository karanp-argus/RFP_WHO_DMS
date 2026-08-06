/**
 * Phase 4 browser verification — the workbook.
 *
 * A diagnostic harness, not a CI gate. Start the dev server first:
 *
 *     npm run dev -- --port 5199
 *     npm run verify:workbook
 *
 * It drives the plan's own "done when" sentence — open Canada × HF, edit a
 * value, watch the aggregate recompute, undo, open metadata, copy a range,
 * fill a gap, set status in bulk, lock, save — and separately checks the four
 * §2.4 chrome replacements, which are requirements of this phase rather than
 * polish: frozen headers, virtualised scroll, chips that reach the URL, and a
 * metadata drawer that does not cost you your place in the data.
 */

import { chromium } from 'playwright'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../artifacts/shots-p4/', import.meta.url))
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const BASE = process.env.DMS_URL ?? 'http://localhost:5199'

/** Five years × five variables: small enough that nothing is virtualised away. */
const FOCUS = `${BASE}/workbooks/view?c=CAN&v=HF.1,HF.1.1,HF.1.2,HF.3,HF.3.1&y=2018-2022&type=country`

const errors = []
const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1050 },
  permissions: ['clipboard-read', 'clipboard-write'],
})
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`))
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

const shot = (name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.png`, ...opts })
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) errors.push(label)
}

/** The rendered text of the cell at (variable code, year). */
async function cellText(code, year) {
  return page.evaluate(
    ([c, y]) => {
      const rows = [...document.querySelectorAll('.dsg-row:not(.dsg-row-header)')]
      const row = rows.find(
        (r) => r.querySelector('.dsg-cell-gutter')?.innerText.split('\n')[1] === c,
      )
      const header = [...document.querySelectorAll('.dsg-row-header .dsg-cell')]
      const index = header.findIndex((h) => h.innerText.trim() === String(y))
      if (!row || index < 1) return null
      const cells = [...row.querySelectorAll('.dsg-cell:not(.dsg-cell-gutter)')]
      return cells[index - 1]?.innerText.trim() ?? null
    },
    [code, year],
  )
}

async function clickCell(code, year) {
  await page.evaluate(
    ([c, y]) => {
      const rows = [...document.querySelectorAll('.dsg-row:not(.dsg-row-header)')]
      const row = rows.find(
        (r) => r.querySelector('.dsg-cell-gutter')?.innerText.split('\n')[1] === c,
      )
      const header = [...document.querySelectorAll('.dsg-row-header .dsg-cell')]
      const index = header.findIndex((h) => h.innerText.trim() === String(y))
      const cells = [...(row?.querySelectorAll('.dsg-cell:not(.dsg-cell-gutter)') ?? [])]
      const target = cells[index - 1]
      if (!target) return
      const box = target.getBoundingClientRect()
      const at = { bubbles: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 }
      for (const type of ['mousedown', 'mouseup', 'click']) {
        target.dispatchEvent(new MouseEvent(type, at))
      }
    },
    [code, year],
  )
  await page.waitForTimeout(500)
}

const formulaBar = () => page.locator('input[aria-label="Formula bar"]')
const coordLabel = () =>
  page
    .locator('span', { hasText: /^CAN · \d{4} · / })
    .first()
    .innerText()
    .catch(() => '')

await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Sign in with WHO account/i }).click()
await page.getByRole('heading', { name: 'Modules' }).waitFor()

/* ==========================================================================
   1. UC031 — the axis constraint is enforced in the controls
   ========================================================================== */

console.log('=== 1. UC031 axis constraint ===')
await page.goto(BASE + '/workbooks', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await shot('01-select-empty', { fullPage: true })

await page.getByText('Select countries…').first().click()
for (const name of ['Canada', 'Kenya']) {
  await page.getByPlaceholder('Search by name or ISO3 code…').fill(name)
  await page.waitForTimeout(350)
  await page.getByRole('option').first().click()
}
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
check(
  'no axis is forced while only one is multi',
  (await page.locator('text=/single — the other two axes are multi/').count()) === 0,
)

await page.getByText('Select variables…').first().click()
await page.getByPlaceholder('Search code or label…').fill('HF.1')
await page.waitForTimeout(400)
await page.getByRole('option').first().click()
await page.getByRole('option').nth(1).click()
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
// The year axis is now capped at one; pick it so the selection resolves.
await page.getByText('Select a year').first().click()
await page.waitForTimeout(400)
await page.getByRole('option', { name: '2022' }).first().click()
await page.waitForTimeout(600)
check(
  'the third axis is forced to single once two are multi',
  (await page.locator('text=/single — the other two axes are multi/').count()) === 1,
)
check(
  'the workbook type is named on screen',
  /Year workbook/.test(await page.evaluate(() => document.body.innerText)),
)
await shot('02-select-constraint', { fullPage: true })

/* ==========================================================================
   2. Open the demo workbook
   ========================================================================== */

console.log('\n=== 2. Canada 2000–2024 × HF ===')
await page.goto(BASE + '/workbooks', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.getByText('Canada · HF · 2000–2024').click()
await page.waitForTimeout(500)
await page.getByRole('button', { name: /Open workbook/ }).click()
await page.waitForTimeout(3200)

const url = new URL(page.url())
check('the selection travels in the URL', url.searchParams.get('c') === 'CAN')
check('years collapse to a readable range', url.searchParams.get('y') === '2000-2024')
const gutterCount = await page.locator('.dsg-cell-gutter').count()
check('the frozen label column renders', gutterCount > 10, `${gutterCount} gutter cells`)
await shot('03-workbook')

/* ==========================================================================
   3. §2.4 — frozen headers survive scrolling
   ========================================================================== */

console.log('\n=== 3. Frozen headers and virtualised scroll (§2.4) ===')
const gutterBefore = await page.locator('.dsg-cell-gutter').nth(2).boundingBox()
const headerBefore = await page.locator('.dsg-row-header').first().boundingBox()
await page.mouse.move(900, 600)
await page.mouse.wheel(1400, 400)
await page.waitForTimeout(800)
const gutterAfter = await page.locator('.dsg-cell-gutter').nth(2).boundingBox()
const headerAfter = await page.locator('.dsg-row-header').first().boundingBox()
check(
  'the variable label column stays pinned on horizontal scroll',
  !!gutterBefore && !!gutterAfter && Math.abs(gutterBefore.x - gutterAfter.x) < 2,
)
check(
  'the year header row stays pinned on vertical scroll',
  !!headerBefore && !!headerAfter && Math.abs(headerBefore.y - headerAfter.y) < 2,
)
const corner = await page.locator('.dsg-row-header .dsg-cell-gutter').first().innerText()
check('the corner is frozen too', corner.trim().length > 0, JSON.stringify(corner.trim()))
await shot('04-frozen-scrolled')

/* ==========================================================================
   4. Edit → the aggregate recomputes through the Phase 3 engine
   ========================================================================== */

console.log('\n=== 4. Edit → recompute ===')
await page.goto(FOCUS, { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)

const before111 = await cellText('HF.1.1', 2020)
const beforeParent = await cellText('HF.1', 2020)
console.log(`  HF.1.1 2020 = ${before111} · parent HF.1 = ${beforeParent}`)
check('cells render values', before111 != null && beforeParent != null)

await clickCell('HF.1.1', 2020)
const barValue = await formulaBar().inputValue().catch(() => '')
check('clicking a cell fills the formula bar', barValue !== '', barValue)

await formulaBar().fill('99999')
await formulaBar().press('Enter')
await page.waitForTimeout(2200)

const after111 = await cellText('HF.1.1', 2020)
const afterParent = await cellText('HF.1', 2020)
console.log(`  after edit: HF.1.1 = ${after111} · parent HF.1 = ${afterParent}`)
check('the edited cell shows the new value', String(after111).includes('99,999'), String(after111))
check(
  'the parent aggregate recomputed through the engine',
  afterParent !== beforeParent,
  `${beforeParent} → ${afterParent}`,
)
check(
  'an unsaved count appears',
  /unsaved/.test(await page.evaluate(() => document.body.innerText)),
)
await shot('05-edited')

/* ==========================================================================
   5. Undo
   ========================================================================== */

console.log('\n=== 5. Undo ===')
await page.getByRole('button', { name: 'Undo' }).click()
await page.waitForTimeout(2000)
const undone = await cellText('HF.1.1', 2020)
check('undo restored the original value', undone === before111, `${undone} vs ${before111}`)
await shot('06-undone')

/* ==========================================================================
   6. Metadata drawer — beside the grid, selection survives (§2.4)
   ========================================================================== */

console.log('\n=== 6. Metadata drawer keeps your place (§2.4) ===')
await clickCell('HF.3.1', 2019)
const coordBefore = await coordLabel()
const cellsBefore = await page.locator('.dsg-cell').count()

// The marker on the cell that is already selected — clicking a different
// cell's marker would legitimately move the selection and prove nothing.
const opened = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.dsg-row:not(.dsg-row-header)')]
  const row = rows.find(
    (r) => r.querySelector('.dsg-cell-gutter')?.innerText.split('\n')[1] === 'HF.3.1',
  )
  const header = [...document.querySelectorAll('.dsg-row-header .dsg-cell')]
  const index = header.findIndex((h) => h.innerText.trim() === '2019')
  const cells = [...(row?.querySelectorAll('.dsg-cell:not(.dsg-cell-gutter)') ?? [])]
  const marker = cells[index - 1]?.querySelector('[aria-label="Open metadata"]')
  if (!marker) return false
  marker.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  return true
})
if (!opened) console.log('  (no metadata on that cell — trying the first marker)')
if (!opened) await page.locator('[aria-label="Open metadata"]').first().click()
await page.waitForTimeout(1000)
const drawerVisible = await page
  .locator('aside[aria-label="Observation metadata"]')
  .isVisible()
  .catch(() => false)
const cellsAfter = await page.locator('.dsg-cell').count()
const coordAfter = await coordLabel()

check('the metadata drawer opened', drawerVisible)
check('the grid is still mounted beside it', cellsAfter > 0, `${cellsBefore} → ${cellsAfter} cells`)
check(
  'the cell selection survived opening the drawer',
  coordAfter !== '' && coordAfter === coordBefore,
  `${coordBefore} → ${coordAfter}`,
)
check('no modal dialog is covering the grid', (await page.locator('[role="dialog"]').count()) === 0)
await shot('07-metadata-drawer')

/* ==========================================================================
   7. Clipboard — three modes, source named (UC031)
   ========================================================================== */

console.log('\n=== 7. Clipboard, three modes (UC031) ===')
await page.getByRole('button', { name: 'Copy range (Ctrl+C)' }).click()
await page.waitForTimeout(800)
await page.getByRole('button', { name: 'Paste (Ctrl+V)' }).click()
await page.waitForTimeout(900)
const pasteDialog = await page.getByRole('dialog').innerText().catch(() => '')
check(
  'all three paste modes are offered',
  /Values only/.test(pasteDialog) && /Formulas/.test(pasteDialog) && /Metadata/.test(pasteDialog),
)
check(
  'the source workbook is named, so a cross-workbook paste is visible',
  /Canada/.test(pasteDialog),
)
await shot('08-paste-modes')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)

/* ==========================================================================
   8. Series tools — preview before commit
   ========================================================================== */

console.log('\n=== 8. Series tools ===')
await page.getByRole('button', { name: 'Fill gaps and extrapolate' }).click()
await page.waitForTimeout(900)
const seriesDialog = await page.getByRole('dialog').innerText().catch(() => '')
check('the dialog previews before committing', /Preview/i.test(seriesDialog))
check('provenance is stamped on filled cells', /EST_METHOD/.test(seriesDialog))
await shot('09-series-tools')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)

/* ==========================================================================
   9. Bulk publishing status (UC024)
   ========================================================================== */

console.log('\n=== 9. Bulk publishing status (UC024) ===')
await page.getByRole('button', { name: 'Set publishing status in bulk' }).click()
await page.waitForTimeout(900)
const bulkDialog = await page.getByRole('dialog').innerText().catch(() => '')
check(
  'both UC024 scopes are offered',
  /selected range/i.test(bulkDialog) && /Everything in this workbook/i.test(bulkDialog),
)
await shot('10-bulk-status')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)

/* ==========================================================================
   9b. Version history on right-click (UC043/UC044)
   ========================================================================== */

console.log('\n=== 9b. Version history on right-click (UC043/UC044) ===')
await clickCell('HF.3.1', 2020)
await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.dsg-row:not(.dsg-row-header)')]
  const row = rows.find(
    (r) => r.querySelector('.dsg-cell-gutter')?.innerText.split('\n')[1] === 'HF.3.1',
  )
  const header = [...document.querySelectorAll('.dsg-row-header .dsg-cell')]
  const index = header.findIndex((h) => h.innerText.trim() === '2020')
  const cells = [...(row?.querySelectorAll('.dsg-cell:not(.dsg-cell-gutter)') ?? [])]
  cells[index - 1]
    ?.querySelector('div')
    ?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }))
})
await page.waitForTimeout(1400)
const versionDialog = await page.getByRole('dialog').innerText().catch(() => '')
check('right-click opens the version history', /Version history/i.test(versionDialog))
check('the UC044 10-version bound is stated', /10 prior versions/.test(versionDialog))
await shot('10b-versions')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)

/* ==========================================================================
   10. Filter chips reach the URL, and the link restores the workbook (§2.4)
   ========================================================================== */

console.log('\n=== 10. Filter chips → URL → shareable link (§2.4) ===')
await page.getByRole('button', { name: /Add filter/ }).click()
await page.waitForTimeout(600)
await page.getByRole('option', { name: /WHO region/ }).click()
await page.waitForTimeout(900)
const filteredUrl = page.url()
check(
  'the filter chip reached the URL',
  /f=country/.test(decodeURIComponent(filteredUrl)),
  decodeURIComponent(new URL(filteredUrl).search).slice(0, 90),
)
await shot('11-filter-chip')

const second = await ctx.newPage()
await second.goto(filteredUrl, { waitUntil: 'networkidle' })
await second.waitForTimeout(3000)
const restored = await second.locator('.dsg-cell-gutter').count()
check('pasting the link into a fresh tab restores the same workbook', restored > 3, `${restored} gutter cells`)
await second.close()

/* ==========================================================================
   11. Locking (UC033)
   ========================================================================== */

console.log('\n=== 11. Locking (UC033) ===')
await page.getByRole('button', { name: /Simulate 2nd user/ }).click()
await page.waitForTimeout(1000)
const lockText = await page.evaluate(() => document.body.innerText)
check(
  "the RFP's exact warning appears verbatim",
  lockText.includes(
    'This data set is being edited by another user, so it will be displayed in View Only mode.',
  ),
)
check(
  'the workbook goes read-only',
  await page.getByRole('button', { name: /Save to xMart/ }).isDisabled(),
)
await shot('12-locked')
await page.getByRole('button', { name: /Release lock/ }).click()
await page.waitForTimeout(700)

/* ==========================================================================
   12. Save to xMart (UC046)
   ========================================================================== */

console.log('\n=== 12. Save to xMart (UC046) ===')
await page.goto(FOCUS, { waitUntil: 'networkidle' })
await page.waitForTimeout(2800)
await clickCell('HF.3.1', 2018)
await formulaBar().fill('12345')
await formulaBar().press('Enter')
await page.waitForTimeout(1800)
await page.getByRole('button', { name: /Save to xMart/ }).click()
await page.waitForTimeout(2000)
const saveText = await page.evaluate(() => document.body.innerText)
check('the save reports a batch id', /batch \d+/.test(saveText), (saveText.match(/Saved[^\n]*/) ?? [''])[0])
check('the author is named in the payload (UC046)', /Author /.test(saveText))
await shot('13-saved')

/* ==========================================================================
   13. Dark theme
   ========================================================================== */

console.log('\n=== 13. Both themes ===')
await page.evaluate(() => {
  document.documentElement.classList.remove('light')
  document.documentElement.classList.add('dark')
})
await page.waitForTimeout(700)
await shot('14-dark')

/* ==========================================================================
   14. Regular user keeps view + export (UC007)
   ========================================================================== */

console.log('\n=== 14. Regular user (UC007) ===')
await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /DMS Regular User/ }).click()
await page.getByRole('heading', { name: 'Modules' }).waitFor()
await page.goto(FOCUS, { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
check('a regular user still sees the grid', (await page.locator('.dsg-cell').count()) > 0)
check(
  'export stays available to a regular user (UC007)',
  (await page.getByRole('button', { name: 'Export to Excel' }).count()) === 1,
)
await shot('15-regular-user', { fullPage: true })

console.log('\n=== console/page errors ===')
console.log(errors.length === 0 ? '  none' : errors.map((e) => '  ' + e).join('\n'))
console.log(`\nScreenshots → ${OUT}`)

await browser.close()
process.exit(errors.length === 0 ? 0 : 1)
