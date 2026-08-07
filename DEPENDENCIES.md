# Dependency register — WHO Health Accounts DMS prototype

> ## ⛔ This file is mandatory to update
>
> **Every** change to `package.json` — add, remove, upgrade, downgrade, or promoting a
> transitive dependency — **must be recorded here in the same change, and reported to the
> user.** This is structural rule 4 in [CLAUDE.md](CLAUDE.md); the full procedure is there.
> A dependency change that is not written down is a defect, regardless of whether the code
> works today.
>
> Record: the package · the **resolved** version (read from `node_modules`, not the declared
> range) · **why that version and not a newer one**.

**Why this file exists.** During Phase 2, `npm i @tanstack/react-table` silently installed
**v9**, which is a complete API rewrite, and every grid in the app would have broken. It was
caught only because the code was written against v8's API and failed to compile. This file
records what each dependency is for, which version is installed, and — where it matters —
**why that version and not a newer one**, so nobody "tidies up" a pin and breaks working
functionality.

All versions below were read from `node_modules` on **6 August 2026** (the resolved version,
not the declared range), and re-verified at Phase 8 on **7 August 2026**. Verify with:

```bash
cd dms-prototype
npm ls --depth=0
```

**Phase 8 change log — the only dependency movement since Phase 2.** Three packages **removed**,
nothing added, nothing upgraded:

| Package | From | To | Why |
|---|---|---|---|
| `date-fns` | 4.4.0 | **removed** | Never imported. Timestamps derive from `DEMO_NOW` with plain `Date` arithmetic. |
| `nanoid` | 6.0.1 | **removed** | Never imported. Ids come from the seeded hash; `nanoid` would break run-to-run reproducibility. |
| `@faker-js/faker` | 10.5.0 | **removed** | Never imported. Seeds are curated or hash-derived, for the same reason. |

Closes handover item 1 — see §7.3. `nanoid@3.3.17` stays in the tree as a transitive dependency
of `postcss` (via `shadcn`); that is not the package that was removed. Gates re-run after the
removal: `npx tsc -b` clean · 413 tests passing · `npm run build` clean.

Phase 8 also added five npm **scripts**, and no packages for them — every one is `node` plus what
was already installed:

| Script | What it is |
|---|---|
| `npm run audit:contrast` | WCAG 2.1 over 52 token pairs × 2 themes, parsing `globals.css` directly. **No browser, no server.** Exits non-zero on a new failure *or* on a documented shortfall getting worse. |
| `npm run audit:bundle` | Critical-path budget and route-split regression guard. Node builtins only (`fs`, `zlib`). |
| `npm run serve:dist` | Zero-dependency static server with SPA fallback, for demoing the built bundle. Node builtins only. |
| `npm run verify:keyboard` | 32 checks. Uses the already-installed `playwright`. |
| `npm run verify:responsive` | 123 checks across 5 widths × 2 themes. Same. |

---

## 1. Toolchain

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22.14.0 | Vite 8 requires ≥20.19. No feature here needs 24. |
| npm | 10.9.2 | npm 12 is available; not adopted mid-project. Lockfile v3 either way. |
| TypeScript | 6.0.3 | Range is `~6.0.2` — **patch-only on purpose**. TS majors change inference and would surface as dozens of new errors across `domain/`. |

---

## 2. Pinning policy

Everything uses a caret range (`^`) except TypeScript. That is deliberate and sufficient
for *most* packages, because `^8.21.3` can never resolve to 9.x.

**The real hazard is not the range — it is an unversioned install.** Running
`npm i @tanstack/react-table` with no version **overwrites the range** with the current
latest and pulls a new major. That is exactly what happened in Phase 2.

So the rule is:

> When re-installing or adding to a package that appears in §6 below, **always name the
> version**: `npm i @tanstack/react-table@^8`.

Deleting `package-lock.json` and reinstalling is safe — the lockfile is not what protects
these versions, the ranges are.

---

## 3. Runtime dependencies

### Framework and build

