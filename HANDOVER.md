# Handover — where this stands, and what to do next

**Last updated:** 7 August 2026, end of Phase 8 — **the build is complete**.

This file is deliberately **thin**. Everything durable already lives in three other
documents, and duplicating them here would create a second source of truth that drifts out
of date. This file only records what those documents do not: exact current state, how to
verify it, and the open items. **Two more documents joined them at Phase 8** — see §1.

---

## 1. Read in this order

| # | Document | What it is | Read it |
|---|---|---|---|
| 1 | **[CLAUDE.md](CLAUDE.md)** | The durable rules. Four structural rules, the mandatory dependency-reporting rule, design tokens, the stacking order, seeded-data invariants, Setup patterns. | Before writing any code. It is short and every line is load-bearing. |
| 2 | **[PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md)** | The full plan: requirements extracted from the RFP, tech-stack rationale, file structure, the 8-phase roadmap with **outcomes recorded per phase**, the 12-minute demo script, coverage matrix. | §1 for the requirements, then the phase you are about to build. It is 70KB — do not read it end to end. |
| 3 | **[DEPENDENCIES.md](DEPENDENCIES.md)** | Every package, resolved version, and why that version. §6 is the do-not-upgrade list. | Before touching `package.json`. |
| 4 | **[README.md](README.md)** | The two proposal exhibits: the **mock/real boundary table** and the **row-by-row use-case matrix** over all 64 RFP rows. Plus the architecture diagram and how to run and verify everything. | Before showing this to anyone, and before claiming anything about coverage. |
| 5 | **[DEMO_SCRIPT.md](DEMO_SCRIPT.md)** | The 12-minute click path with the exact URL for every beat and the sentence to say while it loads, plus the questions to expect and the recovery steps. | Before presenting. |
| 6 | `Requirements/*.docx` | The RFP itself, read-only. | When a requirement is ambiguous — the plan quotes it but the source is authoritative. |
| 7 | `Reference/html_pages/` | The WHO JEE Reporting design pack, read-only. Source of every design token. | If you need a pattern the tokens do not already cover. |

**Never edit `Requirements/` or `Reference/`.** Both are inputs.

---

## 2. State of play

All 8 phases are complete and verified in a browser. There is no next phase.

