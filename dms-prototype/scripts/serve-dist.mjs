/**
 * Zero-dependency static server for `dist/`, with SPA fallback.
 *
 * Phase 8 item 7: *"verify it runs from a static host so the demo cannot be
 * broken by a network."* Two things stand in the way of that being true, and this
 * file is the answer to both.
 *
 * **1. Deep links.** The app uses `BrowserRouter`, so `/setup` and
 * `/quality-checks/reports/run-3` are real paths that a static host must answer
 * with `index.html`. `vite preview` does; `python -m http.server` returns 404 for
 * every route except `/`. Every URL in `DEMO_SCRIPT.md` is a deep link, so on the
 * wrong server the demo script does not work at all.
 *
 * **2. Depending on `vite preview` is depending on `node_modules`.** If the demo
 * has to survive a machine with no install — a borrowed laptop, a locked-down
 * conference PC — then the thing that serves it cannot be a dev dependency. This
 * script imports only `node:` builtins, so `node scripts/serve-dist.mjs` works
 * beside a copied `dist/` folder with nothing else present.
 *
 *     npm run build
 *     npm run serve:dist            # → http://localhost:4173
 *     PORT=8080 node scripts/serve-dist.mjs
 *
 * There is deliberately no `file://` mode. `file://` cannot serve ES modules
 * (`type="module"` is blocked by CORS on the file scheme) and has no notion of a
 * path rewrite, so it cannot run this app at all — a limitation of the scheme,
 * not of the build. Two hundred lines of hash-router shim to work around it would
 * change every URL in the demo script; a `node` one-liner does not.
 */

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../dist/', import.meta.url))
const PORT = Number(process.env.PORT ?? 4173)

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error(`No build found at ${ROOT}\nRun \`npm run build\` first.`)
  process.exit(1)
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/**
 * Resolve a URL path to a file inside `dist/`, or `null`.
 *
 * The `startsWith` check is not decoration: without it, `GET /../../etc/passwd`
 * escapes the served directory. `path.resolve` collapses the `..` segments, so the
 * comparison has to happen *after* resolution.
 */
function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0])
  const full = path.resolve(ROOT, '.' + decoded)
  if (!full.startsWith(path.resolve(ROOT))) return null
  if (fs.existsSync(full) && fs.statSync(full).isFile()) return full
  return null
}

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url ?? '/')

  if (file) {
    const ext = path.extname(file).toLowerCase()
    res.writeHead(200, {
      'Content-Type': MIME[ext] ?? 'application/octet-stream',
      // Hashed asset names are immutable; index.html must never be cached or a
      // rebuild mid-demo serves the old bundle with new asset names.
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
    })
    fs.createReadStream(file).pipe(res)
    return
  }

  // An asset that genuinely does not exist is a 404. Anything else is a route,
  // and gets index.html — the SPA fallback. Distinguishing them by extension
  // rather than serving index.html for everything keeps a missing chunk visible
  // as a 404 in the network panel instead of arriving as HTML and failing to
  // parse as JavaScript, which is a much harder error to read.
  if (path.extname(req.url?.split('?')[0] ?? '')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('404 Not Found\n')
    return
  }

  res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' })
  fs.createReadStream(path.join(ROOT, 'index.html')).pipe(res)
})

server.listen(PORT, () => {
  console.log(`Serving ${ROOT}`)
  console.log(`  → http://localhost:${PORT}/`)
  console.log('  SPA fallback on, no dependencies, no network needed. Ctrl+C to stop.')
})
