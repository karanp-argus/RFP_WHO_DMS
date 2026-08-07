/**
 * Phase 8 item 4 — the responsive pass: **1920 / 1440 / 1280 / 1024 / 768, in
 * both themes.**
 *
 * `verify-shell.mjs` already covers the sidebar's drawer behaviour at 1440 / 768 /
 * 390. This is the wider sweep, and it looks for one specific class of defect
 * that screenshots alone do not catch:
 *
 *   **the page scrolling sideways.** CLAUDE.md fixes the content padding at
 *   `110px 40px 80px 300px`, so every wide surface in the app — the workbook
 *   grid, the pivot preview, the 25-year completeness heatmap, the Annex 3
 *   request panel — has to scroll *inside its own container*. If one of them
 *   pushes `document.documentElement.scrollWidth` past the viewport, the whole
 *   page slides under the fixed sidebar and header and the demo looks broken at
 *   exactly the resolution the projector happens to be running.
 *
 * So each route is checked for: horizontal page overflow, any element wider than
 * the viewport that is not inside a scroll container, and console errors. A
 * screenshot is kept for every route × width × theme (150 images) so the visual
 * pass can be done from disk rather than by resizing a window sixty times.
 *
 * Run with a dev server up:  npm run dev -- --port 5199
 * Or against the built bundle:  npm run preview -- --port 4173
 *                               DMS_URL=http://localhost:4173 npm run verify:responsive
 */

import { chromium } from 'playwright'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../artifacts/shots-responsive/', import.meta.url))
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const BASE = process.env.DMS_URL ?? 'http://localhost:5199'

/** 768 is the reference's breakpoint; the rest are the common panel resolutions. */
const WIDTHS = [1920, 1440, 1280, 1024, 768]

/**
 * One route per module, each chosen because it is the *widest* surface that
 * module has: a 25-column grid, a 25-year heatmap, a wide pivot, a request body.
 */
const ROUTES = [
  { path: '/', name: 'home', ready: () => 'Modules' },
  { path: '/workbooks', name: 'workbook-select', ready: () => 'Workbooks' },
  {
    // The widest surface in the app: 25 year columns plus the frozen label
    // column. If anything is going to push the page sideways, it is this.
    path: '/workbooks/view?c=CAN&v=HF.1,HF.1.1,HF.1.2,HF.3,HF.3.1&y=2000-2024&type=country',
    name: 'workbook',
    ready: () => 'Workbook',
  },
  { path: '/quality-checks', name: 'quality', ready: () => 'Quality Checks' },
  { path: '/reports', name: 'reports', ready: () => 'Reports' },
  { path: '/setup', name: 'setup', ready: () => 'Setup' },
  { path: '/users', name: 'users', ready: () => 'Users' },
  { path: '/users/role-permissions', name: 'role-permissions', ready: () => 'Role Permissions' },
  { path: '/notifications', name: 'notifications', ready: () => 'Notifications' },
  { path: '/integration', name: 'integration', ready: () => 'xMart Integration' },
  { path: '/integration/retrieval-api', name: 'retrieval-api', ready: () => 'Data Retrieval API' },
]

const errors = []
const overflows = []
let checks = 0
let passed = 0

function check(label, ok, detail = '') {
  checks++
  if (ok) passed++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  return ok
}

/**
 * Horizontal overflow, and who caused it.
 *
 * `scrollWidth > clientWidth` on the document is the symptom. The cause is
 * reported too, because "the page scrolls sideways at 1024" is not actionable on
 * its own — it is always one element, and it is usually a table. Elements inside
 * something with `overflow-x: auto|scroll` are excluded: those are *supposed* to
 * be wider than the viewport, that is what the scroll container is for.
 */
const OVERFLOW_PROBE = `
(() => {
  const doc = document.documentElement
  const vw = doc.clientWidth
  const pageOverflow = doc.scrollWidth - vw
  const culprits = []
  const inScroller = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const ov = getComputedStyle(p).overflowX
      if (ov === 'auto' || ov === 'scroll' || ov === 'hidden') return true
    }
    return false
  }
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    // Right edge past the viewport by more than a rounding pixel.
    if (r.right <= vw + 1) continue
    if (inScroller(el)) continue
    culprits.push({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().slice(0, 70),
      right: Math.round(r.right),
      width: Math.round(r.width),
    })
  }
  // Only the outermost offenders — a wide table reports its every cell otherwise.
  return { pageOverflow, vw, culprits: culprits.slice(0, 4) }
})()
`

const browser = await chromium.launch()

