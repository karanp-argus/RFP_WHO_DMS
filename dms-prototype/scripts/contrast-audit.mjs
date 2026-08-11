/**
 * WCAG 2.1 contrast audit over the design tokens.
 *
 * Promoted into the repo at Phase 8 (plan §Phase 8 item 3). It previously lived
 * inside `verify-theme.mjs`, which meant it could only run with a dev server up
 * and a browser installed — so in practice it ran once a phase instead of after
 * every token change, which is what CLAUDE.md actually asks for.
 *
 * This version reads `src/styles/globals.css` directly and resolves the tokens
 * itself. No browser, no dev server, no Playwright:
 *
 *     node scripts/contrast-audit.mjs          # both themes, table + verdict
 *     node scripts/contrast-audit.mjs --json   # machine-readable
 *
 * It exits **non-zero on an unexpected failure only**. The three light-theme
 * shortfalls documented at the foot of `globals.css` are inherited from the WHO
 * reference palette and deliberately left alone — changing them would alter WHO
 * brand colours, which is not ours to decide. They are declared below as
 * `known`, so the script stays a real gate: a *new* failure fails the run, and
 * a known one that has silently got worse fails too.
 *
 * ## Why the pair list is longer than the browser version's 18
 *
 * Phases 4–7 added no new colour tokens (every dashboard band, badge and chart
 * fill is an existing pass/warn/fail token with an alpha), but they added a great
 * many new *combinations*, and a combination is what contrast is a property of.
 * The additions are marked `phase` below. Two of them were genuinely unchecked
 * before: formula text on an **indicator** cell — UC031 puts blue italic on the
 * pink calculated rows, and only the blue-on-blue case had ever been measured —
 * and status text on its own tinted background, which is how every QC finding,
 * threshold warning and job状態 chip is drawn.
 */

import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const CSS = fileURLToPath(new URL('../src/styles/globals.css', import.meta.url))
const JSON_OUT = process.argv.includes('--json')

/* --------------------------------------------------------------------------
   Token extraction
   -------------------------------------------------------------------------- */

/**
 * Pull one top-level rule block out of the stylesheet by selector.
 *
 * Brace counting rather than a regex: `:root` contains `color-mix()` and shadow
 * values, and a lazy `\{([^}]*)\}` stops at the first `}` in a comment.
 */
function block(css, selector) {
  const start = css.indexOf(selector + ' {')
  if (start < 0) throw new Error(`No "${selector}" block in globals.css`)
  let depth = 0
  let i = css.indexOf('{', start)
  const from = i + 1
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}' && --depth === 0) return css.slice(from, i)
  }
  throw new Error(`Unterminated "${selector}" block`)
}

/** `--name: value;` pairs, comments stripped. */
function declarations(text) {
  const out = new Map()
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const m of clean.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1], m[2].trim())
  }
  return out
}

const css = fs.readFileSync(CSS, 'utf8')
const LIGHT = declarations(block(css, ':root'))
const DARK = new Map([...LIGHT, ...declarations(block(css, '.dark'))])

/* --------------------------------------------------------------------------
   Colour maths
   -------------------------------------------------------------------------- */

/** Resolve a token to `[r, g, b]`, following `var()` chains. */
function rgbOf(tokens, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`Circular var() at ${name}`)
  seen.add(name)
  const raw = tokens.get(name)
  if (raw == null) throw new Error(`Unknown token ${name}`)

  const asVar = raw.match(/^var\((--[\w-]+)\)$/)
  if (asVar) return rgbOf(tokens, asVar[1], seen)

  const hex = raw.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  }

  const fn = raw.match(/^rgba?\(([^)]+)\)$/)
  if (fn) {
    const n = fn[1].match(/[\d.]+/g).map(Number)
    return [n[0], n[1], n[2]]
  }

  throw new Error(`Cannot resolve ${name} = "${raw}" to a colour`)
}

/** Composite `fg` at `alpha` over `bg` — what a Tailwind `/40` modifier paints. */
function over(fg, bg, alpha) {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)))
}

const lin = (c) => {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}
const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/* --------------------------------------------------------------------------
   The pairs
   -------------------------------------------------------------------------- */

/**
 * `min` is the bar this pair must clear:
 *   4.5 — body text (WCAG 1.4.3 AA)
 *   3.0 — large text, and UI components / graphical objects (1.4.11)
 *
 * `bg` may be `[token, alpha, overToken]`, which is how a Tailwind alpha
 * modifier resolves: the tint composited over whatever it sits on.
 *
 * `known` records a *deliberate* shortfall with the measured value at the time.
 * The script fails if the pair drops below it, so "documented" cannot quietly
 * become "worse".
 */
