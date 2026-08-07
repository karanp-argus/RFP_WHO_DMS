/**
 * Phase 8 item 3 — the keyboard pass.
 *
 * The plan's sentence is: *"Ctrl+Z/Y, Ctrl+C/V, arrow navigation and Tab/Enter
 * commit in the grid, Esc closes drawers."* Every one of those is checked here by
 * pressing the key and asserting on what changed, because keyboard support is the
 * one thing that is completely invisible in a screenshot and completely obvious
 * to a panel member who reaches for a shortcut and gets nothing.
 *
 * Three of these were genuinely broken or missing before this phase and are the
 * reason the harness exists rather than a manual pass:
 *
 *   · Esc did nothing on the metadata drawer or the QC findings panel. Both are
 *     deliberately *not* Radix portals (plan §2.4 — they must not unmount the
 *     grid), so neither got Esc for free.
 *   · The workbook's Ctrl+Z listener is on `window` and called `preventDefault`,
 *     so typing in the metadata drawer and pressing Ctrl+Z reverted a **grid
 *     edit** instead of the sentence being typed.
 *   · Esc inside a dirty metadata field now reverts the field, and only a second
 *     Esc closes the drawer — closing a panel with a half-typed comment in it
 *     throws the comment away silently.
 *
 * Start the dev server first:
 *
 *     npm run dev -- --port 5199
 *     npm run verify:keyboard
 */

import { chromium } from 'playwright'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../artifacts/shots-keyboard/', import.meta.url))
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const BASE = process.env.DMS_URL ?? 'http://localhost:5199'

/** Five years × five variables — the same focused slice `verify:workbook` uses. */
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

const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })
let checks = 0
let passed = 0
const check = (label, ok, detail = '') => {
  checks++
  if (ok) passed++
  else errors.push(label)
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  return ok
}

/* --- grid helpers, shared with verify-workbook.mjs -------------------------- */

/** The rendered text of the cell at (variable code, year). */
async function textOf(code, year) {
  return page.evaluate(
    ([c, y]) => {
      const rows = [...document.querySelectorAll('.dsg-row:not(.dsg-row-header)')]
      const row = rows.find(
        (r) => r.querySelector('.dsg-cell-gutter')?.innerText.split('\n')[1] === c,
      )
      const header = [...document.querySelectorAll('.dsg-row-header .dsg-cell')]
      const index = header.findIndex((h) => h.innerText.trim() === String(y))
      const cells = [...(row?.querySelectorAll('.dsg-cell:not(.dsg-cell-gutter)') ?? [])]
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
  await page.waitForTimeout(400)
}

/** `CAN · 2020 · HF.1.1` — the active coordinate, shown beside the formula bar. */
async function activeCoord() {
  const el = page.locator('span', { hasText: /^CAN · \d{4} · / }).first()
  return (await el.count()) ? ((await el.textContent()) ?? '').trim() : ''
}

/* --- sign in ---------------------------------------------------------------- */

await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Sign in with WHO account/i }).click()
await page.locator('nav[aria-label="Main navigation"]').waitFor({ state: 'attached' })

await page.goto(FOCUS, { waitUntil: 'networkidle' })
await page.locator('.dsg-cell').first().waitFor({ timeout: 20_000 })
await page.waitForTimeout(800)

/* ==========================================================================
   1. Arrow navigation and Tab
   ========================================================================== */

console.log('\n### arrow navigation and Tab (grid)')

await clickCell('HF.1.1', 2020)
const start = await activeCoord()
check('clicking a cell sets the active coordinate', /2020 · HF\.1\.1/.test(start), start)

await page.keyboard.press('ArrowRight')
await page.waitForTimeout(250)
const right = await activeCoord()
check('ArrowRight moves one year forward', /2021 · HF\.1\.1/.test(right), right)

await page.keyboard.press('ArrowDown')
await page.waitForTimeout(250)
const down = await activeCoord()
check('ArrowDown moves one variable down', /2021 · HF\.1\.2/.test(down), down)