| Package | Installed | Reason for this version |
|---|---|---|
| `react` / `react-dom` | 19.2.8 | Current stable. Drove two other choices: it ruled out Glide Data Grid, and it is why `react-datasheet-grid` carries a nested React 18 tree (see §7). |
| `vite` | 8.2.0 | Current major. Node ≥20.19 requirement is satisfied. |
| `@vitejs/plugin-react` | 6.0.5 | Matches Vite 8. |
| `typescript` | 6.0.3 | See §1. Also why there is **no `baseUrl`** in tsconfig — TS 6 deprecates it, and `paths` alone resolves `@/*`. |

### Routing and state

| Package | Installed | Reason for this version |
|---|---|---|
| `react-router-dom` | 7.18.2 | `latest`. Carries one **high** advisory (see §5) — deliberately not "fixed". |
| `zustand` | 5.0.14 | Current major. Chosen over Context for the workbook's cross-component reads; `persist` middleware backs UC015 column order and the theme/setup stores. |
| `@tanstack/react-query` | 5.101.4 | Current major. Wraps `XMartClient` so the mock exercises real loading/error states, and swapping in a live client changes nothing above the hook layer. |

### Grids and tables

| Package | Installed | Reason for this version |
|---|---|---|
| **`@tanstack/react-table`** | **8.21.3** | **Pinned to v8 — DO NOT UPGRADE.** See §6.1. |
| `@tanstack/react-virtual` | 3.14.9 | v3 is the stable line. Not yet imported — Phase 4 (workbook rows) and long Setup grids. |
| `react-datasheet-grid` | 4.11.6 | The workbook grid. Chosen over Glide Data Grid because Glide's stable release peers on `react@16 \|\| 17 \|\| 18` only, with nothing past it but alphas, and it would add `lodash`, `marked` and `react-responsive-carousel` as peers. **Requires the `react-resize-detector` override below to run under React 19** — see §6.5. |
| `react-resize-detector` | **12.3.0, via `overrides`** | Not a direct dependency — a transitive of `react-datasheet-grid`, forced up from the `7.1.2` that DSG requests. **DO NOT REMOVE THE OVERRIDE.** §6.5 has the crash it prevents. |

### Drag and drop

| Package | Installed | Reason for this version |
|---|---|---|
| `@dnd-kit/core` | 6.3.1 | Powers UC015 column reordering. Note the majors across the family are intentionally mismatched — they version independently. |
| `@dnd-kit/sortable` | 10.0.0 | Peers on `@dnd-kit/core@^6`. Do not "align" these two to the same major. |
| `@dnd-kit/modifiers` | 9.0.0 | Added in Phase 2 for `restrictToHorizontalAxis`, so a dragged column header cannot be pulled vertically out of the header row. |
| `@dnd-kit/utilities` | 3.2.2 | `CSS.Translate` helper used by the sortable header cell. |

### Data, export and import

| Package | Installed | Reason for this version |
|---|---|---|
| **`xlsx` (SheetJS)** | **0.20.3, from `cdn.sheetjs.com`** | **Not from npm — DO NOT reinstall from npm.** See §6.2. |
| `papaparse` | 5.5.4 | CSV read/write. Annex 3 makes CSV the mandatory interchange format ("CSV is 1/3 the size of json and by definition tabular"). |
| `@types/papaparse` | 5.5.2 | Papa ships no types. |
| `recharts` | 3.10.1 | Current major. Not yet imported — Phase 5 (QC outlier scatter), Phase 7 (dashboard). |
| ~~`date-fns`~~ | **removed at Phase 8** (was 4.4.0) | Never imported. All timestamp handling derives from `DEMO_NOW` with plain `Date` arithmetic. |
| ~~`nanoid`~~ | **removed at Phase 8** (was 6.0.1) | Never imported. Seeded ids come from the deterministic hash — `nanoid` would have broken run-to-run reproducibility if it had ever been used for anything data-bearing. |

### UI

