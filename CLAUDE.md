# WHO Health Accounts DMS — Prototype

Front-end-only React prototype for RFP **PFD-2026-001**, built to demonstrate the
Pilot scope of a Health Accounts Data Management System as part of a technical proposal.

**The full plan is [PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md).** Read the relevant phase from
§5 before starting work. This file holds only the durable rules.

App lives in `dms-prototype/`. RFP sources in `Requirements/` (.docx) and the WHO
reference design in `Reference/html_pages/` — both read-only, never edit them.

## Commands

```bash
cd dms-prototype
npm run dev        # Vite dev server
npm run build      # tsc -b && vite build
npx tsc -b         # typecheck alone
npx vitest run     # unit tests (formula engine, QC rules)
```

## Four structural rules — do not break these

1. **`src/domain/` never imports React, a store, or a component.** It is pure,
   unit-testable logic and the only part that survives into production.
2. **All data access goes through `XMartClient`** (`src/data/xmart/client.ts`). No module
   reads `db.ts` directly. When xMart is real, one file changes.
3. **`src/routes.tsx` is the single source of truth for navigation.** Sidebar items, page
   titles and permission gates are derived from it — never hand-maintained alongside it.
4. **Every dependency change is recorded in [DEPENDENCIES.md](DEPENDENCIES.md) in the same
   change.** See the mandatory procedure below — this one is not optional and not deferrable.

## ⛔ MANDATORY — dependency changes must be reported

> **Any** change to `package.json` — adding, removing, upgrading or downgrading a package,
> including a transitive dependency you decide to promote or pin — **must** be reported to
> the user *and* written into [DEPENDENCIES.md](DEPENDENCIES.md) **before the task is
> reported as complete**. There is no such thing as a dependency change too small to record.

This is not bookkeeping. It exists because a real incident:
`npm i @tanstack/react-table` (no version) silently installed **v9**, a ground-up API
rewrite that would have broken every grid in the app. It was caught only because the code
had already been written against v8 and failed to compile. Undocumented dependency drift is
the single most likely way this prototype breaks in someone else's hands.

**When you change a dependency, do all four of these:**

1. **Name the version in the install command.** `npm i pkg@^8`, never bare `npm i pkg` —
   a bare install *overwrites the semver range* and pulls the newest major. That is exactly
   how the v9 incident happened.
2. **Record it in `DEPENDENCIES.md`** — the package, the resolved version (read it from
   `node_modules`, not the range), and **why that version rather than a newer one**. If the
   answer is only "current stable at the time", write that; a weak reason recorded honestly
   is worth more than an invented one.
3. **If it must never move, add it to `DEPENDENCIES.md` §6** with the concrete breakage that
   an upgrade would cause. Vague warnings get ignored; "v9 renames `useReactTable` to
   `useTable` and removes the row models" does not.
4. **Re-run all three gates** and say so: `npx tsc -b`, `npm test`, `npm run build`.

**Also report it in your reply to the user.** State what changed, from which version to
which, and why. Never let a dependency change reach the user as a silent side effect of some
other task.

**Before assuming a new package is safe**, check for a nested React copy —
`ls node_modules/<pkg>/node_modules/` — and look for `react` or `react-dom`. Two React
copies cause failures that are very hard to trace later. `react-datasheet-grid` already has
a nested `react-dom@18` for exactly this reason (DEPENDENCIES.md §7.1).

**Never run `npm audit fix --force`.** It downgrades across majors to satisfy advisories
that may not even be reachable here. Assess each advisory on whether the vulnerable code
path exists in this app, record the assessment in `DEPENDENCIES.md` §5, and leave the
version alone if it does not.

## Domain facts that are easy to get wrong

- **An observation is 1 country × 1 year × 1 variable/cross.** It is valid with
  `value: null` as long as it carries metadata — the FR is explicit about this.
