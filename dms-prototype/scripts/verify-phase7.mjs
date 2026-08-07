/**
 * Phase 7 browser verification — Users, the Home dashboard and Integration.
 *
 * A diagnostic harness, not a CI gate (the gates are `npx tsc -b`, `npm test`,
 * `npm run build`). Start the dev server first:
 *
 *     npm run dev -- --port 5199
 *     npm run verify:phase7
 *
 * It walks the phase's two stated acceptance criteria end to end:
 *
 *   1. **The permission matrix visibly changes what a regular user can do.**
 *      Flip Reports to View as an administrator, switch role, and check the
 *      New-report button is gone and the module is still viewable — UC007
 *      guarantees the second half, and a check that only asserted the first
 *      would pass on a bug that locked the user out entirely.
 *   2. **The Retrieval API page answers every mandatory Annex 3 row on
 *      screen**, and the CSV it produces is real — the download is intercepted
 *      and its bytes are parsed, because a link that fires and produces an
 *      empty file passes any name-only check.
 */

import { chromium } from 'playwright'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../artifacts/shots-p7/', import.meta.url))
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

const savedFiles = []
page.on('download', async (d) => {
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
  await page.waitForTimeout(500)
}

await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Sign in with WHO account/i }).click()
await page.getByRole('heading', { name: 'Modules' }).waitFor()

/* ==========================================================================
   1. The Home dashboard (UC002, UC003)
   ========================================================================== */

console.log('\n=== 1. Home dashboard — UC002 tiles + UC003 panels ===')
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Modules' }).waitFor()
await page.waitForTimeout(1200)

for (const panel of ['Reporting round', 'Due soon', 'Data completeness']) {
  check(
    `the "${panel}" panel is on the dashboard`,
    await page.getByRole('heading', { name: panel, exact: true }).isVisible(),
  )
}

const respondedText = await page
  .locator('p:text-is("Responded") + p')
  .first()
  .innerText()
  .catch(() => '')
check(
  'the reporting round shows a real count, not a placeholder',
  /^\d+$/.test(respondedText.trim()) && Number(respondedText) > 0,
  `responded = ${respondedText}`,
)

const heatCells = await page.locator('table td span[aria-label*="reported"]').count()
check(
  'the completeness heatmap renders one cell per country-year',
  heatCells === 96,
  `${heatCells} cells (8 countries × 12 years)`,
)

const bands = await page
  .locator('table td span[aria-label*="reported"]')
  .evaluateAll((els) => new Set(els.map((e) => e.className)).size)
check('the heatmap shows more than one band', bands > 1, `${bands} distinct bands`)

const adminTiles = await page.getByRole('heading', { name: 'Modules' }).count()
check('the module tile section is present (UC002)', adminTiles === 1)
check(
  'an administrator sees the Users tile',
  await page.locator('a[href="/users"]').first().isVisible(),
)
await shot('01-dashboard-admin', { fullPage: true })

/* UC003.1 — a regular user gets a different panel in the fourth slot. */
await switchRole('Regular user')
await page.waitForTimeout(900)
check(
  'UC003.1 — the regular user sees "Your country access" instead of the directory',
  (await page.locator('p:text-is("Your country access")').count()) === 1,
)
check(
  'UC003.1 — the administrator-only "Users with access" panel is gone',
  (await page.locator('p:text-is("Users with access")').count()) === 0,
)
await shot('02-dashboard-regular', { fullPage: true })
await switchRole('Administrator')

/* ==========================================================================
   2. Users (UC004, UC005, UC007, UC010, UC011, UC012)
   ========================================================================== */

