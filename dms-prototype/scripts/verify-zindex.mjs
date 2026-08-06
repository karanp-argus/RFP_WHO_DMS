import { chromium } from 'playwright'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../artifacts/shots-z/', import.meta.url))
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const BASE = process.env.DMS_URL ?? 'http://localhost:5199'

const errors = []
const browser = await chromium.launch()

async function page(w = 1440, h = 900) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } })
  const p = await ctx.newPage()
  p.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`))
  p.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
  await p.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await p.getByRole('button', { name: /Sign in with WHO account/i }).click()
  await p.getByRole('heading', { name: 'Modules' }).waitFor()
  return { ctx, p }
}

/**
 * The real test: is any part of the open menu actually covered by the header?
 * Compare the menu's own top edge against what elementFromPoint reports there.
 */
async function occlusionCheck(p, menuSelector, label) {
  const r = await p.evaluate((sel) => {
    const menu = document.querySelector(sel)
    if (!menu) return { error: 'overlay not found' }
    // Radix portals the overlay to document.body inside a popper wrapper; the
    // wrapper carries the z-index, so that is what must beat the chrome.
    const overlay = menu.closest('[data-radix-popper-content-wrapper]') ?? menu

    const zOf = (el) => {
      // Walk up for the nearest ancestor that establishes a z-index.
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const z = getComputedStyle(n).zIndex
        if (z !== 'auto') return Number(z)
      }
      return 0
    }
    const intersects = (a, b) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top

    const oRect = overlay.getBoundingClientRect()
    const oZ = zOf(overlay)

    // Geometric, not hit-tested: hit-testing is unreliable while Radix is
    // animating, because it sets pointer-events: none mid-transition.
    const covering = []
    for (const el of document.querySelectorAll('body *')) {
      if (el === overlay || overlay.contains(el) || el.contains(overlay)) continue
      const cs = getComputedStyle(el)
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      if (!intersects(oRect, rect)) continue
      const z = zOf(el)
      if (z > oZ) covering.push(`${el.tagName.toLowerCase()}.z${z}`)
    }
    return {
      top: Math.round(oRect.top),
      overlayZ: oZ,
      headerZ: zOf(document.querySelector('header')),
      covering: [...new Set(covering)],
    }
  }, menuSelector)

  if (r.error) {
    console.log(`  ${label}: ${r.error}`)
    return false
  }
  const ok = r.covering.length === 0
  console.log(
    `  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(22)} top=${String(r.top).padStart(4)}px  ` +
      `overlay z=${r.overlayZ}  header z=${r.headerZ}` +
      (ok ? '' : `  ← covered by ${r.covering.join(', ')}`),
  )
  return ok
}

console.log('=== Overlays opened from the header (the reported bug) ===')
{
  const { ctx, p } = await page()

  await p.getByRole('button', { name: /^Theme:/ }).click()
  await p.getByRole('menuitem', { name: 'System' }).waitFor()
  await occlusionCheck(p, '[role="menu"]', 'theme dropdown')
  await p.screenshot({ path: `${OUT}/01-theme-menu.png`, clip: { x: 900, y: 0, width: 540, height: 320 } })
  await p.keyboard.press('Escape')

  await p.locator('header button').last().click()
  await p.getByRole('menuitem', { name: 'Regular user' }).waitFor()
  await occlusionCheck(p, '[role="menu"]', 'user dropdown')
  await p.screenshot({ path: `${OUT}/02-user-menu.png`, clip: { x: 900, y: 0, width: 540, height: 420 } })
  await p.keyboard.press('Escape')

  // Tooltip — also a z-50 portal, also anchored inside the header.
  await p.getByRole('button', { name: 'xMart API call log' }).hover()
  await p.waitForTimeout(600)
  const tip = await p.locator('[role="tooltip"]').count()
  console.log(`  ${tip > 0 ? 'PASS' : 'FAIL'}  header tooltip        rendered=${tip > 0}`)
  await p.screenshot({ path: `${OUT}/03-tooltip.png`, clip: { x: 900, y: 0, width: 540, height: 200 } })

  await ctx.close()
}

console.log('\n=== Chrome vs portal layer, measured ===')
{
  const { ctx, p } = await page()
  const z = await p.evaluate(() => {
    const q = (s) => document.querySelector(s)
    return {
      header: getComputedStyle(q('header')).zIndex,
      sidebar: getComputedStyle(q('nav[aria-label="Main navigation"]')).zIndex,
    }
  })
  console.log(`  header z=${z.header}  sidebar z=${z.sidebar}  (both must be < 50)`)
  const ok = Number(z.header) < 50 && Number(z.sidebar) < 50
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  chrome sits below the Radix portal layer`)
  await ctx.close()
}

console.log('\n=== Mobile drawer: scrim must now dim the header too ===')
{
  const { ctx, p } = await page(390, 844)
  await p.getByRole('button', { name: 'Open navigation' }).click()
  await p.waitForTimeout(600)
  // Probe a point in the header, right of the drawer — should hit the scrim.
  const hit = await p.evaluate(() => {
    const el = document.elementFromPoint(340, 35)
    const cs = el ? getComputedStyle(el) : null
    return { tag: el?.tagName.toLowerCase(), z: cs?.zIndex, cls: el?.className?.toString().slice(0, 40) }
  })
  const dimmed = hit.z === '30'
  console.log(`  ${dimmed ? 'PASS' : 'FAIL'}  header is behind the scrim (hit <${hit.tag}> z=${hit.z})`)
  await p.screenshot({ path: `${OUT}/04-mobile-drawer.png` })
  await ctx.close()
}

await browser.close()
console.log('\n=== errors ===')
console.log(errors.length ? errors.join('\n') : 'none')