- **A cross is NOT a separate entity.** It is a multi-dimension tuple on one observation:
  a plain `HF.1` fills only the `HF` column; `HC.1 × HF.1` fills both `HC` and `HF`.
  Do not add a `crossId` field.
- **`SURVEY_FK` = `{ISO3}-{YEAR}`** (e.g. `ARG-2021`) — the country×year key.
- **The xMart long-format columns, in order** (from the FR screenshots — use verbatim):
  `SURVEY_FK, AGE, DIS, FP, FS, FS_RI, GEN, HC, HC_RI, HCR, HF, HK, HKR, HP, IND, MACRO,
  VALUE, SOURCES, COMMENT, WEB_LINK, EST_METHOD, DATA_TYPE, Sys_RowId, Sys_Origin,
  Sys_LoadBatchId, Sys_CommitDateUtc, Sys_FirstLoadUser, Sys_ID, Sys_BatchId,
  Sys_FirstBatchID`
- **Formulas reference other formulas** (`CHE%GDP` → `CHE` → `HF.*`) and each carries a
  null-guard (`any-not-null` vs `all-not-null`). A failed guard yields **blank, not 0** —
  this is visible in exports and the RFP cares about it. Requires a dependency graph with
  topological evaluation and cycle detection, never string substitution.
- **Variable codes contain `.`, `%`, `$` and `-`** (`CHE%GDP_SHA2011`,
  `GGHE-D_pc_US$_SHA2011`). Tokenise refs greedily against the known-variable set; never
  infer token boundaries from characters.
- **Two roles only**: Administrator and Regular user. Admins implicitly hold every
  regular-user right — per UC007 there is no capability a regular user has and an admin
  does not. Permission levels are the six in UC008 (see `src/domain/permissions.ts`).
- **Users are never hard-deleted** (UC012). Only disabled.
- **Regular users always retain view + export** on modules they cannot edit (UC007), so
  `no-access` is never a regular-user default.

## Workbook: what we keep from the legacy DMS, what we replace

The Workbook is the product, and it is a deliberate re-skin of a tool the HA team has
used for years. Both halves of this are binding (plan §2.4):

**Keep — this is muscle memory, do not "improve" it.** Years across the top, variables down
the side, a scale/currency selector ("Millions (Default)"), and the row semantics from the
legacy screenshots: **blue = country-reported values, pink = calculated indicators**. The
dark palette preserves the same semantics; use `--who-cell-*`, never a hardcoded tint.

**Replace — these are requirements of Phase 4, not polish.**

| Legacy | Replacement |
|---|---|
| Permanent filter dropdown row | **Filter chips** — removable, click to reopen the picker, `+ Add filter`; serialised to URL search params so a selection is a shareable link |
| Headers scroll away, 100% zoom control compensates | **Frozen** year header row, variable label + code column, and corner |
| Paged / zoomed fixed table | **Virtualised** continuous scroll — never paginate a data-entry surface, it breaks range copy/paste |
| Metadata on a separate sheet tab | **Inline metadata** — marker on cells that have it, drawer opens *beside* the grid without unmounting it, cell selection survives open/edit/close |

That last one has a test attached: if reading a cell's metadata loses your place in the
data, the legacy problem has been rebuilt and the drawer is wrong.

## Seeded data (Phase 1)

**Observations are derived, not stored.** A value is a pure function of
`(iso3, year, variableCode)` through a seeded FNV-1a hash (`generators/seedRandom.ts`), so
the store is that function plus a small overlay of user edits in `localStorage`. Never
materialise the corpus — ~970,000 observations are derivable and any slice costs
microseconds. This is also what makes the UC057 "up to 25 million rows" answer honest.

Consequences to respect:

- **Never use `Math.random()` for a value.** Only for presentation (the mock client's
  artificial latency). Anything affecting data goes through the seeded hash, or the demo
  drifts between runs and screenshots stop matching.
