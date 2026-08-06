import { chromium } from 'playwright'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../artifacts/shots-theme/', import.meta.url))
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const BASE = process.env.DMS_URL ?? 'http://localhost:5199'

const errors = []
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(`[console] ${m.text()}`))
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

async function shot(name, locator, opts = {}) {
  if (locator) await locator.waitFor({ state: 'visible', timeout: 8000 })
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts })
}

// --- Contrast maths (WCAG 2.1) ---
const CONTRAST = `
(() => {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4) }
  const lum = ([r,g,b]) => 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b)
  const parse = (s) => { const m = s.match(/-?[\\d.]+/g).map(Number); return [m[0],m[1],m[2]] }
  const ratio = (a,b) => { const l1=lum(a), l2=lum(b); const [hi,lo]=l1>l2?[l1,l2]:[l2,l1]; return (hi+0.05)/(lo+0.05) }
  const cs = getComputedStyle(document.documentElement)
  const v = (n) => cs.getPropertyValue(n).trim()
  const probe = document.createElement('div'); document.body.appendChild(probe)
  const resolve = (token) => { probe.style.color = 'var(' + token + ')'; return parse(getComputedStyle(probe).color) }
  const pairs = [
    ['body text on canvas',        '--who-text',        '--who-page-bg'],
    ['body text on surface',       '--who-text',        '--who-surface'],
    ['heading on surface',         '--who-heading',     '--who-surface'],
    ['muted text on surface',      '--who-text-muted',  '--who-surface'],
    ['muted text on canvas',       '--who-text-muted',  '--who-page-bg'],
    ['hint on surface',            '--who-hint',        '--who-surface'],
    ['icon on surface',            '--who-icon',        '--who-surface'],
    ['sidebar label on sidebar',   '--who-on-brand',    '--who-sidebar'],
    ['sidebar label on hover',     '--who-on-brand',    '--who-sidebar-hover'],
    ['sidebar label on logo blk',  '--who-on-brand',    '--who-sidebar-logo'],
    ['active border on sidebar',   '--who-sidebar-accent','--who-sidebar'],
    ['button text on brand',       '--who-on-brand',    '--who-brand'],
    ['accent blue on surface',     '--who-primary-blue','--who-surface'],
    ['formula text on value cell', '--who-cell-formula','--who-cell-value'],
    ['body text on indicator cell','--who-text',        '--who-cell-indicator'],
    ['pass on surface',            '--who-pass',        '--who-surface'],
    ['warn on surface',            '--who-warn',        '--who-surface'],
    ['fail on surface',            '--who-fail',        '--who-surface'],
  ]
  const out = pairs.map(([label, fg, bg]) => ({ label, ratio: +ratio(resolve(fg), resolve(bg)).toFixed(2) }))
  probe.remove()
  return out
})()
`

for (const theme of ['light', 'dark']) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.evaluate((t) => localStorage.setItem('dms-theme', t), theme)
  await page.reload({ waitUntil: 'networkidle' })

  const htmlClass = await page.evaluate(() => document.documentElement.className)
  const colorScheme = await page.evaluate(() =>
    getComputedStyle(document.documentElement).colorScheme,
  )
  console.log(`\n### ${theme.toUpperCase()} — <html class="${htmlClass}"> color-scheme:${colorScheme}`)

  await shot(`login-${theme}`, page.getByRole('heading', { name: 'HA DMS' }), { fullPage: true })

  await page.getByRole('button', { name: /Sign in with WHO account/i }).click()
  await page.getByRole('heading', { name: 'Modules' }).waitFor()
  await shot(`home-${theme}`, page.getByRole('heading', { name: 'Modules' }), { fullPage: true })

  // Open the theme menu to prove it reflects the active choice
  await page.getByRole('button', { name: /^Theme:/ }).click()
  await page.getByRole('menuitem', { name: 'System' }).waitFor()
  await shot(`menu-${theme}`, null)
  await page.keyboard.press('Escape')

  // Contrast audit
  const results = await page.evaluate(CONTRAST)
  const fails = results.filter((r) => r.ratio < 4.5)
  const nonText = new Set(['active border on sidebar', 'icon on surface'])
  for (const r of results) {
    const target = nonText.has(r.label) ? 3.0 : 4.5
    const mark = r.ratio >= target ? 'PASS' : r.ratio >= 3.0 ? 'AA-LARGE' : 'FAIL'
    console.log(`  ${mark.padEnd(9)} ${r.ratio.toFixed(2).padStart(6)}  ${r.label}`)
  }
  console.log(`  → ${fails.length} pair(s) under 4.5:1`)
}

// Toggle round-trip: light → dark via the menu, and it persists
await page.goto(BASE + '/', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.setItem('dms-theme', 'light'))
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Modules' }).waitFor()
await page.getByRole('button', { name: /^Theme:/ }).click()
await page.getByRole('menuitem', { name: 'Dark' }).click()
await page.waitForTimeout(300)
const afterToggle = await page.evaluate(() => document.documentElement.className)
const stored = await page.evaluate(() => localStorage.getItem('dms-theme'))
console.log(`\ntoggle light→dark: html="${afterToggle}" stored="${stored}"`)
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('heading', { name: 'Modules' }).waitFor()
console.log('after reload:', await page.evaluate(() => document.documentElement.className))

await browser.close()
console.log('\n=== errors ===')
console.log(errors.length ? errors.join('\n') : 'none')