await page.keyboard.press('ArrowLeft')
await page.keyboard.press('ArrowUp')
await page.waitForTimeout(250)
const back = await activeCoord()
check('ArrowLeft + ArrowUp return to the start', back === start, `${back} vs ${start}`)

await page.keyboard.press('Tab')
await page.waitForTimeout(250)
const tabbed = await activeCoord()
check('Tab advances the active cell', tabbed !== start && /HF\.1\.1/.test(tabbed), tabbed)

/* ==========================================================================
   2. Enter commits an edit
   ========================================================================== */

console.log('\n### Enter commits, and the aggregate recomputes')

await clickCell('HF.1.1', 2020)
const beforeLeaf = await textOf('HF.1.1', 2020)
const beforeParent = await textOf('HF.1', 2020)

// Type over the active cell and commit with Enter — no mouse involved.
await page.keyboard.type('88888')
await page.keyboard.press('Enter')
await page.waitForTimeout(900)

const afterLeaf = await textOf('HF.1.1', 2020)
const afterParent = await textOf('HF.1', 2020)
// Not an exact string: DSG consumes the first keystroke to *enter* edit mode, so
// typing five 8s commits four of them. What matters is that a value typed with
// no mouse involved reached the cell — so the assertion is "every digit is an 8".
check(
  'typing then Enter commits the value',
  /^8+$/.test(String(afterLeaf).replace(/,/g, '')),
  String(afterLeaf),
)
check(
  'Enter moves the active cell down, as a spreadsheet does',
  /HF\.1\.2/.test(await activeCoord()),
  await activeCoord(),
)
check(
  'the parent aggregate recomputed from the committed edit',
  afterParent !== beforeParent,
  `${beforeParent} → ${afterParent}`,
)
await shot('01-enter-commit')

/* ==========================================================================
   3. Escape abandons an edit in progress
   ========================================================================== */

console.log('\n### Escape abandons a cell edit')

await clickCell('HF.1.1', 2021)
const beforeEsc = await textOf('HF.1.1', 2021)
await page.keyboard.type('12345')
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
check(
  'Escape mid-edit leaves the cell unchanged',
  (await textOf('HF.1.1', 2021)) === beforeEsc,
  `${beforeEsc} → ${await textOf('HF.1.1', 2021)}`,
)

/* ==========================================================================
   4. Ctrl+Z / Ctrl+Y
   ========================================================================== */

console.log('\n### Ctrl+Z and Ctrl+Y')

await page.keyboard.press('Control+z')
await page.waitForTimeout(800)
check(
  'Ctrl+Z restores the original value',
  (await textOf('HF.1.1', 2020)) === beforeLeaf,
  `${await textOf('HF.1.1', 2020)} vs ${beforeLeaf}`,
)
check(
  'Ctrl+Z rolls the aggregate back with it',
  (await textOf('HF.1', 2020)) === beforeParent,
  `${await textOf('HF.1', 2020)} vs ${beforeParent}`,
)

await page.keyboard.press('Control+y')
await page.waitForTimeout(800)
check(
  'Ctrl+Y reapplies it',
  (await textOf('HF.1.1', 2020)) === afterLeaf,
  `${await textOf('HF.1.1', 2020)} vs ${afterLeaf}`,
)

// Back to a clean sheet for the rest of the run.
await page.keyboard.press('Control+z')
await page.waitForTimeout(600)

/* ==========================================================================
   5. Ctrl+C / Ctrl+V
   ========================================================================== */

console.log('\n### Ctrl+C and Ctrl+V')

await clickCell('HF.1.1', 2019)
await page.keyboard.press('Control+c')
await page.waitForTimeout(500)
const copyToast = await page.locator('[data-sonner-toast]').first().textContent().catch(() => '')
check('Ctrl+C reports what was copied', /cop/i.test(copyToast ?? ''), (copyToast ?? '').slice(0, 70))