| Phase | Status | What exists |
|---|---|---|
| **0 — Foundation** | ✅ Done | Vite 8 + React 19 + TS 6. App shell pixel-matched to the reference (260px sidebar, 70px header). All 8 modules routed. Mock SSO with a demo role switcher. **Light + dark theme** with a WCAG audit. |
| **1 — Domain + mock xMart** | ✅ Done | Pure `domain/` layer. 194 real WHO Member States, 143 currencies, SHA 2011 classifications (HF verbatim from FR §1), all 16 HLR8 formulas. Observations **derived on demand** from a seeded hash. `XMartClient` + mock implementation + API call log. |
| **2 — Setup module** | ✅ Done | All 7 tabs live against the mock client. `DataTable` with drag-reorderable headers (UC015, persisted). Cross builder, formula editor with per-country overrides, metadata fields, reporting follow-up. Read-only variant for regular users. |
| **3 — Formula engine** | ✅ Done | `src/domain/formula/` — tokeniser, recursive-descent parser, AST, dependency graph with topological order and cycle detection, evaluator, null-policy guards, series maths, 10 functions. All 16 seeded formulas evaluate live on the Formulas tab with an AST/dependency inspector. **129 passing tests.** |
| **4 — Workbook** | ✅ Done | The product. `react-datasheet-grid` with a frozen year header, a frozen variable label+code column and a frozen corner; filter chips serialised to the URL; editing with live recompute through the Phase 3 engine; three-mode clipboard; undo/redo; a metadata drawer *beside* the grid; series tools; bulk status; locking; version compare; xlsx export; Save → xMart. **166 passing tests** + a 34-check browser harness. |
| **5 — Quality Checks** | ✅ Done | `src/domain/qc/` — ten rule categories, the UC054 threshold table, seventeen delivered rules, a pure runner. Rule list with developer / administrator / custom origins visibly distinct, rule editor with UC048 exclusions and a one-click reset, administrator-only thresholds, run by country or by attribute group, findings report with a scatter and .xlsx/.csv download, and **UC052 wired into the workbook** — cells ring in place. **241 passing tests** + a 49-check browser harness. |
| **6 — Reports** | ✅ Done | `src/domain/report/` — field catalogue, definitions, unit/currency/scale, and `pivot.ts` with subtotals. Six delivered reports, a drag-based pivot builder with a live preview, favourites and drag-order that survive a reload, duplicate-as-custom, a run page with the unit / currency / scale / language prompts and a screen-or-download choice, the UC039 data tracking report, and the **UC042 background queue** producing one real `.xlsx` per country with an in-app notification carrying a working download link. Notification store + header bell built here. **299 passing tests** + a 51-check browser harness. |
| **7 — Users, dashboard, integration** | ✅ Done | `src/domain/users/`, `src/domain/notify/`, `src/domain/integration/`, `src/domain/home/` — all pure and tested. The Users list with inline role/active controls, grant-access by email, the last-administrator guard, and no delete anywhere. The UC008 matrix with a live capability preview, feeding the same value `usePermissions` reads. The Home dashboard: reporting round, due dates, publication queue, quality findings, submissions and a completeness heatmap. The integration module in three tabs — live To-Be architecture, per-source sync, the API call log and UC044's dataset restore — plus the Dev drawer the header button has been toggling since Phase 0. The Annex 3 simulator answering all thirteen rows and producing a real CSV. The notifications module: event catalogue, subscriptions, and UC023 due dates as a second sender. **411 passing tests** + a 92-check browser harness. |
| **8 — Polish, demo script, packaging** | ✅ Done | Route-level `React.lazy` on all 15 page components — the critical path is **225 kB gzipped**, down from 636 kB in one chunk — with `Suspense` + an `ErrorBoundary` inside the shell so a failed route keeps the navigation. `scripts/contrast-audit.mjs` promoted into the repo and grown to **52 pairs × 2 themes**, which found eight real failures and moved five token values. `scripts/bundle-report.mjs` as a critical-path gate. The keyboard pass (Esc on the two non-Radix panels; `Ctrl+Z` no longer hijacks text fields). The responsive sweep at 1920/1440/1280/1024/768 × both themes, which found one real overflow. Static hosting fixed for deep links (`404.html` + `scripts/serve-dist.mjs`). **[DEMO_SCRIPT.md](DEMO_SCRIPT.md)** and a rebuilt **[README.md](README.md)**. The CHE financing split now reconciles. **413 passing tests**, **386 asserted browser checks**, all re-run against the production build on a bare static server. |

**Use-case coverage.** All **64** RFP rows are accounted for: **40 of the 41 Pilot use cases are
demonstrable in the application** (35 fully, 5 with a stated limit — UC006, 028, 045, 046, 056),
the 41st being UC061 *Phased implementation*, which is a delivery plan answered by
PROTOTYPE_PLAN.md rather than by software. **13 non-Pilot use cases are covered in full**
(UC003.1, 008, 009, 010, 011, 032, 033, 034, 037, 038, 040, 058, 059), 7 partially and 3 not at
all, each naming its reason. All ten Annex 3 mandatory rows are on one screen — 8 live, 2 as
design commitments.

**The row-by-row matrix is [README.md §5](README.md#5-use-case-coverage).** It was rebuilt at
Phase 8 from the RFP's *own* summary table and cross-checked programmatically (64 rows, no
missing, no extra, no Pilot-flag mismatches) — the earlier count of "41 covered / 12 bonus" came
from PROTOTYPE_PLAN §1.5, which omits UC061 and understated UC034. Both corrections are recorded
in PROTOTYPE_PLAN §8. **Do not re-derive this matrix by hand;** if it needs changing, re-extract
the Pilot flags from the .docx the way Phase 8 did.

---

## 3. Getting it running

```bash
cd dms-prototype
npm ci                              # or npm install
npx playwright install chromium     # one-off, only for the verify:* scripts
npm run dev                         # http://localhost:5173
```

Sign in with either demo identity on the login screen — the role switcher in the header
swaps between Administrator and Regular user at any time, which is how the permission
behaviour is demonstrated.

### The three gates — run all three before calling anything done

```bash
npx tsc -b        # typecheck
npm test          # 413 unit tests (domain, formula engine, workbook, QC rules, pivot, users,
                  #                 notifications, Annex 3, dashboard, mock client)
npm run build     # production build
```

### Two static audits — no server, no browser, and both are gates

```bash
npm run audit:contrast   # WCAG 2.1 over 52 token pairs × 2 themes, read from globals.css
npm run audit:bundle     # critical-path budget + route-split regression guard (needs a build first)
```

