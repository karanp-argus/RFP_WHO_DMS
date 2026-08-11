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

npm run audit:contrast   # WCAG over 52 token pairs × 2 themes — no server, no browser
npm run audit:bundle     # critical-path budget + route-split guard (run after a build)
npm run serve:dist       # serve dist/ with SPA fallback, zero dependencies — the demo server
```

**`audit:contrast` and `audit:bundle` are gates, not reports.** Both exit non-zero. Run
`audit:contrast` after **any** change to `globals.css` and `audit:bundle` after any change to
`routes.tsx`, `vite.config.ts`, or an import in a module the app shell can reach.

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
  income gradients — out-of-pocket and external financing both fall as income rises,
  government financing rises with it, real reference exchange rates, residual `.nec` buckets
  stay small, `HF.1.1`/`HF.3.1` always reported. Re-run after any generator change; an HA
  economist will spot wrong data instantly and these ratios are what they look at first.
- **`GGHE-D` is `FS.1 + FS.3` — it is not an independent share of CHE.** SHA 2011 splits
  revenues into eight FS leaves, and three seeded indicators partition them:
  `GGHE-D = FS.1 + FS.3`, `PVT-D = FS.4 + FS.5 + FS.6 + FS.nec`, `EXT = FS.2 + FS.7`. So
  `GGHE-D%CHE + PVT-D%CHE + EXT%CHE` **must** land near 100. Drawing `GGHE-D` separately gave
  Canada 2022 a 116% financing split — the engine and the arithmetic were both right, the two
  generator paths simply were not tied together, and it is the first line an economist reads.
  The residual 93–107% band is *intended*: `CHE` sums the HF partition and these sum the FS
  one, each with its own coverage draw, and the QC between-category rules need genuine small
  discrepancies alongside the planted ones.
- **The three financing weights are a system, not three independent knobs.**
  `GOV_REVENUE_RATIO`, `OOP_MULTIPLIER` and `EXTERNAL_WEIGHT` must move against each other or
  the picture contradicts itself. Government revenue is sized as a **ratio to the realised
  private weights** rather than drawn independently — independent draws multiply two spreads
  together and put France at 31% government-financed.
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

**Re-run `npm run audit:contrast` after any token change.** It parses `globals.css`, resolves
every `var()` chain, composites the alpha tints Phases 5–7 draw status text on, and measures **52
pairs in both themes** — no server, no browser, under a second. The dark theme passes every bar.
The light theme has **three known shortfalls**, all inherited from the WHO reference palette and
all deliberately left alone; the table at the foot of `globals.css` records them with the
reasoning, and **the script fails if one of them gets worse**. Do not "fix" them by inventing new
brand colours.

A colour is a property of a **pair**, not of a token. Phases 4–7 added no new tokens and still
introduced eight failing combinations — status text on a 10% tint of itself, UC031's blue italic
on a *pink* calculated row, two heatmap bands with the same luminance. When you use an existing
token somewhere new, add the pair to `scripts/contrast-audit.mjs`.

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

## Reports module patterns (Phase 6)

- **Conversion happens per observation, before aggregation, and the unit label carries the
  country's currency** (`CAD millions`, never a generic `NCU millions`). A total whose
  contributions arrived in more than one unit produces **no number** — summing pesos and yen
  is the failure this guard exists for, and an anonymous unit string would let it through
  looking correct. Only `UNITS.NCU_MILLIONS` series convert or rescale; percentages and
  per-capita dollars pass through untouched.
- **`reportFetchCodes` expands formula ASTs as well as aggregates.** `reportedCodesFor`
  (Phase 5) only expands parents to children, which is enough for a QC rule but fetches
  nothing for an indicator — `CHE%GDP` reaches its inputs only through its expression. If a
  new screen needs the reported leaves behind an indicator, use the report expander.
- **UC037 is literal: a custom report is invisible to administrators too.** This differs
  from UC050, where a regular user's private QC rules *are* visible to admins so one can be
  promoted. Do not "fix" the asymmetry — both are what their use case says.
- **Values are measures, not fields.** An observation carries one number, so the builder's
  Values bucket accepts the five aggregations of it and nothing else. UC036's "groupings"
  is a subtotal toggle on a placed field, inert on the innermost one.
- **`notificationStore` is the delivery mechanism for every in-app notification.** Phase 6
  built it for UC042; Phase 7's notification module adds senders and configuration around
  it, not a second store.

## UC041 multilanguage reports — three rules

All six WHO languages are translated (`src/data/seed/translations/`, one module per language,
178 variable labels each). The full reasoning is PROTOTYPE_PLAN §9; these three are the ones
that break something if ignored.

- **Never import a language pack statically.** `loadReportVocabulary` uses a literal `switch`
  of dynamic `import()`s so each pack is its own lazy chunk. The English seed is reached from
  `mockClient`, which `index.html` references directly — a static import would put ~100 kB of
  labels on the sign-in screen and trip `audit:bundle`, which has ~24 kB of headroom. A
  template import (`import('./' + lang)`) is equally wrong: it becomes a glob and loads all
  five to serve one.
- **Translate labels, never keys.** `unitOf()` returns `UNITS.NCU_MILLIONS` verbatim in every
  language because `presentValue` compares against that exact string to decide convertibility,
  and a pivot cell compares against it to refuse a total that mixed pesos and yen. Translating
  it stops the mixed-currency guard comparing like with like, and the report starts adding
  currencies together silently as soon as somebody picks French. Units, `fieldKey` results and
  saved filter values stay canonical English; translation happens at the edge, through
  `translateUnit` / `fieldHeading` / `variableLabel`.
- **The vocabulary travels on the `PivotTable`, and consumers read it from there.** A viewer
  that chose its own would render a French table with an English "Grand total" on the last
  line. `PivotTableView` and `exportReport` read `table.vocabulary` and nothing else — never
  `REPORT_FIELD_DEFS[...].label` or `REPORT_AGGREGATION_LABELS` directly.

Adding a variable or a formula to the seed means adding a line to all five packs;
`translations.test.ts` names the language and the code that is missing. **Arabic is
labels-only** — the grid is not mirrored, and the run page states that when Arabic is selected.
Do not promote it to "full RTL support" anywhere in the docs.

## Users, permissions and notifications (Phase 7)

- **There is no `deleteUser`, and there must never be one.** UC012 disables rather than
  deletes so log references survive — `Sys_FirstLoadUser`, version authors and every rule's
  `createdBy` point into the directory. The absence is structural, not a hidden button.
- **UC010's guard covers two doors.** Disabling the last enabled administrator *and*
  demoting them to Regular User both empty the role. `applyUserChange` refuses both.
- **`no-access` is never offered to a regular user** (UC007 guarantees view + export on
  every module), and each module offers only the levels that mean something there —
  "Edit Selected Countries" has no meaning on Users. See `domain/users/matrix.ts`.
- **`authStore.regularPermissions` is the single matrix.** `usePermissions` reads it and so
  does the UC008 editor's capability preview; there is no second copy to drift.
- **Subscriptions follow UC050's visibility, not UC037's** — an administrator sees a user's
  subscriptions (so one can be promoted), but never their custom reports. Both asymmetries
  are what their use cases say; do not "fix" either.
- **`notificationStore` is the delivery mechanism; senders live outside it.** UC042's job
  queue and `useDueDateNotifications` (UC023) are the two. A sender must deduplicate against
  the **persisted inbox** and cap on *notices already present*, not on notices raised this
  pass — getting either wrong produces an inbox of duplicates or an infinite render loop,
  and both mistakes read correctly.
- **The completeness heatmap is the one place a null observation counts as unreported.**
  Everywhere else it is a valid record (FR §1). `expected` is a parameter so a country with
  no rows scores zero rather than 0/0.
- **Annex 3 rows carry an evidence level.** OAuth 2.0 and HTTPS are `design`, not
  `demonstrated`. Never promote a row this build cannot exhibit.

## Packaging and polish (Phase 8)

- **Every page component in `routes.tsx` is `React.lazy`, and every `lazy()` is at module
  scope.** A `lazy()` created inside a component returns a new component type on every render,
  which remounts the page and discards its state on every keystroke. The icons stay static — the
  sidebar needs them before any page loads.
- **`lib/download.ts` imports nothing, and that is the point.** Anything reachable from the app
  shell imports `downloadBlob` / `stamped` / `downloadCsvText` from **`lib/download`**, never from
  `lib/exporters` — `exporters` imports SheetJS, and one such import in the header's notification
  bell put 487 kB of spreadsheet writer on the sign-in screen. `audit:bundle` fails if it comes
  back.
- **Do not add a `vendor-charts` chunk group.** One existed and Rolldown put a shared low-level
  helper in it, so every chunk imported one function from it and 369 kB of Recharts was
  `modulepreload`ed on the sign-in screen. Recharts has one consumer and the default splitting
  already lands it there. Same trap for any group: a group whose modules fall below
  `advancedChunks.minSize` is **silently discarded**, not honoured — set `minSize: 0` on a group
  that is deliberately tiny.
- **`Suspense` and `ErrorBoundary` live inside `AppShell`, around the `Outlet`, keyed on the
  pathname.** Inside, so the sidebar, header and role switcher survive a failed route and the
  recovery is "click another module" rather than "reload and sign in again". Keyed, because a
  class boundary has no automatic reset and would otherwise hold a caught error across
  navigation.
- **The workbook's `Ctrl+Z/Y/C/V` listener is on `window` and must keep its editable-element
  guard.** Without it, typing in the metadata drawer and pressing Ctrl+Z reverts a *grid edit* —
  the handler calls `preventDefault`, so it takes the browser's own text undo with it. The guard
  skips any `input`/`textarea`/`select`/`contenteditable` **outside `.dsg-container`**.
- **The metadata drawer and the QC findings panel get Esc from `useEscapeKey`, not from Radix.**
  Both are deliberately flex siblings of the grid rather than portals (§2.4 — they must not
  unmount it), so they get no Esc, no focus trap and no scrim for free. In the drawer, one Esc
  reverts a dirty field and only a second closes the panel: closing it with a half-typed comment
  discards the comment silently.
- **A wide surface scrolls inside its own container; the page never scrolls sideways.** The
  content padding is fixed at `110px 40px 80px 300px`, so an unwrappable button row is wider than
  the content column at 1024 and 768 and slides the whole page under the fixed sidebar.
  `verify:responsive` probes `document.scrollWidth` at five widths in both themes and names the
  offending element.
- **`DialogContent` is a CSS grid, so a wide child needs `min-w-0` as well as its own scroll
  container.** A grid item's default `min-width: auto` lets its *min-content* width widen the
  column track past the dialog's `max-w-*`; every sibling then stretches with it and the whole
  stack paints outside the dialog's rounded background, which is what the paste dialog did with a
  metadata clip. `verify:responsive` cannot see this — it probes the page, and the page does not
  scroll. Measure the overflow against `[data-slot="dialog-content"]`'s own rect.
- **The static demo needs a deep-link rewrite.** `BrowserRouter` makes `/setup` a real path; a
  bare static server 404s on it. The build writes `404.html` and `scripts/serve-dist.mjs` does the
  rewrite properly. **`file://` cannot work** — the scheme blocks ES modules and has no path
  rewrite — and a hash-router shim to work around it would change every URL in DEMO_SCRIPT.md.
- **Never hand-derive the use-case coverage matrix.** README §5 covers all 64 RFP rows, and the
  Pilot flags are extracted from the RFP's own summary table in
  `Requirements/2. Functional Requirements PFD-2026-001.docx` and cross-checked programmatically.
  Hand-derivation is how the earlier "41 covered / 12 bonus" figures came to omit UC061 and
  understate UC034. **Every ◐ row names its own limit** — a partial that does not say what is
  missing reads as a full one, and a panel with the RFP open will find it.

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
