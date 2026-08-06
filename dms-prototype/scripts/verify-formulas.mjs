/**
 * Phase 3 browser verification — the formula engine on the Setup → Formulas tab.
 *
 * A diagnostic harness, not a CI gate (the gates are `npx tsc -b`, `npm test`,
 * `npm run build`). Start the dev server first:
 *
 *     npm run dev -- --port 5199
 *     npm run verify:formulas
 *
 * It checks the four acceptance criteria of plan §Phase 3 as a user would see
 * them: every seeded formula shows a value for a real country-year, the nested
 * chain is visible in the inspector, a failed null guard renders blank rather
 * than 0, and a deliberate cycle is reported rather than hanging the page.
 */

import { chromium } from 'playwright'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../artifacts/shots-p3/', import.meta.url))
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const BASE = process.env.DMS_URL ?? 'http://localhost:5199'

const errors = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`))
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

const shot = async (name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.png`, ...opts })

await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Sign in with WHO account/i }).click()
await page.getByRole('heading', { name: 'Modules' }).waitFor()

await page.goto(`${BASE}/setup?tab=formulas`, { waitUntil: 'networkidle' })
await page.getByText('formulas, no cycles').waitFor({ timeout: 15000 })
await page.waitForTimeout(600)

console.log('=== 1. Every seeded formula evaluates for Canada 2022 ===')
const rows = await page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll('section > div > div')) {
    const code = el.querySelector('span.font-mono')?.textContent?.trim()
    const value = el.querySelector('div.w-32 p')?.textContent?.trim()
    const note = el.querySelectorAll('div.w-32 p')[1]?.textContent?.trim()
    if (code && value) out.push({ code, value, note })
  }
  return out
})
for (const r of rows) console.log(`  ${r.code.padEnd(24)} ${r.value.padStart(12)}   ${r.note ?? ''}`)
const blanks = rows.filter((r) => r.value === '—')
console.log(`  → ${rows.length} formulas rendered, ${blanks.length} blank`)
if (rows.length !== 16) errors.push(`expected 16 formula rows, saw ${rows.length}`)
if (rows.some((r) => r.value === '0' && /guard failed/.test(r.note ?? ''))) {
  errors.push('a failed guard rendered as 0 instead of blank')
}
await shot('formulas-evaluated', { fullPage: true })

console.log('\n=== 2. Nested chain CHE%GDP → CHE → HF.* in the inspector ===')
const cheGdpRow = page.locator('div', { hasText: /^CHE%GDP_SHA2011/ }).first()
await cheGdpRow.getByRole('button', { name: 'Inspect' }).click()
await page.getByRole('dialog').waitFor()
await page.waitForTimeout(300)
const inspector = await page.getByRole('dialog').innerText()
console.log('  chain shown:', /CHE\s*→\s*CHE%GDP_SHA2011/.test(inspector.replace(/\n/g, ' ')))
console.log('  AST shown  :', /parsed syntax tree/i.test(inspector))
console.log('  inputs     :', /inputs read/i.test(inspector))
if (!/parsed syntax tree/i.test(inspector)) errors.push('inspector did not render the AST')
if (!/computed by a formula/.test(inspector)) errors.push('inspector did not label CHE as computed')
await shot('inspector-che-gdp')
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

console.log('\n=== 3. Dependency graph, topologically ordered, no cycles ===')
await page.getByRole('button', { name: /Dependency graph/ }).click()
await page.getByRole('dialog').waitFor()
await page.waitForTimeout(300)
const graph = await page.getByRole('dialog').innerText()
const order = [...graph.matchAll(/\n(\d+)\n([^\n]+)/g)].map((m) => m[2])
console.log('  order:', order.join(' · '))
console.log('  acyclic banner:', /No circular references/.test(graph))
if (!/No circular references/.test(graph)) errors.push('graph reported cycles in the seeded set')
if (order.indexOf('CHE') > order.indexOf('CHE%GDP_SHA2011')) {
  errors.push('CHE was not ordered before CHE%GDP_SHA2011')
}
await shot('dependency-graph')
await page.keyboard.press('Escape')
await page.waitForTimeout(300)

console.log('\n=== 4. A deliberate cycle is reported, not entered ===')
await page.getByRole('button', { name: 'New formula' }).click()
await page.getByRole('dialog').waitFor()
await page.getByLabel('Indicator code').fill('CHE')
await page.getByLabel('Indicator name').fill('Deliberate cycle')
await page.getByLabel('Expression').fill('CHE%GDP_SHA2011 * GDP / 100')
await page.waitForTimeout(500)
const editor = await page.getByRole('dialog').innerText()
const cycleReported = /Circular reference/.test(editor)
const saveDisabled = await page.getByRole('button', { name: /Create formula/ }).isDisabled()
console.log('  cycle reported in the editor:', cycleReported)
console.log('  save blocked                :', saveDisabled)
if (!cycleReported) errors.push('the editor did not report the deliberate cycle')
if (!saveDisabled) errors.push('the editor allowed a circular formula to be saved')
await shot('cycle-reported')

console.log('\n=== 5. Unknown reference and syntax error ===')
await page.getByLabel('Expression').fill('HF.3 / NOT_A_VARIABLE')
await page.waitForTimeout(400)
console.log('  unknown code flagged:', /Unknown code/.test(await page.getByRole('dialog').innerText()))
await page.getByLabel('Expression').fill('HF.3 / (CHE')
await page.waitForTimeout(400)
console.log('  syntax error flagged:', /Missing/.test(await page.getByRole('dialog').innerText()))
// A fresh code: `CHE` from step 4 would self-reference and correctly cycle.
await page.getByLabel('Indicator code').fill('OOPS_TEST')
await page.getByLabel('Expression').fill('HF.3 / CHE * 100')
await page.waitForTimeout(400)
console.log('  valid expression ok :', /Parses cleanly/.test(await page.getByRole('dialog').innerText()))
await shot('editor-validation')
await page.keyboard.press('Escape')

console.log('\n=== 6. Regular user keeps view + export, loses edit (UC007) ===')
await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /DMS Regular User/ }).click()
await page.getByRole('heading', { name: 'Modules' }).waitFor()
await page.goto(`${BASE}/setup?tab=formulas`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const readOnly = await page.evaluate(() => document.body.innerText)
console.log('  Export CSV present :', /Export CSV/.test(readOnly))
console.log('  Inspect present    :', /Inspect/.test(readOnly))
console.log('  New formula hidden :', !/New formula/.test(readOnly))
await shot('regular-user', { fullPage: true })

console.log('\n=== console/page errors ===')
console.log(errors.length === 0 ? '  none' : errors.map((e) => '  ' + e).join('\n'))
console.log(`\nScreenshots → ${OUT}`)

await browser.close()
process.exit(errors.length === 0 ? 0 : 1)