Both exit non-zero. `audit:contrast` **also fails if one of the three documented light-theme
shortfalls has got worse**, so "documented" cannot decay into "ignored". `audit:bundle` fails if
SheetJS, Recharts or the datasheet grid reappears on the first-paint path, if the critical path
passes 250 kB gzipped, or if a page component stops being a lazy chunk — all three of which
happened during Phase 8 and none of which are visible in `npm run build`'s output.

### Demoing it

Serve the **build**, not the dev server — see [DEMO_SCRIPT.md](DEMO_SCRIPT.md):

```bash
npm run build
npm run serve:dist       # http://localhost:4173 — zero dependencies, SPA fallback, no network
```

`vite preview` also works, but a *bare* static server (`python -m http.server`) returns 404 for
every route except `/`, which breaks every URL in the demo script. `file://` cannot work at all —
the scheme blocks ES modules and has no path rewrite.

### Browser verification

These are diagnostic harnesses, not CI gates. **Start `npm run dev -- --port 5199` first**,
then in another terminal:

```bash
npm run verify:theme    # both themes, resolved token values, shadcn aliases, toggle persistence
                        # (the contrast RATIOS moved to `npm run audit:contrast` at Phase 8)
npm run verify:setup    # all 7 Setup tabs, UC015 reorder-survives-reload, admin vs regular
npm run verify:formulas # Phase 3: all 16 formulas evaluated, AST + dependency graph, cycle refused
npm run verify:workbook # Phase 4: the whole demo path — 34 checks, incl. the four §2.4 replacements
npm run verify:qc       # Phase 5: rule list, a run, the report, UC048/UC054, UC052 in the grid — 49 checks
npm run verify:reports  # Phase 6: the whole acceptance path — build, save, run 5 countries,
                        #          5 .xlsx downloaded and checked on disk — 51 checks
npm run verify:phase7   # Phase 7: dashboard, the UC010 guard, the UC008 matrix beat, the
                        #          integration tabs, UC044 restore, Annex 3 (CSV read off
                        #          disk), notifications — 92 checks
npm run verify:zindex   # overlays are not clipped by the header (see CLAUDE.md stacking order)
npm run verify:shell    # sidebar/header at 1440 / 768 / 390, permission-filtered nav
npm run verify:keyboard # Phase 8: Ctrl+Z/Y, Ctrl+C/V, arrows, Tab/Enter commit, Esc on every
                        #          overlay incl. the two non-Radix panels — 32 checks
npm run verify:responsive # Phase 8: 1920/1440/1280/1024/768 × both themes, plus a
                          #          horizontal-overflow probe that names the offending
                          #          element — 123 checks, 112 screenshots
```

**Run them against the production build too.** Phase 8 did, and it is the only way to catch a
lazy chunk that fails to load or a route that 404s on a static host:

```bash
npm run build && npm run serve:dist &
DMS_URL=http://localhost:4173 npm run verify:workbook

`verify:phase7` leaves the app in its delivered state — it resets the permission matrix at
the end. If a run is interrupted mid-section, the matrix may still hold Reports at *View*;
the Reset to delivered button on `/users/role-permissions` puts it back.

Screenshots land in `dms-prototype/artifacts/` (gitignored). Override the target with
`DMS_URL=http://localhost:4173 npm run verify:theme` to check a production preview.

`npm run audit:contrast` is the one to re-run after **any** token change — the light theme has
three known contrast shortfalls that are deliberate, documented at the foot of `globals.css`, and
must not be "fixed" by inventing new brand colours. It takes under a second and needs nothing
running.

---

## 4. The build is complete — what that leaves you

There is no next phase. What follows is what the finished build assumes, so the next person to
touch it does not undo something on purpose.

### Things that will break quietly if you change them

- **`routes.tsx` holds fifteen `React.lazy()` calls, and every one is at module scope.** A
  `lazy()` created *inside* a component returns a new component type on every render, which
  remounts the page and throws away its state on every keystroke. `npm run audit:bundle` fails if
  a page stops being its own chunk, so the split cannot silently narrow — but it cannot catch
  `lazy()` in the wrong place.
