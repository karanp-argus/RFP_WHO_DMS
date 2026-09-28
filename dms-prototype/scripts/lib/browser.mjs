/**
 * Launch Chromium for the browser harnesses and the docs/diagrams renderers.
 *
 * `chromium.launch()` accepts exactly one browser: the build this Playwright version
 * bundles. A cache holding any other build fails at launch with "Executable doesn't
 * exist", even when a perfectly good browser is installed — which is what happened on
 * 28 Sep 2026, with Playwright 1.62.1 wanting build 1234 and the cache holding 1243.
 *
 * So the harnesses try, in order of how well Playwright supports them:
 *
 *   1. `DMS_CHROMIUM_PATH` — an explicit executable. Always wins.
 *   2. The bundled build. The supported pairing, and the answer on any machine that ran
 *      `npx playwright install chromium`.
 *   3. Installed Google Chrome, then Microsoft Edge. Both are supported Playwright
 *      channels; Edge ships with Windows 11.
 *   4. The newest other Chromium build in the Playwright cache. It works, but Playwright
 *      does not promise a mismatched build behaves identically — so it is last.
 *
 * It always prints one line naming the browser used. A harness failure under a fallback is
 * then traceable at a glance, and "install the matching build" is the obvious next step.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { chromium } from 'playwright'

const MISSING = /Executable doesn't exist|executable doesn't exist|not found at/i

/** The build and version this Playwright wants, for the log line. Best effort. */
function bundledBuild() {
  try {
    const require = createRequire(import.meta.url)
    const core = join(dirname(require.resolve('playwright')), '..', 'playwright-core', 'browsers.json')
    const entry = JSON.parse(readFileSync(core, 'utf8')).browsers.find(
      (b) => b.name === 'chromium-headless-shell',
    )
    return entry ? `build ${entry.revision} / ${entry.browserVersion}` : 'build unknown'
  } catch {
    return 'build unknown'
  }
}

/** Playwright's browser cache, per its own defaults. `null` when browsers live in node_modules. */
function cacheDir() {
  const override = process.env.PLAYWRIGHT_BROWSERS_PATH
  if (override === '0') return null
  if (override) return override
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA ?? '', 'ms-playwright')
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Caches', 'ms-playwright')
  return join(homedir(), '.cache', 'ms-playwright')
}

/** Executable locations inside one cache folder, newest layouts first. */
const EXECUTABLES = {
  'chromium_headless_shell': [
    'chrome-headless-shell-win64/chrome-headless-shell.exe',
    'chrome-headless-shell-linux64/chrome-headless-shell',
    'chrome-headless-shell-mac-arm64/chrome-headless-shell',
    'chrome-headless-shell-mac-x64/chrome-headless-shell',
  ],
  chromium: [
    'chrome-win64/chrome.exe',
    'chrome-win/chrome.exe',
    'chrome-linux64/chrome',
    'chrome-linux/chrome',
    'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium',
    'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
  ],
}

/**
 * Cached builds, newest first. A headless run prefers the headless shell, which is what
 * the bundled headless launch uses too; a headed run needs full Chromium.
 */
function cachedBuilds(headless) {
  const dir = cacheDir()
  if (!dir || !existsSync(dir)) return []
  const kinds = headless ? ['chromium_headless_shell', 'chromium'] : ['chromium']
  const found = []
  for (const name of readdirSync(dir)) {
    const m = /^(chromium_headless_shell|chromium)-(\d+)$/.exec(name)
    if (!m || !kinds.includes(m[1])) continue
    const exe = EXECUTABLES[m[1]].map((rel) => join(dir, name, rel)).find(existsSync)
    if (exe) found.push({ name, build: Number(m[2]), rank: kinds.indexOf(m[1]), exe })
  }
  return found.sort((a, b) => b.build - a.build || a.rank - b.rank)
}

/**
 * `chromium.launch()` with fallbacks. Takes and passes through the same options.
 *
 * @param {import('playwright').LaunchOptions} [options]
 * @returns {Promise<import('playwright').Browser>}
 */
export async function launchChromium(options = {}) {
  const say = (how, browser) => console.log(`browser: ${how} — Chromium ${browser.version()}`)

  const explicit = process.env.DMS_CHROMIUM_PATH
  if (explicit) {
    const browser = await chromium.launch({ ...options, executablePath: explicit })
    say(`DMS_CHROMIUM_PATH (${explicit})`, browser)
    return browser
  }

  const wanted = bundledBuild()
  try {
    const browser = await chromium.launch(options)
    say(`bundled (${wanted})`, browser)
    return browser
  } catch (e) {
    // Anything other than "not installed" is a real failure and must not be masked by
    // quietly trying another browser.
    if (!MISSING.test(String(e?.message))) throw e
  }

  const tried = []
  const headless = options.headless !== false

  for (const [channel, label] of [
    ['chrome', 'Google Chrome'],
    ['msedge', 'Microsoft Edge'],
  ]) {
    try {
      const browser = await chromium.launch({ ...options, channel })
      say(`fallback ${label} (bundled ${wanted} not installed)`, browser)
      return browser
    } catch (e) {
      tried.push(`${label}: ${String(e?.message).split('\n')[0]}`)
    }
  }

  for (const build of cachedBuilds(headless)) {
    try {
      const browser = await chromium.launch({ ...options, executablePath: build.exe })
      say(`fallback cached ${build.name} (bundled ${wanted} not installed; mismatched build, unsupported)`, browser)
      return browser
    } catch (e) {
      tried.push(`${build.name}: ${String(e?.message).split('\n')[0]}`)
    }
  }

  throw new Error(
    [
      `No usable Chromium. Playwright wants ${wanted} and it is not installed.`,
      ...tried.map((t) => `  tried ${t}`),
      'Fix: `npx playwright install chromium`, or set DMS_CHROMIUM_PATH to a Chromium executable.',
    ].join('\n'),
  )
}