const PAIRS = [
  /* --- Phase 0: the original eighteen -------------------------------------- */
  { label: 'body text on canvas', fg: '--who-text', bg: '--who-page-bg', min: 4.5 },
  { label: 'body text on surface', fg: '--who-text', bg: '--who-surface', min: 4.5 },
  { label: 'heading on surface', fg: '--who-heading', bg: '--who-surface', min: 4.5 },
  { label: 'muted text on surface', fg: '--who-text-muted', bg: '--who-surface', min: 4.5 },
  { label: 'muted text on canvas', fg: '--who-text-muted', bg: '--who-page-bg', min: 4.5 },
  {
    label: 'hint on surface',
    fg: '--who-hint',
    bg: '--who-surface',
    min: 3.0,
    known: { light: 2.2, why: 'decorative hints only — never essential text (globals.css)' },
  },
  { label: 'icon on surface', fg: '--who-icon', bg: '--who-surface', min: 3.0 },
  { label: 'sidebar label on sidebar', fg: '--who-on-brand', bg: '--who-sidebar', min: 4.5,
    known: { light: 4.29, dark: 4.29, why: 'WHO reference $blue-bg — flag to WHO, do not guess' } },
  { label: 'sidebar label on hover', fg: '--who-on-brand', bg: '--who-sidebar-hover', min: 4.5 },
  { label: 'sidebar label on logo block', fg: '--who-on-brand', bg: '--who-sidebar-logo', min: 4.5 },
  {
    label: 'active indicator on sidebar',
    fg: '--who-sidebar-accent',
    bg: '--who-sidebar',
    min: 3.0,
    known: { light: 2.52, dark: 2.52, why: 'decorative — the row background also changes on active' },
  },
  { label: 'button text on brand', fg: '--who-on-brand', bg: '--who-brand', min: 4.5 },
  {
    label: 'accent blue on surface',
    fg: '--who-primary-blue',
    bg: '--who-surface',
    min: 3.0,
    note: 'borders, rings and underlines only — never body text on a light surface',
  },
  { label: 'formula text on value cell', fg: '--who-cell-formula', bg: '--who-cell-value', min: 4.5 },
  { label: 'body text on indicator cell', fg: '--who-text', bg: '--who-cell-indicator', min: 4.5 },
  { label: 'pass on surface', fg: '--who-pass', bg: '--who-surface', min: 4.5 },
  { label: 'warn on surface', fg: '--who-warn', bg: '--who-surface', min: 4.5 },
  { label: 'fail on surface', fg: '--who-fail', bg: '--who-surface', min: 4.5 },

  /* --- Phase 4: the workbook ---------------------------------------------- */
  // UC031 renders a formula cell in blue italic, and the calculated rows are
  // pink. Only the blue-on-blue case had ever been measured.
  { phase: 4, label: 'formula text on indicator cell', fg: '--who-cell-formula', bg: '--who-cell-indicator', min: 4.5 },
  { phase: 4, label: 'heading on value cell', fg: '--who-heading', bg: '--who-cell-value', min: 4.5 },
  { phase: 4, label: 'heading on indicator cell', fg: '--who-heading', bg: '--who-cell-indicator', min: 4.5 },
  // A null cell renders its placeholder muted (`cellRenderers.tsx`), and the
  // gutter's variable code is muted on the row's own tint.
  { phase: 4, label: 'muted text on value cell', fg: '--who-text-muted', bg: '--who-cell-value', min: 4.5 },
  { phase: 4, label: 'muted text on indicator cell', fg: '--who-text-muted', bg: '--who-cell-indicator', min: 4.5 },
  { phase: 4, label: 'cell border against value cell', fg: '--who-border', bg: '--who-cell-value', min: 1.0,
    note: 'measured, not gated: the grid line is a hairline separator, not a control boundary' },
  { phase: 4, label: 'selection ring on surface', fg: '--who-primary-blue', bg: '--who-surface', min: 3.0 },
  { phase: 4, label: 'heading on selected row tint', fg: '--who-heading', bg: '--who-accent-subtle', min: 4.5 },
  { phase: 4, label: 'body text on selected row tint', fg: '--who-text', bg: '--who-accent-subtle', min: 4.5 },

  /* --- Phase 5: QC findings ----------------------------------------------- */
  // Every finding, threshold warning and status chip is status-coloured text on
  // a 5–15% tint of the same token. Both move together, so the ratio is *not*
  // the plain "fail on surface" figure.
  { phase: 5, label: 'fail text on fail/10 tint', fg: '--who-fail', bg: ['--who-fail', 0.1, '--who-surface'], min: 4.5 },
  { phase: 5, label: 'fail text on fail/15 tint', fg: '--who-fail', bg: ['--who-fail', 0.15, '--who-surface'], min: 4.5 },
  { phase: 5, label: 'warn text on warn/10 tint', fg: '--who-warn', bg: ['--who-warn', 0.1, '--who-surface'], min: 4.5 },
  { phase: 5, label: 'warn text on warn/5 tint', fg: '--who-warn', bg: ['--who-warn', 0.05, '--who-surface'], min: 4.5 },
  { phase: 5, label: 'pass text on pass/10 tint', fg: '--who-pass', bg: ['--who-pass', 0.1, '--who-surface'], min: 4.5 },
  { phase: 5, label: 'heading on fail/10 tint', fg: '--who-heading', bg: ['--who-fail', 0.1, '--who-surface'], min: 4.5 },
  { phase: 5, label: 'muted text on warn/10 tint', fg: '--who-text-muted', bg: ['--who-warn', 0.1, '--who-surface'], min: 4.5 },
  { phase: 5, label: 'fail/40 border on surface', fg: ['--who-fail', 0.4, '--who-surface'], bg: '--who-surface', min: 1.0,
    note: 'measured, not gated: the tinted border restates a severity the icon and text already carry' },
  { phase: 5, label: 'fail/50 border on surface', fg: ['--who-fail', 0.5, '--who-surface'], bg: '--who-surface', min: 1.0,
    note: 'measured, not gated: as above' },

  /* --- Phase 6: reports --------------------------------------------------- */
  { phase: 6, label: 'body text on brand/5 tint', fg: '--who-text', bg: ['--who-brand', 0.05, '--who-surface'], min: 4.5 },
  { phase: 6, label: 'heading on brand/5 tint', fg: '--who-heading', bg: ['--who-brand', 0.05, '--who-surface'], min: 4.5 },
  /*
   * Charts. Only the QC outlier scatter uses Recharts, and it draws with
   * `--who-fail`, `--who-warn`, `--who-border` and `--who-text-muted` — so those
   * are the pairs measured. shadcn's `--color-chart-2` and `--color-chart-3` map
   * onto `--who-sidebar` and `--who-brand`, which sit at **1.25:1 and 2.48:1 on
   * the dark surface**: unreadable as a chart series. They are deliberately NOT
   * listed as failures, because nothing draws with them — measuring an unused
   * token and calling it a defect is how an audit earns a reputation for noise.
   * It is recorded here instead, as the thing to fix *before* a second chart
   * reaches for the next colour in the palette.
   */
  { phase: 6, label: 'scatter mark (fail) on raised surface', fg: '--who-fail', bg: '--who-surface-raised', min: 3.0 },
  { phase: 6, label: 'scatter mark (warn) on raised surface', fg: '--who-warn', bg: '--who-surface-raised', min: 3.0 },
  { phase: 6, label: 'scatter axis label on raised surface', fg: '--who-text-muted', bg: '--who-surface-raised', min: 4.5 },
  { phase: 6, label: 'scatter gridline on raised surface', fg: '--who-border', bg: '--who-surface-raised', min: 1.0,
    note: 'measured, not gated: gridlines are a reading aid, and the axis labels carry the scale' },

  /* --- Phase 7: dashboard + heatmap --------------------------------------- */
  /*
   * The heatmap bands carry no text — each cell is a swatch with a tooltip — so
   * the requirement is that **adjacent bands are distinguishable**, not legible.
   * 1.25:1 is the bar used here rather than any WCAG figure: WCAG has no
   * criterion for "two fills next to each other in a grid", and below about 1.2
   * two swatches of different hue but equal luminance are genuinely hard to
   * separate at 32px. The alphas in `CompletenessHeatmap.tsx` were re-chosen at
   * Phase 8 for exactly this: `fail/55` against `warn/60` measured 1.02:1 light.
   */
  { phase: 7, label: 'heatmap: empty vs low band', fg: '--who-page-bg', bg: ['--who-fail', 0.85, '--who-surface'], min: 1.25 },
  { phase: 7, label: 'heatmap: low vs partial band', fg: ['--who-fail', 0.85, '--who-surface'], bg: ['--who-warn', 0.5, '--who-surface'], min: 1.25 },
  { phase: 7, label: 'heatmap: partial vs high band', fg: ['--who-warn', 0.5, '--who-surface'], bg: ['--who-pass', 0.3, '--who-surface'], min: 1.25 },
  { phase: 7, label: 'heatmap: high vs full band', fg: ['--who-pass', 0.3, '--who-surface'], bg: ['--who-pass', 0.75, '--who-surface'], min: 1.25 },
  { phase: 7, label: 'heatmap: full band on surface', fg: ['--who-pass', 0.75, '--who-surface'], bg: '--who-surface', min: 3.0 },
  { phase: 7, label: 'heatmap: empty band on surface', fg: '--who-page-bg', bg: '--who-surface', min: 1.05 },
  { phase: 7, label: 'status text on canvas (fail)', fg: '--who-fail', bg: '--who-page-bg', min: 4.5 },
  { phase: 7, label: 'status text on canvas (warn)', fg: '--who-warn', bg: '--who-page-bg', min: 4.5 },
  { phase: 7, label: 'status text on canvas (pass)', fg: '--who-pass', bg: '--who-page-bg', min: 4.5 },
  { phase: 7, label: 'border on canvas', fg: '--who-border', bg: '--who-page-bg', min: 1.0,
    note: 'measured, not gated: card edges are reinforced by the card shadow' },

  /* --- Phase 8 and after --------------------------------------------------- */
  /*
   * The canvas colour doubles as a recessed well inside a dialog — the paste
   * dialog's source/target block and its clipboard preview, the series-tools
   * preview header. That puts heading-weight text on `--who-page-bg`, which no
   * earlier pair covered: canvas had only been measured against body, muted and
   * status text.
   */
  { phase: 8, label: 'heading on canvas', fg: '--who-heading', bg: '--who-page-bg', min: 4.5 },
]