- **`lib/download.ts` imports nothing, and that is load-bearing.** Anything reachable from the app
  shell must import `downloadBlob` / `stamped` / `downloadCsvText` from **`lib/download`**, never
  from `lib/exporters` — the latter imports SheetJS, and one such import in the header's
  notification bell put 487 kB of spreadsheet writer on the sign-in screen. `audit:bundle` guards
  it.
- **No `vendor-charts` chunk group in `vite.config.ts`, deliberately.** An earlier revision had
  one, and Rolldown put a shared low-level helper into it, so *every* chunk imported one function
  from it and 369 kB of Recharts was `modulepreload`ed on the sign-in screen. Recharts has one
  consumer; the default splitting already does the right thing. The comment in the config says so.
- **The workbook's `Ctrl+Z`/`Ctrl+Y`/`Ctrl+C`/`Ctrl+V` listener is on `window`** and skips any
  editable element outside `.dsg-container`. Remove that guard and typing in the metadata drawer
  starts undoing grid edits — verified by `npm run verify:keyboard`.
- **The metadata drawer and the QC findings panel are not Radix portals**, by §2.4: they must not
  unmount the grid. They therefore do not get Esc, focus trapping or a scrim for free, and
  `useEscapeKey` is what gives them Esc. If either is ever converted to a `Sheet`, the §2.4
  acceptance test — *"reading a cell's metadata must not lose your place in the data"* — fails.
- **The `ErrorBoundary` and `Suspense` sit inside `AppShell`, around the `Outlet`, keyed on the
  pathname.** Inside, so the sidebar and header survive a failed route and the recovery is
  "click another module". Keyed, because a class boundary has no automatic reset and would
  otherwise hold a caught error across navigation.

### Things that are true and worth not rediscovering

- **`authStore.regularPermissions` is the only permission matrix.** `usePermissions` reads it, the
  UC008 editor writes it, the capability preview recomputes from the same functions the app gates
  on. Never a second table.
- **Six pure domain areas**, all taking their data as arguments and returning values:
  `domain/formula/`, `qc/`, `report/`, `users/`, `notify/`, `integration/`, `home/`. That is what
  makes the dashboard's numbers testable against the seeded corpus rather than only inspectable.
- **`notificationStore` has two senders** — UC042's job queue and `useDueDateNotifications`
  (UC023). If you add a third, read the dedupe/cap note in CLAUDE.md first; both of the bugs that
  hook went through are invisible in a unit test.
- **The API call log is in-memory module state.** A full page load resets it, so a harness
  comparing the log before and after an action must navigate by clicking, not by URL.
- **`scripts/verify-phase7.mjs` resets the permission matrix when it finishes**, so the app is
  left in its delivered state.
- **`scripts/serve-dist.mjs` is the demo server**, not `vite preview` and definitely not
  `python -m http.server`. See §3.

## 5. Open items

Phase 8 closed items 1–5. What remains is either **a considered trade-off with no work
attached**, or **work that needs a backend to exist**. Nothing here is a defect and nothing here
blocks a demo.

### Closed at Phase 8

| # | Item | Outcome |
|---|---|---|
| 1 | `date-fns`, `nanoid`, `@faker-js/faker` installed but never imported | **Removed.** Verified unused across `src/`, `scripts/`, `index.html` and `vite.config.ts` first, and with `npm ls` that nothing else depended on them. DEPENDENCIES.md §7.3. |
| 2 | Promote the contrast audit into the repo | **`scripts/contrast-audit.mjs`**, and it grew from 18 pairs to 52 because Phases 4–7 added new *combinations* rather than new tokens. That found **eight real failures** and moved five values — the detail is in PROTOTYPE_PLAN's Phase 8 outcome. The three documented light-theme shortfalls are unchanged, and the script now fails if one of them gets worse. |
| 3 | The before/after demo slide needs the legacy screenshot | **Extracted** to `docs/assets/legacy-express-report.png` and embedded in DEMO_SCRIPT.md's 3:00 beat, beside the workbook. |
| 4 | The CHE financing split did not reconcile (116% for Canada 2022) | **Fixed.** `GGHE-D` is derived from `FS.1 + FS.3`, so the three indicators partition the same eight FS leaves; median reconciliation across 194 countries is **99.9%**. The fix exposed a bigger problem — France at 31% government-financed — solved by sizing government revenue as a *ratio to the realised private weights*, banded by income. Two new tests. |
| 5 | The bundle was 2.11 MB in one chunk | **225 kB gzipped critical path.** `React.lazy` on all fifteen pages, plus `npm run audit:bundle` as a gate so it stays that way. |

