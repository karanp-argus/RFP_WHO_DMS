/**
 * Captures the Proposed Solution screenshots from the hosted prototype.
 *
 *   node docs/diagrams/capture-screenshots.mjs
 *   DMS_URL=http://localhost:5173 node docs/diagrams/capture-screenshots.mjs
 *
 * Light theme is forced before the first paint, both because the proposal is a printed
 * document and because the WHO reference design the prototype is built from is light only.
 *
 * Each shot is independent and failures are reported rather than thrown, so one broken
 * selector does not cost the whole run. Re-run after fixing and only the failures change.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, statSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '..', '..', 'dms-prototype', 'package.json'));
const { chromium } = require('playwright');

const BASE = process.env.DMS_URL ?? 'https://whohadms.argusservices.in';
const outDir = join(here, '..', 'assets', 'screenshots');
mkdirSync(outDir, { recursive: true });

// 1600x1000 at deviceScaleFactor 2 gives a 3200px wide image. Placed 6.5in wide in the
// proposal that is ~490 DPI, so the interface stays crisp when the page is zoomed.
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
// next-themes reads this key on boot; setting it here avoids a flash of the wrong theme
// and guarantees light even if a previous run left dark in storage.
await context.addInitScript(() => {
  try { localStorage.setItem('dms-theme', 'light'); } catch {}
});
const page = await context.newPage();

const results = [];
async function shot(name, label, fn) {
  try {
    await fn();
    const file = join(outDir, `${name}.png`);
    await page.screenshot({ path: file });
    const kb = Math.round(statSync(file).size / 1024);
    results.push({ name, label, ok: true, kb });
    console.log(`  ok    ${name.padEnd(28)} ${label}  (${kb} kB)`);
  } catch (err) {
    results.push({ name, label, ok: false, err: err.message.split('\n')[0] });
    console.log(`  FAIL  ${name.padEnd(28)} ${label}\n        ${err.message.split('\n')[0]}`);
  }
}

const go = async (path) => {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
};

/* ---- sign in ---------------------------------------------------------- */

console.log(`\nCapturing from ${BASE}\n`);
await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /DMS Administrator/ }).click();
await page.getByRole('heading', { name: 'Modules' }).waitFor({ timeout: 15000 });
await page.waitForTimeout(1200);
console.log('  signed in as DMS Administrator\n');

/* ---- the shots -------------------------------------------------------- */

await shot('01-home-dashboard', 'Home Dashboard', async () => {
  await go('/');
});

await shot('02-users', 'Users and Role Management', async () => {
  await go('/users');
});

await shot('02b-role-permissions', 'Role permission matrix', async () => {
  await go('/users/role-permissions');
});

await shot('03-setup', 'Setup and Configuration', async () => {
  await go('/setup');
});

await shot('05-formulas', 'Formula Management', async () => {
  await go('/setup?tab=formulas');
});

await shot('06-quality-checks', 'Quality Checks rule library', async () => {
  await go('/quality-checks');
});

await shot('06b-quality-report', 'Quality Check findings report', async () => {
  await go('/quality-checks?tab=reports');
});

await shot('07-report-builder', 'Report builder', async () => {
  await go('/reports/builder/rep-hf-by-year');
  await page.waitForTimeout(1500);
});

await shot('07b-reports-list', 'Reports module', async () => {
  await go('/reports');
});

await shot('09-notifications', 'Notifications', async () => {
  await go('/notifications');
});

await shot('10-integration', 'Integration with WHO xMart', async () => {
  await go('/integration');
});

await shot('10b-retrieval-api', 'Data retrieval API', async () => {
  await go('/integration/retrieval-api');
});

/* ---- workbook: needs a selection, so it comes last --------------------- */

await shot('04-workbook', 'Workbook', async () => {
  await go('/workbooks');
  await page.getByText('Canada · HF · 2000–2024').click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Open workbook/ }).click();
  // The grid derives its values on open; it needs a moment before it is worth capturing.
  await page.waitForTimeout(3500);
});

await shot('04b-workbook-metadata', 'Workbook with metadata panel', async () => {
  await page.locator('[aria-label="Open metadata"]').first().click();
  await page.waitForTimeout(1200);
});

await shot('08-version-history', 'Version history', async () => {
  // Reopen the workbook rather than reusing the previous shot's page: the metadata panel
  // narrows the grid, which virtualises the later year columns out of the DOM entirely.
  await go('/workbooks');
  await page.getByText('Canada · HF · 2000–2024').click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: /Open workbook/ }).click();
  await page.waitForTimeout(3500);

  // Select the cell, then raise the context menu on it. A bare right-click on an
  // unselected cell does not open the history.
  const act = ([code, type]) => {
    const rows = [...document.querySelectorAll('.dsg-row:not(.dsg-row-header)')];
    const row = rows.find(
      (r) => r.querySelector('.dsg-cell-gutter')?.innerText.split('\n')[1] === code,
    );
    if (!row) return 'no row';
    const header = [...document.querySelectorAll('.dsg-row-header .dsg-cell')];
    const years = header.map((h) => h.innerText.trim()).filter((t) => /^\d{4}$/.test(t));
    if (!years.length) return 'no years rendered';
    // Prefer 2020, otherwise whichever rendered year is nearest to it.
    const want = years.includes('2020')
      ? '2020'
      : years.reduce((a, b) => (Math.abs(+b - 2020) < Math.abs(+a - 2020) ? b : a));
    const index = header.findIndex((h) => h.innerText.trim() === want);
    const cells = [...row.querySelectorAll('.dsg-cell:not(.dsg-cell-gutter)')];
    const el = cells[index - 1];
    if (!el) return 'no cell';
    const box = el.getBoundingClientRect();
    const at = { bubbles: true, clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 };
    if (type === 'select') {
      for (const t of ['mousedown', 'mouseup', 'click']) el.dispatchEvent(new MouseEvent(t, at));
    } else {
      (el.querySelector('div') ?? el).dispatchEvent(new MouseEvent('contextmenu', at));
    }
    return 'ok ' + want;
  };

  const selected = await page.evaluate(
    ({ src, args }) => new Function('return ' + src)()(args),
    { src: act.toString(), args: ['HF.3.1', 'select'] },
  );
  if (!selected.startsWith('ok')) throw new Error(`could not select cell: ${selected}`);
  await page.waitForTimeout(700);

  await page.evaluate(
    ({ src, args }) => new Function('return ' + src)()(args),
    { src: act.toString(), args: ['HF.3.1', 'context'] },
  );
  await page.waitForTimeout(1800);

  const text = await page.getByRole('dialog').innerText().catch(() => '');
  if (!/Version history/i.test(text)) throw new Error('version history dialog did not open');
});

await browser.close();

const ok = results.filter((r) => r.ok).length;
console.log(`\n${ok}/${results.length} captured into docs/assets/screenshots/`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.log('\nfailed:');
  for (const f of failed) console.log(`  ${f.name}: ${f.err}`);
  process.exitCode = 1;
}