for (const theme of ['light', 'dark']) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await ctx.newPage()
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`[${theme}/${width}] ${m.text()}`)
    })
    page.on('pageerror', (e) => errors.push(`[${theme}/${width}] pageerror: ${e.message}`))

    // Sign in once per context, then set the theme and reload so the first paint
    // is already correct — the same ordering `verify-theme.mjs` uses.
    await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
    await page.evaluate((t) => localStorage.setItem('dms-theme', t), theme)
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Sign in with WHO account/i }).click()
    await page.locator('nav[aria-label="Main navigation"]').waitFor({ state: 'attached' })

    console.log(`\n### ${theme} @ ${width}px`)

    /*
     * The sidebar is pinned at 768 and **off-canvas at 767**.
     *
     * Tailwind's `md:` is `min-width: 768px`, so 768 is the first *pinned* width,
     * not the last drawer width — which is exactly what CLAUDE.md means by
     * "collapses at md (768px), matching the reference's 767px breakpoint". The
     * first version of this check read that as "≤768 is a drawer" and reported a
     * failure at the one width where the behaviour is correct. Every width in
     * the sweep is therefore pinned; the boundary itself is checked once, below.
     */
    const navBox = await page.locator('nav[aria-label="Main navigation"]').boundingBox()
    check(
      'sidebar is pinned',
      navBox != null && navBox.x >= 0,
      navBox ? `x=${Math.round(navBox.x)}` : 'not laid out',
    )

    for (const route of ROUTES) {
      await page.goto(BASE + route.path, { waitUntil: 'networkidle' })
      try {
        await page.getByRole('heading', { name: route.ready(), exact: false }).first().waitFor({ timeout: 15_000 })
      } catch {
        check(`${route.name}: rendered`, false, 'heading never appeared')
        continue
      }
      // Two frames, so a lazy chunk's Suspense fallback has actually been
      // replaced by the page before anything is measured.
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      )

      const { pageOverflow, culprits } = await page.evaluate(OVERFLOW_PROBE)
      const ok = check(
        `${route.name}: no horizontal page overflow`,
        pageOverflow <= 1,
        pageOverflow > 1
          ? `+${pageOverflow}px — ${culprits.map((c) => `${c.tag}.${c.cls}@${c.right}`).join(' ; ')}`
          : '',
      )
      if (!ok) {
        overflows.push({ theme, width, route: route.name, pageOverflow, culprits })
      }

      await page.screenshot({ path: `${OUT}/${theme}-${width}-${route.name}.png`, fullPage: true })
    }

    await ctx.close()
  }
}

/* --------------------------------------------------------------------------
   The breakpoint itself: 768 pinned, 767 off-canvas
   -------------------------------------------------------------------------- */

console.log('\n### the md breakpoint (767 / 768)')
for (const width of [767, 768]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Sign in with WHO account/i }).click()
  await page.locator('nav[aria-label="Main navigation"]').waitFor({ state: 'attached' })
  await page.getByRole('heading', { name: 'Modules' }).waitFor()
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  )

  const box = await page.locator('nav[aria-label="Main navigation"]').boundingBox()
  const offCanvas = box == null || box.x < 0
  check(
    `at ${width}px the sidebar is ${width < 768 ? 'off-canvas' : 'pinned'}`,
    width < 768 ? offCanvas : !offCanvas,
    box ? `x=${Math.round(box.x)}` : 'not laid out',
  )
  // And below the breakpoint the burger has to be there, or the nav is gone.
  if (width < 768) {
    check(
      `at ${width}px the navigation is reachable`,
      (await page.getByRole('button', { name: 'Open navigation' }).count()) === 1,
    )
  }
  await page.screenshot({ path: `${OUT}/breakpoint-${width}.png`, fullPage: true })
  await ctx.close()
}

await browser.close()

console.log(`\n=== ${passed}/${checks} checks passed ===`)
if (overflows.length) {
  console.log('\nhorizontal overflow:')
  for (const o of overflows) {
    console.log(`  ${o.theme} @ ${o.width}  ${o.route}  +${o.pageOverflow}px`)
    for (const c of o.culprits) console.log(`      ${c.tag}.${c.cls}  w=${c.width} right=${c.right}`)
  }
}
console.log('\n=== console/page errors ===')
console.log(errors.length ? [...new Set(errors)].join('\n') : 'none')
console.log(`\n${fs.readdirSync(OUT).length} screenshots in artifacts/shots-responsive/`)

process.exit(passed === checks && errors.length === 0 ? 0 : 1)
