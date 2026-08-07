// `defineConfig` from vitest/config, not vite: it is the same function widened
// to accept the `test` key below.
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Copy `index.html` to `404.html` after the build.
 *
 * The app uses `BrowserRouter`, so `/setup` is a real path and a static host has
 * to answer it with `index.html`. `vite preview` does that; a bare static server
 * does not — `python -m http.server` over `dist/` returns **404 for every route
 * except `/`**, which would break every exact URL in `DEMO_SCRIPT.md`.
 *
 * `404.html` is the convention GitHub Pages, Netlify, Cloudflare Pages and S3
 * website hosting all honour, and it costs one 4 kB file. For a host that honours
 * nothing, `npm run serve:dist` in `scripts/serve-dist.mjs` is a zero-dependency
 * server that does the rewrite properly.
 *
 * It must be a *post-build* copy rather than a file in `public/`, because the
 * script and stylesheet names carry content hashes that only exist after the
 * bundle is written.
 */
function spa404Fallback(): Plugin {
  return {
    name: 'dms:spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const dist = path.resolve(import.meta.dirname, 'dist')
      const index = path.join(dist, 'index.html')
      if (fs.existsSync(index)) fs.copyFileSync(index, path.join(dist, '404.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), spa404Fallback()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        /**
         * Chunk grouping for the Phase 8 route split.
         *
         * `React.lazy` on the fifteen page components (see `routes.tsx`) took the
         * entry chunk from 2.11 MB to ~330 kB, but Rolldown's default splitting
         * then emitted **eighty** chunks, twenty of them a single Lucide icon of
         * 150 bytes. That trades one oversized request for a burst of tiny ones,
         * which is worse on a real network and unreadable in the build output.
         *
         * `minSize` pulls anything below 24 kB back into the chunks that import
         * it. The three groups then keep the genuinely large third-party trees in
         * named, individually-cacheable chunks:
         *
         *  · **`vendor-xlsx`** — SheetJS is ~500 kB on its own and is reached by
         *    four modules (workbook, reports, QC, integration). Left ungrouped it
         *    is duplicated or hoisted into the entry.
         *  · **`vendor-charts`** — Recharts plus its d3 scales, needed only by the
         *    dashboard and the QC scatter.
         *  · **`vendor-react`** — React, the DOM renderer and the router. Shared
         *    by every route, so it belongs in the entry's critical path and gets
         *    its own long-lived cache entry.
         *
         * `test` matches against the module id, so the `node_modules` prefix is
         * required — without it `/recharts/` also matches our own
         * `FindingsScatter.tsx` import specifier on some platforms.
         */
        advancedChunks: {
          minSize: 24_000,
          groups: [
            /**
             * Vite's dynamic-import preload helper, pinned to its own chunk.
             *
             * Left alone, the helper lands in whichever chunk the bundler happens
             * to be building — and it landed in `vendor-charts`. The entry then
             * carried `import { _ } from './vendor-charts.js'`: one function,
             * which made **369 kB of Recharts a static dependency of the sign-in
             * screen** and emitted a `modulepreload` link for it. Nothing on that
             * screen draws a chart.
             *
             * Two details are both required:
             *
             *  · The id is the virtual module `\0vite/preload-helper.js`, so the
             *    `node_modules` prefix every other pattern here relies on is
             *    absent — found by logging ids from a throwaway `test` function,
             *    not by guessing.
             *  · **`minSize: 0`.** A group inherits the 24 kB default above; the
             *    helper is about 1 kB, so the group was silently discarded and the
             *    module went straight back to `vendor-charts`. A group that is too
             *    small to survive `minSize` fails by doing nothing, which is why
             *    the first two attempts looked like a regex problem.
             */
            {
              name: 'vite-preload-helper',
              test: /vite\/(preload-helper|modulepreload-polyfill)/,
              minSize: 0,
              priority: 100,
            },
            { name: 'vendor-xlsx', test: /node_modules[\\/].*xlsx/ },
            /*
             * **No `vendor-charts` group, deliberately.** An earlier revision had
             * one, and it made things worse: Rolldown put a shared low-level
             * helper into that chunk, so *every* other chunk — the entry included
             * — carried `import { _ } from './vendor-charts.js'`, and index.html
             * emitted a `modulepreload` for 369 kB of Recharts on the sign-in
             * screen. Only `FindingsScatter` imports Recharts, so the default
             * splitting already does the right thing: it lands inside
             * `QcReportPage`, its single consumer, and nothing else pays for it.
             * Verified by `npm run audit:bundle`.
             */
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
            },
            // Every icon in one chunk. Twenty separate 150-byte files came from
            // here: an icon shared by two lazy routes gets extracted, and the
            // sidebar needs most of them on arrival regardless.
            { name: 'vendor-icons', test: /node_modules[\\/]lucide-react/ },
            // Radix + the overlay layer, needed by the shell itself.
            {
              name: 'vendor-ui',
              test: /node_modules[\\/](radix-ui|@radix-ui|cmdk|sonner|next-themes)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    // jsdom, not node: db.ts reads localStorage, and the mock client is the
    // thing under test — stubbing the browser API would test the stub.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
