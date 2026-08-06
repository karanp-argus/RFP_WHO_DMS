import { chromium } from 'playwright'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const OUT = fileURLToPath(new URL('../artifacts/shots/', import.meta.url))
fs.rmSync(OUT, { recursive: true, force: true })
fs.mkdirSync(OUT, { recursive: true })
const BASE = process.env.DMS_URL ?? 'http://localhost:5199'

const errors = []
const browser = await chromium.launch()

async function newPage(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))
  return { ctx, page }
}

/** Screenshot only after the expected content is painted. */
async function shot(page, name, locator, opts = {}) {
  if (locator) await locator.waitFor({ state: 'visible', timeout: 8000 })
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts })
}

async function signIn(page) {
  await page.getByRole('button', { name: /Sign in with WHO account/i }).click()
  // Assert on content, not on URL — the shell must actually be painted.
  await page.locator('nav[aria-label="Main navigation"]').waitFor({ state: 'attached' })
}

// ---- Desktop 1440 ----
{
  const { ctx, page } = await newPage(1440, 900)
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  console.log('unauthenticated / →', page.url())
  await shot(page, '01-login-1440', page.getByRole('heading', { name: 'HA DMS' }), { fullPage: true })

  await signIn(page)
  console.log('after sign-in →', page.url())
  await shot(page, '02-home-admin-1440', page.getByRole('heading', { name: 'Modules' }), {
    fullPage: true,
  })
  console.log(
    'admin: nav links',
    await page.locator('nav[aria-label="Main navigation"] a').count(),
    '| tiles',
    await page.locator('main a').count(),
  )

  // Setup — proves routing + shell persistence + active nav state
  await page.locator('nav[aria-label="Main navigation"] a', { hasText: 'Setup' }).click()
  await shot(page, '03-setup-1440', page.getByRole('heading', { name: 'Setup' }))
  console.log('after Setup click →', page.url())

  // Switch to Regular user
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Modules' }).waitFor()
  await page.locator('header button').last().click()
  await page.getByRole('menuitem', { name: 'Regular user' }).click()
  await page.getByText('You have regular user access', { exact: false }).waitFor()
  await shot(page, '04-home-regular-1440', page.getByRole('heading', { name: 'Modules' }), {
    fullPage: true,
  })
  console.log('regular: tiles', await page.locator('main a').count())

  // Permission labels, to confirm the matrix drives the UI
  const labels = await page.locator('main a span.mt-1').allTextContents()
  console.log('regular tile permission labels:', labels.join(' | '))

  await ctx.close()
}

// ---- Mobile 390 ----
{
  const { ctx, page } = await newPage(390, 844)
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await signIn(page)
  await shot(page, '05-home-mobile-closed', page.getByRole('heading', { name: 'Modules' }))

  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.waitForTimeout(600) // 300ms slide transition
  await shot(page, '06-home-mobile-sidebar', null)
  await ctx.close()
}

// ---- 768 boundary (the reference breakpoint) ----
{
  const { ctx, page } = await newPage(768, 900)
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await signIn(page)
  await shot(page, '07-home-768', page.getByRole('heading', { name: 'Modules' }))
  await ctx.close()
}

await browser.close()

console.log('\n=== console/page errors ===')
console.log(errors.length ? errors.join('\n') : 'none')
console.log('\nshots:', fs.readdirSync(OUT).join(', '))