| Package | Installed | Reason for this version |
|---|---|---|
| `shadcn` | 4.16.1 | The CLI, plus `shadcn/tailwind.css` imported by `globals.css`. Components are **copied into the repo**, so this version only affects newly-added components. |
| `radix-ui` | 1.6.7 | The unified package (not per-primitive `@radix-ui/react-*`). Used by 18 generated components. **All Radix overlays portal to `document.body` at `z-50`** — see the stacking order note in CLAUDE.md. |
| `tailwindcss` | 4.3.3 | **v4 is required, not optional.** The token architecture depends on `@theme inline`, which emits `var(--who-x)` into utilities so they follow the active theme. v3 has no equivalent and light/dark would stop working. |
| `@tailwindcss/vite` | 4.3.3 | v4's Vite plugin. Must track `tailwindcss` exactly. |
| `tw-animate-css` | 1.4.0 | Animation utilities for Radix enter/exit states, imported in `globals.css`. Replaces v3-era `tailwindcss-animate`. |
| `lucide-react` | 1.28.0 | Icons, 17 files. Maps 1:1 onto the reference design's bootstrap-icons vocabulary. |
| `sonner` | 2.0.7 | Toasts, 6 files. **Brought `next-themes` in as a transitive dependency** — see §7.2. |
| `next-themes` | 0.4.6 | Light/dark switching. Framework-agnostic despite the name; writes a class on `<html>`. Now an **explicit** dependency because the app imports it directly. |
| `cmdk` | 1.1.1 | Command palette behind `CountryPicker` and the Phase 4 variable pickers. Used via the generated `command.tsx`. |
| `react-resizable-panels` | 4.12.2 | Behind the generated `resizable.tsx`. Not yet used; Phase 4 may use it for the workbook/metadata split. |
| `class-variance-authority` | 0.7.1 | Variant definitions in 5 generated components. |
| `clsx` + `tailwind-merge` | 2.1.1 / 3.6.0 | The `cn()` helper. Both required — clsx joins, tailwind-merge resolves conflicting utilities. |
| `@fontsource/source-sans-pro` | 5.3.0 | Self-hosted reference typeface, imported in `globals.css` at weights 300/400/600/700. Self-hosted so the demo works with no network. |

---

## 4. Dev dependencies

| Package | Installed | Reason for this version |
|---|---|---|
| `vitest` | 4.1.10 | Runs the 46 Phase 1 tests. Config lives in `vite.config.ts` and **must import `defineConfig` from `vitest/config`**, not `vite` — the `vite` export does not type the `test` key. |
| `jsdom` | 29.1.1 | Test environment. Required, not optional: `data/db.ts` reads `localStorage`, and stubbing it would test the stub rather than the overlay. |
| `oxlint` | 1.77.0 | Linter. Three `only-export-components` warnings remain in generated `components/ui/` files — do not fix those, they would return on the next `shadcn add`. Authored code is clean. |
| `@types/node` | 24.13.3 | For `node:path` in `vite.config.ts`. |
| `@types/react` / `@types/react-dom` | 19.2.18 / 19.2.4 | Track React 19. |
| `playwright` | 1.62.1 | Drives the four `npm run verify:*` browser checks in `scripts/`. The bare `playwright` package, not `@playwright/test` — these are plain Node scripts asserting via console output, not a test-runner suite, because they are diagnostic harnesses rather than CI gates. Added at handover (6 Aug 2026); previously run from a temp scratchpad that had its own install, so the scripts could not have run on a colleague's machine. Requires a one-off `npx playwright install chromium`. |
| ~~`@faker-js/faker`~~ | **removed at Phase 8** (was 10.5.0) | Never imported. Phase 1 seeds are curated or hash-derived because faker output is not reproducible across runs, which is the property the whole demo rests on. |

---

## 5. Known advisories, and why they stand

`npm audit` reports **2 high, 0 critical**. Both are the same issue.

**`react-router` / `react-router-dom` — RSC Mode CSRF Bypass.** Affects `7.12.0 – 8.2.0`;
7.18.2 is `latest` and there is no fixed release in the 7.x line.

*Unreachable in this application:* the prototype is front-end only — no server, no RSC, no
data actions, no route handlers. The vulnerability requires a server-side RSC request path
that does not exist here.

**Do not run `npm audit fix --force`.** Verified by dry-run on 6 Aug 2026: it downgrades
`react-router-dom` to **7.11.0**, which npm itself flags as `SemVer major change`, and it
triggers a cascade of `ERESOLVE` peer conflicts against React 19.

> *Correction to an earlier note:* CLAUDE.md previously said 7.11.0 "carries 14 worse
> advisories". That figure could not be substantiated on re-check and has been removed. The
> accurate reasons not to downgrade are the semver-major break and the React 19 peer
> conflicts above.

---

## 6. Do-not-upgrade list

### 6.1 `@tanstack/react-table` — stay on v8

