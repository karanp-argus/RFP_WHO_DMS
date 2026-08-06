import { chromium } from 'playwright'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../artifacts/shots-p2/', import.meta.url))
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const BASE = process.env.DMS_URL ?? 'http://localhost:5199'

const errors = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`))
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

async function shot(name, opts = {}) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts })
}

async function signIn(which = 'admin') {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  if (which === 'admin') {
    await page.getByRole('button', { name: /Sign in with WHO account/i }).click()
  } else {
    await page.getByRole('button', { name: /DMS Regular User/ }).click()
  }
  await page.getByRole('heading', { name: 'Modules' }).waitFor()
}

console.log('=== ADMIN: every Setup tab renders ===')
await signIn('admin')
const TABS = ['countries', 'currencies', 'classifications', 'crosses', 'metadata', 'formulas', 'reporting']
for (const tab of TABS) {
  await page.goto(`${BASE}/setup?tab=${tab}`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Setup', level: 2 }).waitFor()
  // Wait for the tab's loading state to clear.
  await page.waitForFunction(
    () => !document.body.textContent.includes('Loading') || document.querySelectorAll('table,section').length > 0,
    { timeout: 8000 },
  ).catch(() => {})
  await page.waitForTimeout(700)
  const bodyText = await page.evaluate(() => document.body.innerText)
  const stillLoading = /Loading .* from xMart/.test(bodyText)
  const rowCount = await page.locator('tbody tr').count()
  console.log(`  ${tab.padEnd(16)} loading=${stillLoading}  tbody rows=${rowCount}  chars=${bodyText.length}`)
  await shot(`tab-${tab}`, { fullPage: true })
}

console.log('\n=== Countries: 194 rows, pagination, search ===')
await page.goto(`${BASE}/setup?tab=countries`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
const recordLine = await page.locator('text=/\\d+ records?/').first().innerText().catch(() => 'n/a')
console.log('  record count line:', recordLine)
const headers = await page.locator('thead th').allInnerTexts()
console.log('  columns:', headers.length, '→', headers.slice(0, 5).map(h => h.trim()).join(' | '))
await page.getByPlaceholder('Search countries').fill('kenya')
await page.waitForTimeout(400)
console.log('  after search "kenya":', await page.locator('tbody tr').count(), 'row(s)')
await shot('countries-search')
await page.getByPlaceholder('Search countries').fill('')

console.log('\n=== UC015: drag a column header and confirm it persists ===')
const before = (await page.locator('thead th').allInnerTexts()).map(s => s.trim().split('\n')[0])
console.log('  before:', before.slice(0, 4).join(' | '))
// Drag the 3rd header (WHO region) onto the 1st (ISO3 code) using the grip handle.
const grips = page.locator('thead th button[aria-label="Reorder column"]')
const src = grips.nth(2)
const dst = grips.nth(0)
const sb = await src.boundingBox()
const db = await dst.boundingBox()
if (sb && db) {
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2)
  await page.mouse.down()
  // dnd-kit needs intermediate moves to register the drag.
  await page.mouse.move(db.x + db.width / 2 + 40, db.y + db.height / 2, { steps: 12 })
  await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(500)
}
const after = (await page.locator('thead th').allInnerTexts()).map(s => s.trim().split('\n')[0])
console.log('  after: ', after.slice(0, 4).join(' | '))
console.log('  order changed:', JSON.stringify(before) !== JSON.stringify(after))
const stored = await page.evaluate(() => localStorage.getItem('dms-setup'))
console.log('  persisted to localStorage:', stored ? stored.slice(0, 110) + '…' : 'NOTHING')
await shot('countries-reordered')

// Reload and confirm the order survives (the UC015 acceptance criterion).
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const afterReload = (await page.locator('thead th').allInnerTexts()).map(s => s.trim().split('\n')[0])
console.log('  after reload:', afterReload.slice(0, 4).join(' | '))
console.log('  SURVIVED RELOAD:', JSON.stringify(after) === JSON.stringify(afterReload))

console.log('\n=== Formulas: 16 + legacy, conditions, country override ===')
await page.goto(`${BASE}/setup?tab=formulas`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const formulaText = await page.evaluate(() => document.body.innerText)
for (const probe of ['CHE%GDP_SHA2011', 'HF.1 + HF.2 + HF.3 + HF.4 + HF.nec', 'at least one component not null', 'AGGREGATES', 'FINANCING SOURCES', '1 country override']) {
  console.log(`  ${formulaText.includes(probe) ? 'PASS' : 'FAIL'}  "${probe}"`)
}
await shot('formulas', { fullPage: true })
// Legacy sub-tab
await page.getByRole('tab', { name: /Old DMS/ }).click()
await page.waitForTimeout(400)
const legacyText = await page.evaluate(() => document.body.innerText)
console.log(`  ${legacyText.includes('@SUM(HF1:HF4)') ? 'PASS' : 'FAIL'}  legacy syntax shown verbatim`)
await shot('formulas-legacy')

console.log('\n=== Crosses: builder derives notation ===')
await page.goto(`${BASE}/setup?tab=crosses`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.getByRole('button', { name: 'New cross' }).click()
await page.getByRole('dialog').waitFor()
// Pick a member in each of the two default dimensions (HC and HF).
const selects = page.getByRole('dialog').getByRole('combobox')
await selects.nth(1).click()
await page.getByRole('option').first().click()
await page.waitForTimeout(200)
await selects.nth(3).click()
await page.getByRole('option').first().click()
await page.waitForTimeout(300)
const dlgText = await page.getByRole('dialog').innerText()
const notation = dlgText.match(/Notation:\s*(\S+)/)
console.log('  derived notation:', notation ? notation[1] : 'NOT SHOWN')
await shot('cross-builder')
await page.keyboard.press('Escape')

console.log('\n=== REGULAR USER: read-only (UC013) ===')
await ctx.clearCookies()
await page.evaluate(() => localStorage.clear())
await signIn('regular')
await page.goto(`${BASE}/setup?tab=countries`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const rText = await page.evaluate(() => document.body.innerText)
console.log('  "View and export only" badge:', rText.includes('View and export only'))
console.log('  "New country" button count:', await page.getByRole('button', { name: /New country/ }).count(), '(expect 0)')
console.log('  "Attributes" button count:', await page.getByRole('button', { name: 'Attributes' }).count(), '(expect 0)')
console.log('  Export CSV still available:', (await page.getByRole('button', { name: 'Export CSV' }).count()) > 0)
console.log('  grip handles (no reorder):', await page.locator('thead th button[aria-label="Reorder column"]').count(), '(expect 0)')
await shot('regular-countries', { fullPage: true })

console.log('\n=== dark theme spot-check ===')
await page.evaluate(() => localStorage.setItem('dms-theme', 'dark'))
await page.goto(`${BASE}/setup?tab=formulas`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await shot('formulas-dark', { fullPage: true })

await browser.close()
console.log('\n=== errors ===')
console.log(errors.length ? [...new Set(errors)].join('\n') : 'none')
