/**
 * Phase 5 browser verification — the Quality Checks module and UC052.
 *
 * A diagnostic harness, not a CI gate (the gates are `npx tsc -b`, `npm test`,
 * `npm run build`). Start the dev server first:
 *
 *     npm run dev -- --port 5199
 *     npm run verify:qc
 *
 * It walks the phase's acceptance path as a user would: the rule list with its
 * three origins visibly distinct, a run over the demo scope producing findings
 * that trace to the Phase 1 defects, the report's tiles / scatter / table, the
 * UC048 exclusion round trip, the UC054 thresholds actually changing a verdict,
 * and — the one that matters most — running from a workbook and seeing the
 * offending cells ringed in the grid.
 */

import { chromium } from 'playwright'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../artifacts/shots-p5/', import.meta.url))
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
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1150 } })
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`))
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

const shot = (name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.png`, ...opts })

await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Sign in with WHO account/i }).click()
await page.getByRole('heading', { name: 'Modules' }).waitFor()

/* ==========================================================================
   1. The rule list (UC047, UC053)
   ========================================================================== */

console.log('\n=== 1. Rule list — UC053 origins visibly distinct ===')
await page.goto(`${BASE}/quality-checks`, { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Quality Checks' }).waitFor()
await page.waitForTimeout(400)

const originCounts = await page.evaluate(() => {
  const counts = {}
  for (const el of document.querySelectorAll('[data-qc-origin]')) {
    const t = el.dataset.qcOrigin
    counts[t] = (counts[t] ?? 0) + 1
  }
  return counts
})
check('developer-authored rules are badged', (originCounts.dev ?? 0) >= 15, `${originCounts.dev ?? 0} rows`)
check('an administrator rule is badged differently', (originCounts.admin ?? 0) >= 1)
check('a custom rule is badged differently', (originCounts.user ?? 0) >= 1)

// The three badges must not merely differ in text — UC053 says colour/flag.
const distinctStyles = await page.evaluate(() => {
  const style = (origin) => {
    const el = document.querySelector(`[data-qc-origin="${origin}"]`)
    if (!el) return null
    const c = getComputedStyle(el)
    return `${c.backgroundColor}|${c.color}|${c.borderColor}`
  }
  return [style('dev'), style('admin'), style('user')]
})
check(
  'the three origins render in three different styles',
  new Set(distinctStyles.filter(Boolean)).size === 3,
  distinctStyles.join(' / '),
)

const groupHeadings = await page.evaluate(() =>
  [...document.querySelectorAll('section h3')].map((h) => h.textContent.trim().split('\n')[0]),
)
check(
  'rules are grouped by what they check',
  ['Growth', 'Reporting continuity', 'Consistency', 'Plausibility'].every((g) =>
    groupHeadings.some((h) => h.startsWith(g)),
  ),
  groupHeadings.join(', '),
)
check(
  'UC048 exclusions are visible on the rule that ships with them',
  await page.getByText(/\d+ excluded/).first().isVisible(),
)
await shot('01-rule-list', { fullPage: true })

/* ==========================================================================
   2. UC054 thresholds
   ========================================================================== */

console.log('\n=== 2. Thresholds tab (UC054) ===')
await page.getByRole('tab', { name: /Thresholds/ }).click()
await page.waitForTimeout(400)
const thresholdRows = await page.evaluate(
  () => document.querySelectorAll('input[id^="warn-"]').length,
)
check('every rule category is configurable', thresholdRows === 10, `${thresholdRows} categories`)
check(
  'each threshold states its unit',
  await page.getByText('% change year on year').first().isVisible(),
)
check(
  'pass is shown but not editable',
  (await page.getByText('Pass', { exact: true }).count()) > 0 &&
    (await page.locator('input[id^="pass-"]').count()) === 0,
)
await shot('02-thresholds', { fullPage: true })

/* ==========================================================================
   3. A run over the demo scope (UC047, UC055)
   ========================================================================== */

console.log('\n=== 3. Run the delivered set over the demo scope ===')
await page.getByRole('tab', { name: /Rules/ }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: 'Run quality checks' }).click()
await page.getByRole('dialog').waitFor()
check(
  'the run dialog offers a country-group scope (the FR’s own example)',
  await page.getByText('By country group').isVisible(),
)
check(
  'the demo scope is labelled as a prototype affordance',
  await page.getByRole('dialog').getByText('Prototype').isVisible(),
)
await shot('03-run-dialog')

await page.getByRole('button', { name: /^Run over \d+ countr/ }).click()
await page.waitForURL(/\/quality-checks\/reports\//, { timeout: 90_000 })
await page.getByRole('heading', { name: 'Quality check report' }).waitFor()
await page.waitForTimeout(800)

const tiles = await page.evaluate(() => {
  const out = {}
  for (const card of document.querySelectorAll('[data-slot="card"]')) {
    const label = card.querySelector('p')?.textContent?.trim()
    const value = card.querySelectorAll('p')[1]?.textContent?.trim()
    if (label && value) out[label] = value
  }
  return out
})
console.log('  tiles:', JSON.stringify(tiles))
const failures = Number((tiles['Failures'] ?? '0').replace(/,/g, ''))
const warnings = Number((tiles['Warnings'] ?? '0').replace(/,/g, ''))
check('the run produced failures', failures > 0, `${failures}`)
check('the run produced warnings', warnings > 0, `${warnings}`)
check('the report says how many values it checked', /[\d,]+/.test(tiles['Values checked'] ?? ''))
check('the report says which rules found nothing', /\d+ \/ \d+/.test(tiles['Rules clean'] ?? ''))
await shot('04-report-top', { fullPage: false })

/* ==========================================================================
   4. Findings trace back to the Phase 1 defects
   ========================================================================== */

console.log('\n=== 4. Findings trace to the planted defects ===')
const traced = await page.evaluate(() => {
  const text = document.body.innerText
  return {
    argentina: /Out-of-pocket spend up ~380% YoY/.test(text),
    kenya: /Voluntary health insurance not reported 2014/.test(text),
  }
})
// The table is paged, so search rather than relying on the first page.
const search = page.getByPlaceholder(/Search findings/)
await search.fill('Kenya')
await page.waitForTimeout(400)
const kenyaRows = await page.locator('tbody tr').count()
check('a Kenya finding is reachable by search', kenyaRows > 0, `${kenyaRows} rows`)
const kenyaText = await page.locator('tbody').innerText()
check(
  'the Kenya gap finding carries its seeded note',
  /Voluntary health insurance not reported/.test(kenyaText),
)
check(
  'the finding names the years that are missing',
  /2014.2016/.test(kenyaText),
  kenyaText.split('\n').find((l) => /has no value/.test(l)) ?? '',
)
await shot('05-finding-kenya')

await search.fill('Bolivia')
await page.waitForTimeout(400)
const bolText = await page.locator('tbody').innerText()
check(
  'the negative-value defect is reported as a failure',
  /Negative revenue reported/.test(bolText) && /Fail/.test(bolText),
)

await search.fill('South Africa')
await page.waitForTimeout(400)
const zafText = await page.locator('tbody').innerText()
check(
  'the outlier defect is caught by the group-outlier rule',
  /Government health expenditure moved/.test(zafText),
)
check('the outlier finding carries its seeded note', /far below UMC peers/.test(zafText))
await shot('06-finding-outlier')

await search.fill('')
await page.waitForTimeout(400)

/* ==========================================================================
   5. Visualisation and download (UC055)
   ========================================================================== */

console.log('\n=== 5. Visualise and download ===')
const svgPoints = await page.evaluate(
  () => document.querySelectorAll('.recharts-scatter-symbol').length,
)
check('the outlier scatter renders points', svgPoints > 0, `${svgPoints} points`)

// Filtering to one rule draws its thresholds in.
await page.getByLabel('Filter by rule').click()
await page.waitForTimeout(200)
await page.getByRole('option').nth(1).click()
await page.waitForTimeout(600)
const refLines = await page.evaluate(
  () => document.querySelectorAll('.recharts-reference-line').length,
)
check('threshold lines appear once a single rule is selected', refLines > 0, `${refLines} lines`)
await shot('07-scatter', { fullPage: false })

const csv = page.waitForEvent('download')
await page.getByRole('button', { name: 'CSV', exact: true }).click()
const csvFile = await csv
check('the report downloads as .csv', /\.csv$/.test(csvFile.suggestedFilename()), csvFile.suggestedFilename())

const xlsx = page.waitForEvent('download')
await page.getByRole('button', { name: 'Excel' }).click()
const xlsxFile = await xlsx
check('the report downloads as .xlsx', /\.xlsx$/.test(xlsxFile.suggestedFilename()), xlsxFile.suggestedFilename())

/* ==========================================================================
   6. Report history (UC055)
   ========================================================================== */

console.log('\n=== 6. Report history ===')
await page.goto(`${BASE}/quality-checks?tab=reports`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const historyRows = await page.locator('ul > li > a[href*="/reports/"]').count()
check('the run is in the history', historyRows >= 1, `${historyRows} entries`)
await shot('08-history')

/* ==========================================================================
   7. UC048 — exclusions, and the one-click reset
   ========================================================================== */

console.log('\n=== 7. UC048 exclusions round trip ===')
await page.goto(`${BASE}/quality-checks/rules/qc-yoy-rel-oop`, { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: /Out-of-pocket/ }).waitFor()
await page.waitForTimeout(300)
check(
  'the editor has a country exclusion picker',
  await page.getByText('Countries this rule skips').isVisible(),
)
// Exclude one country.
await page.getByRole('combobox', { name: 'Countries excluded from this rule' }).click()
await page.getByPlaceholder(/Search by name or ISO3/).fill('Argentina')
await page.waitForTimeout(300)
await page.getByRole('option').first().click()
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
check('a country can be excluded', await page.getByText('Clear all (1)').isVisible())
await shot('09-exclusions')

await page.getByRole('button', { name: /Clear all \(1\)/ }).click()
await page.waitForTimeout(300)
check(
  'exclusions clear in one click (UC048 acceptance)',
  (await page.getByText('Clear all (1)').count()) === 0,
)

/* ==========================================================================
   8. UC054 — a threshold change moves a verdict
   ========================================================================== */

console.log('\n=== 8. A threshold change changes the outcome ===')
await page.goto(`${BASE}/quality-checks?tab=thresholds`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
const warnInput = page.locator('#warn-atypical-entry')
const failInput = page.locator('#fail-atypical-entry')
await failInput.fill('1')
await failInput.blur()
await page.waitForTimeout(300)
// `exact` matters: the loose matcher also catches the "NCU millions of change"
// unit hint further down the page.
const changedBadge = page.getByText('Changed', { exact: true })
check('the changed category is flagged', await changedBadge.first().isVisible())
check('the delivered value is still shown for comparison', await page.getByText(/Delivered: 1 \/ 2/).isVisible())
await shot('10-threshold-changed')

await page.getByRole('button', { name: /Reset all/ }).click()
await page.waitForTimeout(300)
check('thresholds reset to the delivered values', (await changedBadge.count()) === 0)
await warnInput.waitFor()

/* ==========================================================================
   9. UC052 — run from a workbook, cells ring
   ========================================================================== */

console.log('\n=== 9. UC052 — quality checks from the workbook ===')
await page.goto(
  `${BASE}/workbooks/view?c=KEN&v=HF.1,HF.1.1,HF.1.2,HF.1.2.1,HF.2,HF.2.1,HF.2.2,HF.2.3,HF.3,HF.3.1&y=2010-2020&t=country`,
  { waitUntil: 'networkidle' },
)
await page.getByText(/rows × .* columns/).waitFor({ timeout: 20000 })
await page.waitForTimeout(800)

const cellsBefore = await page.evaluate(
  () => document.querySelectorAll('.dsg-cell').length,
)
await page.getByRole('button', { name: 'Run quality checks on this workbook' }).click()
await page.getByRole('region', { name: 'Quality check findings' }).waitFor({ timeout: 90_000 })
await page.waitForTimeout(1000)

check('the findings panel opens beside the data, not over it', true)
const cellsAfter = await page.evaluate(() => document.querySelectorAll('.dsg-cell').length)
check(
  'the grid stays mounted while the findings are shown',
  cellsAfter === cellsBefore && cellsAfter > 0,
  `${cellsBefore} → ${cellsAfter} cells`,
)

const ringed = await page.evaluate(() => {
  let error = 0
  let warning = 0
  for (const el of document.querySelectorAll('.dsg-cell div[title]')) {
    const cls = el.className
    if (cls.includes('ring-who-fail')) error++
    else if (cls.includes('ring-who-warn')) warning++
  }
  return { error, warning }
})
check(
  'offending cells are ringed in the grid (UC052)',
  ringed.error + ringed.warning > 0,
  `${ringed.error} red, ${ringed.warning} amber`,
)

const panelText = await page.getByRole('region', { name: 'Quality check findings' }).innerText()
check('the panel names the applicable rules', /applicable rule/.test(panelText))
check('the panel says how many values were checked', /values checked/.test(panelText))
check(
  'a finding in the panel carries its seeded note',
  /Voluntary health insurance not reported/.test(panelText),
  panelText.split('\n').find((l) => /Voluntary/.test(l)) ?? '(not on this workbook)',
)
await shot('11-workbook-findings', { fullPage: false })

// Selecting a finding moves the grid's active cell rather than navigating away.
const urlBefore = page.url()
await page.getByRole('region', { name: 'Quality check findings' }).locator('button').filter({ hasText: /KEN/ }).first().click()
await page.waitForTimeout(500)
check('selecting a finding keeps you on the workbook', page.url() === urlBefore)
const stillMounted = await page.evaluate(() => document.querySelectorAll('.dsg-cell').length)
check('selecting a finding does not unmount the grid', stillMounted === cellsBefore)
await shot('12-workbook-finding-selected')

check(
  'the panel links to the full report',
  await page.getByRole('link', { name: /Full report/ }).isVisible(),
)

/* ==========================================================================
   10. Regular users keep view + export (UC007)
   ========================================================================== */

console.log('\n=== 10. Regular user — view and export, no editing (UC007) ===')
await page.goto(`${BASE}/quality-checks`, { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const roleSwitcher = page.getByRole('button', { name: /Administrator|Regular user/ }).first()
await roleSwitcher.click()
await page.getByRole('menuitem', { name: /Regular user/ }).click()
await page.waitForTimeout(600)

check(
  'a regular user can still run the checks',
  await page.getByRole('button', { name: 'Run quality checks' }).isEnabled(),
)
check(
  'a regular user can still export the rule set',
  await page.getByRole('button', { name: 'Export rules' }).isVisible(),
)
// UC050 is written from a regular user's point of view: they DO create rules,
// and theirs are private to them. What they must not be able to do is change
// the delivered set or the thresholds everyone else is judged against.
check(
  'a regular user can create their own rules (UC050)',
  await page.getByRole('button', { name: 'New rule' }).isVisible(),
)
check(
  'a regular user cannot import over the delivered rule set',
  (await page.getByRole('button', { name: 'Import rules' }).count()) === 0,
)
check(
  'a regular user cannot edit a delivered rule',
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('li')].find((li) =>
      li.textContent.includes('Out-of-pocket payment jumps year on year'),
    )
    return row ? row.querySelector('button[role="switch"]')?.disabled === true : false
  }),
)
check(
  'the split between the two rights is explained',
  await page.getByText(/stay private to you \(UC050\)/).isVisible(),
)

// UC054 is administrator-only.
await page.goto(`${BASE}/quality-checks?tab=thresholds`, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
check(
  'a regular user cannot change the thresholds (UC054)',
  await page.locator('#warn-yoy-relative').isDisabled(),
)
check(
  'the thresholds tab explains why it is read-only',
  await page.getByText(/administrator-configurable \(UC054\)/).isVisible(),
)
await shot('13-regular-user', { fullPage: true })

/* ==========================================================================
   Result
   ========================================================================== */

const consoleErrors = errors.filter((e) => e.startsWith('['))
console.log(`\n${'='.repeat(60)}`)
console.log(`  ${pass} PASS, ${fail} FAIL, ${consoleErrors.length} console errors`)
if (consoleErrors.length > 0) for (const e of consoleErrors) console.log(`  ${e}`)
console.log(`  screenshots → artifacts/shots-p5/`)
console.log('='.repeat(60))

await browser.close()
process.exit(fail > 0 || consoleErrors.length > 0 ? 1 : 0)