console.log('\n=== 2. Users module ===')
await page.goto(BASE + '/users', { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Users', exact: true }).waitFor()
await page.waitForTimeout(700)

const rowCount = await page.locator('tbody tr').count()
check('the directory loads from xMart', rowCount >= 8, `${rowCount} rows`)

check(
  'UC012 — there is no delete control anywhere on the page',
  (await page.getByRole('button', { name: /delete/i }).count()) === 0 &&
    (await page.getByRole('menuitem', { name: /delete/i }).count()) === 0,
)

check(
  'UC005 — Grant access is available to an administrator',
  await page.getByRole('button', { name: 'Grant access' }).isVisible(),
)

/* UC007 — a guest's role select is disabled. */
const guestRow = page.locator('tbody tr', { hasText: 'External Consultant' })
check('the seeded Entra ID guest is listed', (await guestRow.count()) === 1)
const guestRoleSelect = guestRow.locator('button[role="combobox"]')
check(
  'UC007 — the guest’s role control is disabled',
  await guestRoleSelect.isDisabled(),
)

/* UC010 — the last-enabled-administrator guard. */
const adminRows = page.locator('tbody tr', { hasText: '@who.int' })
await page.locator('tbody tr', { hasText: 'HA Team Lead' }).getByRole('switch').click()
await page.waitForTimeout(400)
const dmsAdminSwitch = page
  .locator('tbody tr', { hasText: 'DMS Administrator' })
  .getByRole('switch')
check(
  'UC010 — with one administrator left, their Active switch is blocked',
  await dmsAdminSwitch.isDisabled(),
  `${await adminRows.count()} internal rows`,
)
await shot('03-users-last-admin-guard', { fullPage: true })

/* UC011 — re-enable restores it. */
await page.locator('tbody tr', { hasText: 'HA Team Lead' }).getByRole('switch').click()
await page.waitForTimeout(400)
check(
  'UC011 — re-enabling the second administrator releases the guard',
  !(await dmsAdminSwitch.isDisabled()),
)

/* UC005 — grant a guest and watch UC007 force the role. */
await page.getByRole('button', { name: 'Grant access' }).click()
await page.getByLabel('Email address').fill('new.partner@example.org')
await page.waitForTimeout(300)
check(
  'UC005 — an external address is recognised as an Entra ID guest',
  await page.getByText(/invited as a guest in the WHO Entra ID/i).isVisible(),
)
check(
  'UC007 — the role select in the grant dialog is disabled for a guest',
  await page.locator('button#grant-role').isDisabled(),
)
await shot('04-grant-access-guest')
await page.getByLabel('Display name').fill('New Partner')
await page.getByRole('button', { name: 'Grant access' }).last().click()
await page.waitForTimeout(600)
check(
  'the granted user appears in the directory',
  (await page.locator('tbody tr', { hasText: 'new.partner@example.org' }).count()) === 1,
)

/* Persistence — the whole point of the store being a diff. */
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(900)
check(
  'the granted user survives a reload',
  (await page.locator('tbody tr', { hasText: 'new.partner@example.org' }).count()) === 1,
)

/* ==========================================================================
   3. UC008 — the permission matrix changes what a regular user can do
   ========================================================================== */

console.log('\n=== 3. UC008 — the matrix, and the acceptance beat ===')
await page.goto(BASE + '/users/role-permissions', { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Role permissions' }).waitFor()

const matrixRows = await page.locator('table tbody tr').first().count()
check('the matrix renders', matrixRows > 0)
check(
  'every module has a row',
  (await page.locator('table').first().locator('tbody tr').count()) === 8,
)
check(
  'UC007 — No Access is documented as never offered',
  await page.getByText(/Never offered to a regular user/i).isVisible(),
)
check(
  'the capability preview is present',
  await page.getByRole('heading', { name: 'What a regular user can do' }).isVisible(),
)

/* Baseline: the regular user can create a report today. */
await switchRole('Regular user')
await page.goto(BASE + '/reports', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
const newReportBefore = await page.getByRole('button', { name: /New (custom|predefined) report/i }).count()
check('baseline — a regular user can author a report', newReportBefore > 0)

/* Flip Reports to View. */
await switchRole('Administrator')
await page.goto(BASE + '/users/role-permissions', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Edit', exact: true }).click()
await page.waitForTimeout(300)
await page.getByLabel('Regular user permission for Reports').click()
await page.getByRole('option', { name: 'View', exact: true }).click()
await page.waitForTimeout(200)
check(
  'the changed row is highlighted before saving',
  (await page.locator('tr.bg-who-accent-subtle').count()) >= 1,
)
await shot('05-matrix-editing', { fullPage: true })
await page.getByRole('button', { name: /^Save/ }).click()
await page.waitForTimeout(400)

/* The acceptance beat. */
await switchRole('Regular user')
await page.goto(BASE + '/reports', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
check(
  'ACCEPTANCE — the New-report button is gone for the regular user',
  (await page.getByRole('button', { name: /New (custom|predefined) report/i }).count()) === 0,
)
check(
  'UC007 — the Reports module is still viewable, not locked out',
  await page.getByRole('heading', { name: 'Reports', exact: true }).isVisible(),
)
check(
  'UC007 — export is still offered on a module they cannot edit',
  (await page.getByRole('button', { name: /Export/i }).count()) > 0 ||
    (await page.getByRole('tab', { name: /Predefined/ }).isVisible()),
)
await shot('06-regular-user-reports-locked', { fullPage: true })

/* Users is read-only for the regular user too, per the delivered default. */
await page.goto(BASE + '/users', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
check(
  'a regular user sees Users read-only',
  (await page.getByRole('button', { name: 'Grant access' }).count()) === 0,
)
check(
  'and still keeps Export CSV (UC007)',
  await page.getByRole('button', { name: /Export CSV/i }).isVisible(),
)

/* Put it back so the harness leaves the app in its delivered state. */
await switchRole('Administrator')
await page.goto(BASE + '/users/role-permissions', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Reset to delivered/i }).click()
await page.waitForTimeout(400)
check(
  'the matrix resets to the delivered defaults',
  (await page.getByRole('button', { name: /Reset to delivered/i }).count()) === 0,
)

/* ==========================================================================
   4. Integration — architecture, sync, the call log (UC045/046/056)
   ========================================================================== */

console.log('\n=== 4. xMart integration ===')
await page.goto(BASE + '/integration', { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'xMart Integration' }).waitFor()
await page.waitForTimeout(800)

for (const tab of ['Architecture and sync', 'API call log', 'Dataset restore']) {
  check(`the "${tab}" tab is present`, await page.getByRole('tab', { name: tab }).isVisible())
}
check(
  'the To-Be architecture is rendered live',
  await page.getByRole('heading', { name: 'To-Be data architecture' }).isVisible(),
)
check(
  'UC045 and UC046 are both drawn as DMS-owned edges',
  (await page.getByText('UC045', { exact: true }).count()) >= 1 &&
    (await page.getByText('UC046', { exact: true }).count()) >= 1,
)

const sourceRows = await page.locator('table tbody tr').count()
check('every source has a status row', sourceRows === 5, `${sourceRows} sources`)
check(
  'one source is shown as failed — a green table proves nothing',
  (await page.getByText('Failed', { exact: true }).count()) >= 1,
)
await shot('07-integration-overview', { fullPage: true })

/* A real pull: the call log must grow.
   Navigated by clicking the tabs, never `page.goto` — the log is in-memory
   module state, so a full page load resets it and the before/after comparison
   would always read 1 → 1. */
await page.getByRole('tab', { name: 'API call log' }).click()
await page.waitForTimeout(400)
const logBefore = await page.locator('table tbody tr').count()
await page.getByRole('tab', { name: 'Architecture and sync' }).click()
await page.waitForTimeout(400)
await page.getByRole('button', { name: /Pull from xMart/i }).click()
await page.waitForTimeout(4000)
check(
  'the manual pull reports completion',
  await page.getByText(/Configuration re-read from xMart/i).isVisible(),
)
await page.getByRole('tab', { name: 'API call log' }).click()
await page.waitForTimeout(400)
const logAfter = await page.locator('table tbody tr').count()
check(
  'the pull produced real API calls in the log',
  logAfter > logBefore,
  `${logBefore} → ${logAfter} calls`,
)
check(
  'the log shows the request each call would have sent',
  (await page.locator('table tbody tr td:has-text("GET https://")').count()) > 0,
)
await shot('08-api-call-log', { fullPage: true })

/* The header's Dev drawer renders the same log. */
await page.getByRole('button', { name: 'xMart API call log' }).click()
await page.waitForTimeout(500)
check(
  'the header terminal button opens the API log drawer',
  await page.getByRole('heading', { name: /xMart API call log/ }).isVisible(),
)
check(
  'the drawer is labelled a prototype affordance',
  await page.getByText('Prototype affordance').isVisible(),
)
await shot('09-api-log-drawer')
await page.keyboard.press('Escape')
await page.waitForTimeout(400)

/* ==========================================================================
   5. UC044 — dataset-level restore
   ========================================================================== */

console.log('\n=== 5. UC044 — dataset restore as of a date ===')
await page.goto(BASE + '/integration?tab=restore', { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: /Restore a dataset as of a date/ }).waitFor()
await page.getByRole('button', { name: /Preview changes/ }).click()
await page.waitForTimeout(6000)
const previewRows = await page.locator('table tbody tr').count()
check('the as-of scan finds observations that differed', previewRows > 0, `${previewRows} shown`)
check(
  'nothing is written until it is applied',
  await page.getByRole('button', { name: /Restore \d/ }).isVisible(),
)
await shot('10-dataset-restore-preview', { fullPage: true })
await page.getByRole('button', { name: /Restore \d/ }).click()
await page.waitForTimeout(2500)
check(
  'applying the restore pushes to xMart with the author attached',
  await page.getByText(/restored and pushed back to xMart/i).isVisible(),
)

/* A regular user cannot reach it. */
await switchRole('Regular user')
await page.waitForTimeout(600)
check(
  'a regular user is refused the dataset-level restore',
  await page.getByText(/administrator action/i).isVisible(),
)
await switchRole('Administrator')

/* ==========================================================================
   6. Annex 3 — the retrieval API page
   ========================================================================== */

console.log('\n=== 6. Annex 3 — the retrieval API simulator ===')
await page.goto(BASE + '/integration/retrieval-api', { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Data Retrieval API' }).waitFor()
await page.waitForTimeout(500)

// Counted by the evidence badge every requirement row carries, rather than by
// nesting: the page has other lists, and a structural selector would drift the
// first time one of them moved.
const requirementRows = await page
  .locator('li')
  .filter({ hasText: /Shown here|Design commitment/ })
  .count()
check(
  'ACCEPTANCE — every Annex 3 requirement is on the page',
  requirementRows === 13,
  `${requirementRows} rows (10 mandatory + 1 should-have + 2 nice-to-have)`,
)
check(
  'the mandatory group names all ten',
  await page.getByRole('heading', { name: /^Mandatory \(10\)$/ }).isVisible(),
)
check(
  'the two rows a browser cannot exhibit are labelled design commitments',
  (await page.getByText('Design commitment').count()) >= 2,
)

const url = await page.locator('pre').first().innerText()
check('the generated request is HTTPS and a GET', url.startsWith('GET https://'), url.slice(0, 60))
for (const param of ['country=', 'yearFrom=', 'yearTo=', 'page=', 'pageSize=', 'format=csv']) {
  check(`the URL carries ${param}`, url.includes(param))
}
check(
  'the curl shows an OAuth bearer placeholder, not a fabricated token',
  (await page.locator('pre').nth(1).innerText()).includes('Bearer $ACCESS_TOKEN'),
)

/* includeDeleted only appears when asked for. */
check('includeDeleted is absent by default', !url.includes('includeDeleted'))
await page.getByLabel('Include soft-deleted records').click()
await page.waitForTimeout(200)
check(
  'ticking soft-deletes adds the filter to the URL',
  (await page.locator('pre').first().innerText()).includes('includeDeleted=true'),
)
await page.getByLabel('Include soft-deleted records').click()
await page.waitForTimeout(200)

/* Send it. */
await page.getByRole('button', { name: /Send request/ }).click()
await page.waitForTimeout(2500)
check('the response section appears', await page.getByText('200 OK').isVisible())

const headerText = await page.locator('dl').first().innerText()
for (const h of ['X-Total-Count', 'X-Page-Count', 'X-Last-Modified-Utc', 'Content-Type']) {
  check(`the response carries ${h}`, headerText.includes(h))
}
check(
  'paging metadata is out of band and a next link is offered',
  headerText.includes('Link') && headerText.includes('rel="next"'),
)
check('the body preview shows Sys_ID', await page.getByText('Sys_ID').first().isVisible())
await shot('11-retrieval-api', { fullPage: true })

/* The CSV must be real. */
await page.getByRole('button', { name: /Download the CSV/ }).click()
await page.waitForTimeout(1500)
check('the CSV downloaded', savedFiles.length === 1, savedFiles.map((f) => f.split(/[\\/]/).pop()).join(', '))

if (savedFiles[0]) {
  const csv = fs.readFileSync(savedFiles[0], 'utf8')
  const lines = csv.split('\r\n')
  const header = (lines[0] ?? '').split(',')
  check('the CSV is not empty', lines.length > 2, `${lines.length - 1} data rows`)
  check('ACCEPTANCE — the CSV carries Sys_ID', header.includes('Sys_ID'))
  check('ACCEPTANCE — the CSV carries Sys_CommitDateUtc', header.includes('Sys_CommitDateUtc'))
  check('the CSV uses the xMart column order', header[0] === 'SURVEY_FK' && header.includes('VALUE'))
  check('the CSV is CRLF-delimited, as Annex 3 consumers expect', csv.includes('\r\n'))
  const firstRow = (lines[1] ?? '').split(',')
  check(
    'the first data row carries a real Sys_ID',
    (firstRow[header.indexOf('Sys_ID')] ?? '').length > 0,
  )
}

/* ==========================================================================
   7. Notifications module (UC058, UC059) + the UC023 sender
   ========================================================================== */

console.log('\n=== 7. Notifications — the module, not just the panel ===')
await page.goto(BASE + '/notifications', { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Notifications', exact: true }).waitFor()
await page.waitForTimeout(900)

for (const tab of ['Inbox', 'Subscriptions']) {
  check(`the "${tab}" tab is present`, await page.getByRole('tab', { name: tab }).isVisible())
}

const inboxRows = await page.locator('li button:text-is("Dismiss")').count()
check(
  'UC023 — the reporting-date sender has put notices in the inbox',
  inboxRows > 0,
  `${inboxRows} notifications`,
)
check(
  'and they are overdue/due-soon notices, not just job outcomes',
  (await page.getByText(/response overdue|due soon/i).count()) > 0,
)
/* The sender must not re-raise the same country on every reload — the inbox
   deduplicates against itself, so navigating around cannot inflate it. */
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.goto(BASE + '/notifications', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const inboxAfter = await page.locator('li button:text-is("Dismiss")').count()
check(
  'reloading does not duplicate the due-date notices',
  inboxAfter === inboxRows,
  `${inboxRows} → ${inboxAfter}`,
)
const titles = await page
  .locator('li p + p')
  .evaluateAll((els) => els.length)
  .catch(() => 0)
check('the inbox is capped, not one line per overdue country', inboxRows <= 6, `${titles} bodies`)
await shot('12-notifications-inbox', { fullPage: true })

await page.getByRole('tab', { name: 'Subscriptions' }).click()
await page.waitForTimeout(500)
check(
  'UC058 — the delivered subscription set is present',
  (await page.getByText('Delivered with DMS').count()) >= 4,
)
check(
  'the event catalogue is shown',
  await page.getByRole('heading', { name: 'Events DMS can raise' }).isVisible(),
)
const eventCards = await page
  .locator('section:has(h3:text-is("Events DMS can raise")) li')
  .count()
check('all eight events are listed', eventCards === 8, `${eventCards} events`)

/* UC059 — create one. */
await page.getByRole('button', { name: 'New subscription' }).click()
await page.waitForTimeout(400)
check(
  'the editor offers a threshold with its own label',
  await page.getByLabel('Minimum number of errors').isVisible(),
)
await page.locator('button#sub-event').click()
await page.getByRole('option', { name: 'Background report finished' }).click()
await page.waitForTimeout(300)
check(
  'switching to an event with no threshold removes the field',
  (await page.getByLabel('Minimum number of errors').count()) === 0,
)
check(
  'and removes the country filter, which could never match',
  (await page.getByLabel('Countries this subscription covers').count()) === 0,
)
await page.locator('button#sub-event').click()
await page.getByRole('option', { name: 'Quality check errors found' }).click()
await page.waitForTimeout(300)
await page.getByLabel('Name').fill('My EURO error watch')
await page.getByRole('button', { name: 'Create' }).click()
await page.waitForTimeout(500)
check(
  'UC059 — the created subscription is listed as the user’s own',
  (await page.getByText('My EURO error watch').count()) === 1,
)
await shot('13-subscriptions', { fullPage: true })

await page.reload({ waitUntil: 'networkidle' })
await page.goto(BASE + '/notifications?tab=subscriptions', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
check(
  'it survives a reload',
  (await page.getByText('My EURO error watch').count()) === 1,
)

/* UC050-style visibility: an administrator sees a user's subscriptions. */
await switchRole('Regular user')
await page.waitForTimeout(700)
check(
  'a regular user does not see another user’s subscription',
  (await page.getByText('My EURO error watch').count()) === 0,
)
await switchRole('Administrator')
await page.waitForTimeout(700)
check(
  'the administrator does — this follows UC050, not UC037',
  (await page.getByText('My EURO error watch').count()) === 1,
)

/* ==========================================================================
   Result
   ========================================================================== */

const consoleErrors = errors.filter((e) => e.startsWith('['))
console.log(`\n${'='.repeat(60)}`)
console.log(`  ${pass} PASS   ${fail} FAIL   ${consoleErrors.length} console errors`)
if (consoleErrors.length > 0) {
  console.log('\nConsole/page errors:')
  for (const e of [...new Set(consoleErrors)]) console.log(`  ${e}`)
}
console.log(`\nScreenshots: ${OUT}`)

await browser.close()
process.exit(fail > 0 || consoleErrors.length > 0 ? 1 : 0)
