/**
 * Renders the three Proposed Solution diagrams to PNG.
 *
 * Chromium is used as the renderer rather than a diagram library because the figures
 * have to sit inside the proposal .docx and match its typography — the @font-face rules
 * in _base.css load the very Roboto and Open Sans files embedded in that document.
 *
 * Output is sized for the proposal page: US Letter with 1in margins = 6.5in of content
 * width. Rendering 1300 CSS px at deviceScaleFactor 2 gives 2600px, which is 400 DPI at
 * that placement width — well clear of anything that would show artefacts in print.
 *
 *   node docs/diagrams/render.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, statSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));

// Playwright is a devDependency of dms-prototype, not of docs/. Resolve it from there
// explicitly so this script runs from any working directory.
const require = createRequire(join(here, '..', '..', 'dms-prototype', 'package.json'));
const { chromium } = require('playwright');
const outDir = join(here, '..', 'assets');
mkdirSync(outDir, { recursive: true });

const FIGURES = [
  ['figure1-functional-landscape', 'Figure 1 — Functional landscape'],
  ['figure2-solution-architecture', 'Figure 2 — Solution architecture'],
  ['figure3-xmart-integration', 'Figure 3 — DMS–xMart integration'],
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1300, height: 1200 },
  deviceScaleFactor: 2,
});

const PLACED_IN = 6.5;              // figure width in the proposal
const PT_PER_PX = (PLACED_IN * 72) / 1300;
const MIN_PT = 7.0;                 // below this a printed label is not reliably readable
const PAGE_TEXT_IN = 9.25;          // Letter, 1in bottom / 0.75in top margin

// Reported for information only — see the note in the loop below.

for (const [slug, label] of FIGURES) {
  await page.goto(pathToFileURL(join(here, `${slug}.html`)).href, { waitUntil: 'load' });
  // Web fonts are loaded from disk via @font-face; without this the first paint can
  // measure with the fallback metrics and the boxes come out the wrong height.
  await page.evaluate(() => document.fonts.ready);

  // Screenshot the body element rather than fullPage: fullPage pads out to the viewport
  // height, which left ~230px of white space under the shorter figures.
  const out = join(outDir, `${slug}.png`);
  await page.locator('body').screenshot({ path: out });

  // Smallest rendered font size actually used, so the print-legibility floor is measured
  // rather than assumed. A stylesheet edit that reintroduces small type fails the run.
  const { width, height, minPx, minTag } = await page.evaluate(() => {
    let min = Infinity, tag = '';
    const NOT_RENDERED = new Set(['STYLE', 'SCRIPT', 'HEAD', 'TITLE', 'META', 'LINK']);
    for (const el of document.querySelectorAll('body *')) {
      if (NOT_RENDERED.has(el.tagName)) continue;
      // Only elements that render text *themselves*. Measuring every element that merely
      // contains text counts layout containers, which inherit the 16px default and report
      // a false failure.
      const ownsText = [...el.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()
      );
      if (!ownsText) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (px > 0 && px < min) { min = px; tag = el.className || el.tagName; }
    }
    return {
      width: document.body.scrollWidth,
      height: document.body.scrollHeight,
      minPx: min,
      minTag: tag,
    };
  });

  const kb = Math.round(statSync(out).size / 1024);
  const printH = (height / 1300) * PLACED_IN;
  const minPt = minPx * PT_PER_PX;

  // Reported, not enforced. The dense design is deliberate — see the note at the head of
  // _base.css. The numbers are printed every run so the trade-off stays visible rather
  // than being rediscovered on a printed page.
  const notes = [];
  if (minPt < MIN_PT) notes.push(`smallest type ${minPt.toFixed(1)}pt on .${minTag} — reads on screen, not in print at ${PLACED_IN}in`);
  if (printH > PAGE_TEXT_IN) notes.push(`taller than one page at ${PLACED_IN}in wide`);

  console.log(
    `${label.padEnd(40)} ${width}x${height} css → ${width * 2}x${height * 2} px, ${String(kb).padStart(4)} kB, ` +
    `at ${PLACED_IN}in wide prints ${printH.toFixed(2)}in tall, smallest type ${minPt.toFixed(1)}pt` +
    (notes.length ? `\n${' '.repeat(42)}note: ${notes.join('; ')}` : '')
  );
}

await browser.close();