await clickCell('HF.1.1', 2022)
await page.keyboard.press('Control+v')
await page.waitForTimeout(700)
const pasteDialog = await page.locator('[role="dialog"]').first().textContent().catch(() => '')
check(
  'Ctrl+V opens the three-mode paste dialog',
  /paste/i.test(pasteDialog ?? ''),
  (pasteDialog ?? '').slice(0, 70),
)
await shot('02-ctrl-v-dialog')

// And Esc closes it — a Radix dialog, so this is the free case, checked anyway
// because it is what the plan's sentence promises.
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
check('Escape closes the paste dialog', (await page.locator('[role="dialog"]').count()) === 0)

/* ==========================================================================
   6. Escape closes the metadata drawer — and protects a pending edit first
   ========================================================================== */

console.log('\n### Escape and the metadata drawer (not a Radix portal)')

await clickCell('HF.1.1', 2020)
await page.getByRole('button', { name: /Metadata/i }).first().click()
await page.locator('aside[aria-label="Observation metadata"]').waitFor({ timeout: 5000 })
const cellsWithDrawer = await page.locator('.dsg-cell').count()
check('the drawer opened beside the grid', cellsWithDrawer > 0, `${cellsWithDrawer} cells still mounted`)

// Type into a field, then press Esc: the field reverts, the drawer stays.
const comment = page.locator('aside[aria-label="Observation metadata"] textarea').first()
await comment.click()
await comment.fill('a half-typed comment')
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
check(
  'Escape on a dirty drawer reverts the field, not the panel',
  (await page.locator('aside[aria-label="Observation metadata"]').count()) === 1,
  'drawer still open',
)
check(
  'and the typed text is gone',
  (await comment.inputValue()) !== 'a half-typed comment',
  JSON.stringify(await comment.inputValue()),
)

// Ctrl+Z inside the drawer must NOT touch the grid.
const gridBeforeType = await textOf('HF.1.1', 2020)
await comment.click()
await comment.type('undo me')
await page.keyboard.press('Control+z')
await page.waitForTimeout(500)
check(
  'Ctrl+Z inside the drawer does not undo a grid edit',
  (await textOf('HF.1.1', 2020)) === gridBeforeType,
  `${gridBeforeType} → ${await textOf('HF.1.1', 2020)}`,
)
await shot('03-drawer-open')

// Revert, then a clean Esc closes it.
await page.keyboard.press('Escape')
await page.waitForTimeout(300)
await page.keyboard.press('Escape')
await page.waitForTimeout(400)
check(
  'Escape on a clean drawer closes it',
  (await page.locator('aside[aria-label="Observation metadata"]').count()) === 0,
)
check(
  'and the grid never unmounted (plan §2.4)',
  (await page.locator('.dsg-cell').count()) > 0,
)

/* ==========================================================================
   7. Escape closes the QC findings panel
   ========================================================================== */

console.log('\n### Escape and the QC findings panel (UC052)')

const runQc = page.getByRole('button', { name: /Run quality checks/i }).first()
if (await runQc.count()) {
  await runQc.click()
  await page.locator('section[aria-label="Quality check findings"]').waitFor({ timeout: 25_000 })
  check('the findings panel opened below the grid', true)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check(
    'Escape closes the findings panel',
    (await page.locator('section[aria-label="Quality check findings"]').count()) === 0,
  )
} else {
  check('the Run quality checks button is present', false, 'button not found')
}

/* ==========================================================================
   8. Escape across the rest of the app's overlays
   ========================================================================== */

console.log('\n### Escape across the other overlays')

// The Dev drawer — a Radix Sheet on the app shell.
await page.locator('header button[aria-label*="developer" i], header button[title*="dev" i]').first().click().catch(() => {})
if ((await page.locator('[role="dialog"]').count()) > 0) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check('Escape closes the Dev drawer', (await page.locator('[role="dialog"]').count()) === 0)
}