**v9 is a ground-up rewrite, not an increment.** What changes:

| v8 (in use) | v9 |
|---|---|
| `useReactTable(...)` | `useTable(...)` |
| `getCoreRowModel()`, `getSortedRowModel()`, `getFilteredRowModel()`, `getPaginationRowModel()` | Removed. Replaced by feature composition — `tableFeatures`, `columnOrderingFeature`, `rowSortingFeature`, … |
| Direct `table.getState()` reads | Deprecated in favour of atoms, `table.Subscribe`, `useSelector(table.store, …)` |

`DataTable.tsx` uses the v8 API throughout and is consumed by Setup, and will be by Users,
Reports and Quality Checks. Migrating means rewriting the component and re-verifying UC015
column reordering.

`^8.21.3` already blocks 9.x. The failure mode is `npm i @tanstack/react-table` with no
version — **always name it**: `npm i @tanstack/react-table@^8`.

### 6.2 `xlsx` — keep the CDN tarball

Installed as `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.

The **npm** `xlsx` package is abandoned at 0.18.5 and carries two unfixed high-severity
advisories (prototype pollution, ReDoS). SheetJS moved distribution to its own CDN, and the
CDN tarball is the maintained line. `npm i xlsx` would install the abandoned 0.18.5 and
reintroduce both advisories.

### 6.3 `tailwindcss` — must stay on v4

The two-layer token system in `src/styles/globals.css` depends on `@theme inline`, which
makes Tailwind emit `var(--who-x)` into each utility rather than the resolved value. That is
the mechanism by which every utility follows the active light/dark theme. Downgrading to v3
silently breaks dark mode across all 28 shadcn components. `@tailwindcss/vite` must move in
lockstep.

### 6.4 `@dnd-kit/*` — do not align the majors

`core@6`, `sortable@10`, `modifiers@9`, `utilities@3` look inconsistent but are correct:
these packages version independently and `sortable@10` peers on `core@^6`. Bumping `core`
to match `sortable` will fail to resolve.

### 6.5 `react-resize-detector` — the override is load-bearing, do not remove it

`package.json` carries:

```json
"overrides": { "react-resize-detector": "^12.3.0" }
```

**Delete it and every route in the application renders a blank page.** Not the workbook —
*every* route, because `routes.tsx` imports the workbook page statically, so the module
graph is evaluated on any navigation.

The chain, established by the Phase 4 day-1 spike:

1. `react-datasheet-grid@4.11.6` calls `useResizeDetector` unconditionally in
   `DataSheetGrid`, its main component.
2. The `react-resize-detector@7.1.2` that DSG requests peers on `react-dom@16–18`, so npm
   nested a second `react-dom@18.3.1` under it.
3. That React 18 `react-dom` reads
   `React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentDispatcher` off the
   single React **19** instance at module-evaluation time. React 19 removed that internal,
   so the read is `undefined` and the module throws before anything renders:

   ```
   TypeError: Cannot read properties of undefined (reading 'ReactCurrentDispatcher')
       at node_modules/.vite/deps/react-datasheet-grid.js
   ```

`12.3.0` was chosen over the alternatives because it is the only one that removes the cause
rather than working around it: it peers on `react@^18 || ^19`, has **no `react-dom`
dependency at all**, and replaced `lodash` with `es-toolkit`. So the override deletes the
nested `react-dom`, the nested `react-resize-detector` and `lodash` from the tree in one
move — `node_modules/react-datasheet-grid/node_modules/` no longer exists, and there is
exactly one `react-dom` in the graph. Dropping `lodash` also settles an inconsistency: the
plan rejected Glide Data Grid partly for pulling `lodash` in, while DSG was quietly doing
the same.

DSG's call site is `useResizeDetector({ targetRef, refreshMode: 'throttle', refreshRate })`
returning `{ width, height }`, which is unchanged across v7 → v12 — verified in the browser,
not assumed: the grid renders, virtualises, resizes, and pins its header and gutter with no
console errors.

**Two ways this could regress.** A `npm i react-datasheet-grid` without the override
restores the crash. And a future DSG release that adopts v12's own API changes could make
`^12.3.0` wrong rather than merely unnecessary — at which point remove the override and
re-run the spike, do not guess.

*Rejected alternative:* forcing `react-dom` itself to 19 for the nested tree. It leaves
`react-resize-detector@7`'s top-level `import { findDOMNode } from 'react-dom'` resolving to
an API React 19 deleted, which is a latent break waiting for any code path that calls it,
and it keeps `lodash`.

---

## 7. Open items to resolve at a named phase

### 7.1 ~~`react-datasheet-grid` carries a nested React 18 tree~~ — RESOLVED at Phase 4 day 1

The spike ran, and the item was worse than recorded: the nested `react-dom@18` was **not
inert**, it crashed every route on import under React 19. Resolved by an `overrides` entry
pinning `react-resize-detector` to `^12.3.0`, which removes the nested `react-dom`, the
nested `react-resize-detector` and `lodash` from the tree together. Full reasoning, the
exact error, and the two ways it can regress are in **§6.5** — it is a do-not-touch entry
now, not an open item.

The second half of the day-1 spike — whether the variable label column can be pinned on the
left — also came out well, and is recorded in PROTOTYPE_PLAN.md's Phase 4 outcome rather
than here: DSG's `gutterColumn` is `position: sticky; left: 0`, accepts arbitrary content
and an arbitrary width, and has a header slot over it that serves as the frozen corner. The
planned fallback of a second synchronised grid was not needed.

### 7.2 `next-themes` was a transitive dependency doing real work

`components/ui/sonner.tsx` calls `useTheme()` from `next-themes`, which arrived only as a
sonner dependency. There was no `ThemeProvider`, so it fell through to its `"system"`
default and toasts followed the **OS** theme rather than the app's. Fixed in Phase 0 by
mounting `ThemeProvider` and promoting `next-themes` to an explicit dependency.

*Lesson worth keeping:* a generated shadcn component can import a package the project never
declared. When adding components, check what they pull in.

### 7.3 ~~Installed but unused~~ — RESOLVED at Phase 8

`react-datasheet-grid` is imported by the workbook (Phase 4), and `@tanstack/react-virtual`
arrives with it as DSG's own virtualisation engine. `recharts` is imported by the QC outlier
scatter (Phase 5) and `react-resizable-panels` by a generated shadcn component.

**`date-fns`, `nanoid` and `@faker-js/faker` were never imported by any file and were removed
at Phase 8** — verified with a repo-wide search over `src/`, `scripts/`, `index.html` and
`vite.config.ts` before removing, and with `npm ls` to confirm nothing else depended on them:

```bash
npm uninstall date-fns nanoid @faker-js/faker
```

`nanoid@3.3.17` remains in the tree as a transitive dependency of `postcss` (via `shadcn`).
That is expected and is not the package that was removed — the removed one was the top-level
`nanoid@6`.

All three gates were re-run after the removal: `npx tsc -b` clean, 413 tests passing,
`npm run build` clean. **The dependency register now matches what the code imports**, which was
the point of the item.

---

## 8. Changing a dependency — required checklist

Applies to **adding, removing, upgrading and downgrading**, and to promoting a transitive
dependency to an explicit one. Not optional; see the banner at the top of this file.

- [ ] **Checked §6** — if the package is on the do-not-upgrade list, stop and re-read why.
- [ ] **Named the version in the install command** — `npm i pkg@^8`, never bare `npm i pkg`.
      A bare install overwrites the semver range and pulls the newest major.
- [ ] **Checked for a nested React copy** — `ls node_modules/<pkg>/node_modules/`. Two copies
      of `react` or `react-dom` cause failures that are very hard to trace later (§7.1).
- [ ] **Preferred what is already here** — `radix-ui` and `lucide-react` cover most UI needs.
- [ ] **Read the resolved version** from `node_modules/<pkg>/package.json`, not the range.
- [ ] **Recorded it in §3 or §4** with the reason — not just what it does, but *why this
      version and not a newer one*. "Current stable at the time" is an acceptable reason if
      that is the truth; an invented rationale is not.
- [ ] **Added it to §6** if an upgrade would break something, naming the concrete breakage.
- [ ] **Re-ran all three gates**: `npx tsc -b` · `npm test` · `npm run build`.
- [ ] **Reported it to the user** — what changed, from which version to which, and why.
      Never let a dependency change land as a silent side effect of another task.

To re-verify this whole file against reality at any time:

```bash
cd dms-prototype && npm ls --depth=0
```
