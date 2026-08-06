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
not the declared range). Verify with:

```bash
cd dms-prototype
npm ls --depth=0
```

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
| `react-datasheet-grid` | 4.11.6 | The workbook grid. Chosen over Glide Data Grid because Glide's stable release peers on `react@16 \|\| 17 \|\| 18` only, with nothing past it but alphas, and it would add `lodash`, `marked` and `react-responsive-carousel` as peers. Not yet imported — Phase 4. Carries a nested-dependency caveat, §7.1. |

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
| `date-fns` | 4.4.0 | Not yet imported. All current timestamp handling derives from `DEMO_NOW` with plain `Date` arithmetic; keep it unless a real formatting need appears. |
| `nanoid` | 6.0.1 | Not yet imported. Seeded ids come from the deterministic hash instead — `nanoid` would break run-to-run reproducibility if used for anything data-bearing. Candidate for removal. |

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
| `@faker-js/faker` | 10.5.0 | Not yet imported, and **may never be**. Phase 1 seeds are curated or hash-derived because faker output is not reproducible across runs. Candidate for removal. |

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

---

## 7. Open items to resolve at a named phase

### 7.1 `react-datasheet-grid` carries a nested React 18 tree — check at Phase 4 start

DSG itself peers correctly on React 19. But its transitive dependency
`react-resize-detector@7.1.2` peers on React 16–18, so npm installed a nested tree:

```
node_modules/react-datasheet-grid/node_modules/
├── react-dom@18.3.1
├── react-resize-detector@7.1.2
└── scheduler
```

`react` itself is a **single instance at 19.2.8** — there is only one `react/package.json`
in the tree, so there is no hooks-across-two-Reacts hazard. But a second `react-dom` exists,
and two renderers in one page can cause subtle problems if the nested one ever renders.

This is currently **inert** — DSG is not yet imported anywhere. Resolve it at the start of
Phase 4, alongside the planned DSG spike, by one of:

1. an npm `overrides` entry forcing `react-dom` to 19 and testing the grid still resizes;
2. accepting the nested copy if the grid works, and noting the bundle cost; or
3. switching grid if it turns out to be broken under React 19.

Do not "fix" it speculatively before the grid is rendering — there is nothing to verify
against yet.

### 7.2 `next-themes` was a transitive dependency doing real work

`components/ui/sonner.tsx` calls `useTheme()` from `next-themes`, which arrived only as a
sonner dependency. There was no `ThemeProvider`, so it fell through to its `"system"`
default and toasts followed the **OS** theme rather than the app's. Fixed in Phase 0 by
mounting `ThemeProvider` and promoting `next-themes` to an explicit dependency.

*Lesson worth keeping:* a generated shadcn component can import a package the project never
declared. When adding components, check what they pull in.

### 7.3 Installed but unused — decide before handover

`@tanstack/react-virtual`, `react-datasheet-grid`, `recharts` and `react-resizable-panels`
are all planned for Phases 4–7, so they stay.

`date-fns`, `nanoid` and `@faker-js/faker` are **not imported anywhere** and may not be
needed at all — seeded data is hash-derived for reproducibility, ids come from the same
hash, and timestamps derive from `DEMO_NOW`. Review at Phase 8 and remove if still unused,
so the handover dependency list reflects what the code actually uses.

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