- **All timestamps derive from `DEMO_NOW`** (`2026-08-01`), not the wall clock.
- **Aggregates are never generated.** Parents and totals are `isCalculated: true` and get
  computed by the formula engine from reported leaves. That is deliberate: it is what makes
  the engine visible in the demo.
- **Series anchor at `LAST_YEAR` and grow backwards**, because the seed figures
  (population, exchange rate) describe the present. Anchoring at 2000 and compounding
  forward once gave India 2.7 billion people and Canada a $619k GDP per capita.
- **Economic realism is tested, not assumed.** `__tests__/phase1.test.ts` locks in the
  income gradients — out-of-pocket and external financing both fall as income rises, real
  reference exchange rates, residual `.nec` buckets stay small, `HF.1.1`/`HF.3.1` always
  reported. Re-run after any generator change; an HA economist will spot wrong data
  instantly and these ratios are what they look at first.
- **QC defects are declared, not emergent** (`generators/defects.ts`). Phase 5 needs real
  findings at named countries and years the demo can navigate to. All eight UC053
  categories are covered.
- **Seeded people are fictional.** The RFP names real WHO staff in its distribution list
  and RACI matrix; do not seed them as demo records.

## Design tokens and theming

All colour lives in `src/styles/globals.css`. **A hex code may appear nowhere else** — not
in a component, not in an inline style, not in a chart config. Two layers:

1. **Raw values** in `:root` (light) and `.dark` (dark). Light values are lifted from
   `Reference/html_pages/sass/`; dark values are designed, because the reference is
   light-only.
2. **`@theme inline`** maps them into Tailwind's `--color-*` / `--shadow-*` namespace.
   `inline` is required — it makes Tailwind emit `var(--who-x)` into each utility instead
   of the resolved value, which is what lets utilities follow the active theme.

Use them as utilities: `bg-who-surface`, `text-who-heading`, `border-who-border`,
`shadow-who-card`, `w-sidebar`, `h-header`, `pt-content-top`, `pl-content-left`,
`text-[length:var(--text-body-sm)]`.

**Content vs surface — do not merge these back.** The reference uses `$violet-dark`
(`#43425D`) for both heading text and the primary button fill. Identical in light, but they
must move in opposite directions in dark, so they are split:

| Token | Role | Never use for |
|---|---|---|
| `who-heading` | heading/label **text** | a background |
| `who-brand` / `who-brand-hover` | primary button **fill** | text |
| `who-on-brand` | text on `who-brand` or `who-sidebar` | anything on a page surface |
| `who-surface` / `who-surface-raised` | cards, header, popovers | text |
| `who-page-bg` | app canvas | text |

`who-hint` is 2.2:1 on white — **decorative hints only, never essential text.**
`who-primary-blue` is 3.5:1 on white — fine for borders, rings and underlines; never for
body text on a light surface.

Geometry (theme-invariant): sidebar 260px · header 70px · content `110px 40px 80px 300px` ·
collapses at `md` (768px), matching the reference's 767px breakpoint.

**Stacking order — all fixed chrome must stay below z-50.** Radix renders every overlay
(dropdown, popover, tooltip, select, dialog, sheet, command) into a portal on
`document.body` at `z-50`. Those portals are siblings of the chrome, so chrome above 50
paints over the top of open menus:

```
z-20  header          z-30  mobile scrim          z-40  sidebar
z-50  Radix portals ← shadcn default, never edit the generated components
```

Never raise chrome above `z-40` and never lower a shadcn overlay — fixing it in the
generated files would have to be redone on every `shadcn add`. If you need a new layer,
fit it into the gaps. The scale is documented in `globals.css` too.

shadcn's semantic variables (`--primary`, `--ring`, `--border`, …) are mapped onto the WHO
tokens in a single `@theme inline` block. Because the right-hand sides are `var()`s that
flip in `.dark`, all 28 components are themed in both modes with no per-component
overrides. Add a shadcn component and it is correctly themed on arrival.