/* --------------------------------------------------------------------------
   Run
   -------------------------------------------------------------------------- */

/** `'--token'` or `['--token', alpha, '--over']` → `[r, g, b]`. */
function resolve(tokens, spec) {
  if (typeof spec === 'string') return rgbOf(tokens, spec)
  const [name, alpha, base] = spec
  return over(rgbOf(tokens, name), rgbOf(tokens, base), alpha)
}

const THEMES = [
  ['light', LIGHT],
  ['dark', DARK],
]

const results = []
let unexpected = 0
let regressed = 0

for (const [theme, tokens] of THEMES) {
  for (const pair of PAIRS) {
    const ratio = +contrast(resolve(tokens, pair.fg), resolve(tokens, pair.bg)).toFixed(2)
    const known = pair.known?.[theme]
    let status
    if (ratio >= pair.min) status = 'PASS'
    else if (known != null) {
      // Documented shortfall. Allow a hair of rounding drift, but not a real
      // slide: a token edit that makes a known failure worse is a regression.
      status = ratio >= known - 0.02 ? 'KNOWN' : 'REGRESSED'
      if (status === 'REGRESSED') regressed++
    } else {
      status = 'FAIL'
      unexpected++
    }
    results.push({ theme, phase: pair.phase ?? 0, label: pair.label, ratio, min: pair.min, status, note: pair.note, why: pair.known?.why })
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify({ results, unexpected, regressed }, null, 2))
} else {
  for (const [theme] of THEMES) {
    console.log(`\n### ${theme.toUpperCase()} theme`)
    let phase = -1
    for (const r of results.filter((x) => x.theme === theme)) {
      if (r.phase !== phase) {
        phase = r.phase
        console.log(phase === 0 ? '  — Phase 0 tokens —' : `  — added by Phase ${phase} —`)
      }
      const bar = `≥${r.min.toFixed(1)}`
      console.log(
        `  ${r.status.padEnd(10)} ${r.ratio.toFixed(2).padStart(6)}:1 ${bar.padStart(5)}  ${r.label}` +
          (r.why ? `\n${' '.repeat(30)}↳ ${r.why}` : '') +
          (r.note ? `\n${' '.repeat(30)}↳ ${r.note}` : ''),
      )
    }
    const t = results.filter((x) => x.theme === theme)
    console.log(
      `  → ${t.filter((x) => x.status === 'PASS').length} pass · ` +
        `${t.filter((x) => x.status === 'KNOWN').length} known shortfall · ` +
        `${t.filter((x) => x.status === 'FAIL').length} unexpected fail · ` +
        `${t.filter((x) => x.status === 'REGRESSED').length} regressed`,
    )
  }

  console.log(`\n=== ${PAIRS.length} pairs × 2 themes ===`)
  if (unexpected === 0 && regressed === 0) {
    console.log('OK — every pair clears its bar, or is a documented shortfall at its recorded value.')
    console.log('The three light-theme shortfalls are inherited from the WHO reference palette and')
    console.log('are deliberate. Do not "fix" them by inventing new brand colours (CLAUDE.md).')
  } else {
    if (unexpected) console.log(`FAIL — ${unexpected} pair(s) below the bar with no recorded reason.`)
    if (regressed) console.log(`FAIL — ${regressed} documented shortfall(s) have got worse.`)
  }
}

process.exit(unexpected + regressed > 0 ? 1 : 0)