### Standing trade-offs — no work attached, revisit only if the premise changes

| # | Item |
|---|---|
| 6 | **QC report findings are not persisted, only run summaries are.** A thousand findings per run would fill the same `localStorage` quota the workbook's unsaved edits depend on, so findings live in memory for the session and a reloaded report offers to re-run its scope. The run is reproducible *exactly* — the corpus is derived, not sampled — so this costs a click rather than data. Needs a backend. |
| 7 | **The QC check budget (`DEFAULT_MAX_CHECKS`, 400k value reads) is not reached by any delivered scope**, but a user-authored rule naming a hundred codes over every country would hit it. Truncation is reported per rule rather than hidden. No screen offers "run everything over all 194 countries"; measure before adding one. |
| 8 | **UC020 (delete one component value) is not built.** Proving a value is unused needs a full-corpus scan the front end cannot honestly perform, so the LOV editor **states the constraint** instead of faking the check. Needs a backend. |
| 9 | **Report jobs and their generated `.xlsx` blobs are session state.** Several megabytes of binary, same quota as item 6. Notifications themselves persist, and a download link whose files have been dropped says so and offers to re-run. Needs a backend. |
| 10 | **UC041 is partial.** EN / FR / ES are selectable for report labels; AR / ZH / RU are listed, disabled, each carrying its reason. Arabic needs right-to-left layout, which is scoped in the proposal rather than faked. Completing the other two is a *content* task — translated variable labels in the seeded configuration — not a code one. |
| 11 | **`Variable.isCurrency` is per dimension, and MACRO mixes monetary series with population, an exchange rate and a PPP factor.** `domain/report/units.ts` names the three monetary members (`MONETARY_MACRO_CODES`) rather than reopening the Phase 1 seed. If the seed ever grows per-row currency flags, delete that constant. Deliberately left as-is at Phase 8: reopening the seed to remove one constant would invalidate every locked-in economic ratio in `phase1.test.ts` for no behavioural gain. |
| 12 | **Two shadcn chart slots are unreadable on the dark surface.** `--color-chart-2` and `--color-chart-3` map onto `--who-sidebar` and `--who-brand`, at 1.25:1 and 2.48:1. **Nothing draws with them** — the one chart in the app uses `--who-fail` and `--who-warn` — so `audit:contrast` records this rather than reporting it as a failure. **Fix them before adding a second chart.** New at Phase 8. |
| 13 | **UC031.1 (order workbook data by any element) is not built.** Row order follows the classification hierarchy, which is what makes the parent/child colouring legible; an arbitrary sort would break the visual grouping the §2.4 "keep" list depends on. A roadmap line, not a gap in the Pilot scope. |

---

## 6. Working conventions for whoever continues

- **Commit per phase, not per session.** Followed from Phase 3 onward — `git log` now reads as
  one commit per phase, naming the use cases it closes. Phases 0–2 are inside the initial
  commit, so their decision trail lives only in PROTOTYPE_PLAN.md's outcome notes.
- **Record decisions where they will be re-read.** A phase outcome goes in
  PROTOTYPE_PLAN.md; a rule that must survive into future sessions goes in CLAUDE.md; a
  dependency goes in DEPENDENCIES.md. This file is not the place for any of them.
- **When the plan turns out to be wrong, revise the plan.** It has now been corrected six times
  — the grid choice, the light/dark decision, the Phase 1 latency gate, the Phase 5 demo scope,
  and at Phase 8 the coverage counts in §1.5/§8 and the demo skeleton's "196 countries". Each
  revision is marked in place with the reason. That is the intended behaviour, not a failure of
  planning — and it matters most for the coverage matrix, which a panel reads with the RFP open.
- **Be honest about what is simulated.** The Dev drawer, the "virus scan happens
  server-side" note on import, the Annex 3 rows marked *design commitment* rather than
  *demonstrated*, the ◐ rows in README §5 that each name their own limit, and the labelled
  prototype-only affordances all exist because overstating what is built is the one thing that
  loses a WHO evaluation. **The temptation is strongest in the coverage matrix**, which is why
  Phase 8 rebuilt it from the RFP's own table and checked it with a script rather than by eye.
- **Prefer a script that fails to a note that asks.** Phase 8 turned two claims into gates —
  `audit:contrast` and `audit:bundle` — and both immediately found things a comment had been
  politely asking someone to check for three phases.