Theme state is `next-themes` (`ThemeProvider`, `attribute="class"`, `storageKey`
`dms-theme`, `defaultTheme` **light** so a demo opens identically on any machine).
`index.html` carries `class="light"` so the first paint is never the wrong theme.

**Re-run the contrast audit after any token change.** The dark theme passes AA on every
pair. The light theme has three known shortfalls, all inherited from the WHO reference
palette and all deliberately left alone — the table at the foot of `globals.css` records
them with the reasoning. Do not "fix" them by inventing new brand colours.

## Setup module patterns (Phase 2)

- **`ComponentGrid` is shared by Countries and Currencies.** They are plain xMart records
  with attribute definitions, so one implementation covers UC014–UC022 for both. Adding a
  third such component means passing new `seededAttributes`, not new UI.
- **`DataTable` is the list grid everywhere** — Setup, Users, Reports, QC. Drag-reorderable
  headers (UC015) are wired through `onColumnOrderChange`; the caller persists.
- **Column order and LOV/grouping overrides live in `setupStore` and persist.** UC015's
  acceptance is explicitly that the order survives a reload, so that is a regression test,
  not a nicety.
- **`effectiveAttributes` is pure; `useEffectiveAttributes` is the hook.** The pure form
  takes its overrides as an argument rather than calling `getState()`, so `useMemo`
  dependencies stay honest and the UC015/016/022 merge logic is testable without a store.
- **Tabs are URL-addressable** (`/setup?tab=formulas`) and only the active tab mounts —
  mounting all seven would fire seven xMart queries on arrival.
- **Regular users keep view + export on every tab.** UC007 requires it, so the read-only
  variant hides create/edit affordances but never the export buttons.

## Dependency notes

**[DEPENDENCIES.md](DEPENDENCIES.md) is the full register** — every package, its installed
version, and why that version. Read §6 (do-not-upgrade list) before touching `package.json`.
The highlights:

- **`@tanstack/react-table` is pinned to v8.** v9 is a full API rewrite — `useTable` instead
  of `useReactTable`, feature composition instead of row models, atom-based subscriptions,
  and deprecated direct state reads. npm resolves `^9` by default, so `npm i` without a
  version will silently break every grid. Do not "upgrade" it.
- **`react-datasheet-grid`** is the workbook grid, not Glide Data Grid. Glide's latest
  release supports React 16–18 only (everything past it is alpha) and would pull in
  `lodash`, `marked` and `react-responsive-carousel` as peers. UC057's 25-million-row
  figure describes volume *retrieved from xMart*, not cells rendered at once — a workbook
  is a bounded 2D slice (~6,000 cells), so DOM virtualisation is right-sized. The scaling
  story belongs to the API layer.
- **`xlsx` is installed from `cdn.sheetjs.com`, not npm.** The npm package is abandoned at
  0.18.5 with two unfixed high-severity advisories. Do not "fix" this by reinstalling from
  npm.
- **`react-router-dom` sits on one known advisory** (RSC-mode CSRF bypass) with no fixed
  release — the range is 7.12.0–8.2.0 and 7.18.2 is `latest`. It is unreachable here: no
  server, no RSC, no actions. **Do not run `npm audit fix --force`** — it downgrades to
  7.11.0, a semver-major break that also triggers ERESOLVE peer conflicts against React 19.
- No `baseUrl` in tsconfig (TypeScript 6 deprecates it); `paths` alone resolves `@/*`. The
  alias is mirrored in the root `tsconfig.json` because the shadcn CLI reads it from there.

## Conventions

- Comments explain **why**, and cite the use case or FR section when a rule comes from the
  RFP (`// UC031: formula cells render in a different colour + italic`). Do not restate
  what the code says.
- Prototype-only affordances (role switcher, "Reset demo data", simulated second user) are
  labelled as such in the UI so nobody mistakes them for product features during a demo.
- Mock data uses a **seeded PRNG** — identical every run, so the demo script never drifts.