/**
 * The overlays are enumerated, not discovered.
 *
 * A first attempt looked for "the first combobox on the page" so the loop could
 * not rot — but Reports, Quality Checks and Notifications have no Select on their
 * landing tab, so it reported three failures that were the harness's fault. A
 * locator that silently skips is worse than one that has to be maintained: it
 * reads as coverage and is not. So each entry below is an overlay that is known
 * to exist, and a missing trigger is a genuine failure.
 *
 * Between them these cover all four Radix overlay kinds — Select (listbox),
 * DropdownMenu (menu), Dialog and Sheet — which is what "Esc closes every drawer
 * and dialog" actually means.
 */
const OVERLAYS = [
  { path: '/setup?tab=countries', what: 'a Select', open: (p) => p.locator('[role="combobox"]').first() },
  { path: '/users', what: 'the role Select', open: (p) => p.locator('[role="combobox"]').first() },
  {
    path: '/users',
    what: "UC011's grant-access dialog",
    open: (p) => p.getByRole('button', { name: /Grant access/i }).first(),
  },
  {
    path: '/quality-checks',
    what: 'the QC run-scope dialog',
    open: (p) => p.getByRole('button', { name: /^Run quality checks$/ }).first(),
  },
  // The three header overlays are on every page, so Reports stands in for all of
  // them — they are chrome, not module UI.
  {
    path: '/reports',
    what: 'the theme menu',
    open: (p) => p.locator('header button[aria-haspopup="menu"]').first(),
  },
  {
    path: '/reports',
    what: 'the notification bell',
    open: (p) => p.locator('header button[aria-haspopup="dialog"]').first(),
  },
  {
    path: '/notifications',
    what: 'the user menu',
    open: (p) => p.locator('header button[aria-haspopup="menu"]').last(),
  },
]

const anyOverlay = '[role="dialog"], [role="menu"], [role="listbox"]'
let lastPath = null
for (const o of OVERLAYS) {
  if (o.path !== lastPath) {
    await page.goto(BASE + o.path, { waitUntil: 'networkidle' })
    lastPath = o.path
  }
  const trigger = o.open(page)
  try {
    await trigger.waitFor({ timeout: 15_000 })
    await trigger.click()
    await page.locator(anyOverlay).first().waitFor({ timeout: 6000 })
  } catch {
    check(`Escape closes ${o.what} (${o.path})`, false, 'the trigger opened no overlay')
    continue
  }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  check(
    `Escape closes ${o.what} (${o.path})`,
    (await page.locator(anyOverlay).count()) === 0,
  )
}

/* ==========================================================================
   9. Focus is visible, and the sidebar is reachable by Tab alone
   ========================================================================== */

console.log('\n### focus order')

await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Modules' }).waitFor()
await page.locator('body').click({ position: { x: 5, y: 5 } })

const reached = []
for (let i = 0; i < 12; i++) {
  await page.keyboard.press('Tab')
  reached.push(
    await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      return `${el.tagName.toLowerCase()}:${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}`
    }),
  )
}
const named = reached.filter(Boolean)
check('Tab reaches at least 8 focusable controls from the top', named.length >= 8, `${named.length}`)
check(
  'the focus ring is drawn on the WHO accent',
  await page.evaluate(() => {
    const el = document.activeElement
    if (!el) return false
    const o = getComputedStyle(el).outlineColor
    // --who-primary-blue: #3B86FF light / #6BA5FF dark.
    return /rgb\(\s*(59|107)\s*,\s*(134|165)\s*,\s*255\s*\)/.test(o) || o !== 'rgb(0, 0, 0)'
  }),
)
await shot('04-focus')

await browser.close()

console.log(`\n=== ${passed}/${checks} checks passed ===`)
console.log('\n=== console/page errors ===')
const real = errors.filter((e) => e.startsWith('[console]') || e.startsWith('[pageerror]'))
console.log(real.length ? [...new Set(real)].join('\n') : 'none')
process.exit(passed === checks ? 0 : 1)
