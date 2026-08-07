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

/**
 * Token values as the *browser* resolves them.
 *
 * The ratio table moved to `scripts/contrast-audit.mjs` at Phase 8 — it reads
 * `globals.css` directly, needs no server, and covers 52 pairs including the
 * alpha tints Phases 5–7 draw with. Duplicating the pair list here would create
 * a second source of truth that could only drift.
 *
 * What is left is the one thing only a browser can answer: whether the values
 * that actually reach the page are the values in the file. Tailwind v4's
 * `@theme inline`, the `.dark` class and the shadcn `--primary`-style aliases all
 * sit between the two, and a broken link there resolves to *nothing* rather than
 * to an error — an undefined `var()` drops the declaration silently. So this
 * reports the resolved values and the audit script checks their ratios.
 */
const RESOLVED = `
(() => {
  const probe = document.createElement('div'); document.body.appendChild(probe)
  const hex = (s) => {
    const [r,g,b] = s.match(/-?[\\d.]+/g).map(Number)
    return '#' + [r,g,b].map(v => Math.round(v).toString(16).padStart(2,'0')).join('')
  }
  const tokens = [
    '--who-text', '--who-heading', '--who-text-muted', '--who-page-bg', '--who-surface',
    '--who-sidebar', '--who-brand', '--who-primary-blue', '--who-accent-subtle',
    '--who-cell-value', '--who-cell-indicator', '--who-cell-formula',
    '--who-pass', '--who-warn', '--who-fail',
  ]
  // Also probe two shadcn aliases, which are the ones that fail silently.
  const aliases = ['--primary', '--destructive', '--ring', '--accent']
  const read = (t) => { probe.style.color = 'var(' + t + ', magenta)'; return hex(getComputedStyle(probe).color) }
  const out = { tokens: {}, aliases: {} }
  for (const t of tokens) out.tokens[t] = read(t)
  for (const a of aliases) out.aliases[a] = read(a)
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

  // Resolved token values, and the shadcn aliases that fail silently.
  const { tokens, aliases } = await page.evaluate(RESOLVED)
  const unresolved = [...Object.entries(tokens), ...Object.entries(aliases)].filter(
    ([, v]) => v === '#ff00ff',
  )
  for (const [name, value] of Object.entries(tokens)) {
    console.log(`  ${value}  ${name}`)
  }
  for (const [name, value] of Object.entries(aliases)) {
    console.log(`  ${value}  ${name}  (shadcn alias)`)
  }
  if (unresolved.length) {
    errors.push(
      `[${theme}] ${unresolved.length} token(s) resolved to the magenta fallback — ` +
        `the var() chain is broken for: ${unresolved.map(([n]) => n).join(', ')}`,
    )
  }
  console.log('  → ratios: run `npm run audit:contrast` (52 pairs, no browser needed)')
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
