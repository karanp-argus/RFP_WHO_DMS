# Handover — where this stands, and what to do next

**Last updated:** 7 August 2026, end of Phase 7.

This file is deliberately **thin**. Everything durable already lives in three other
documents, and duplicating them here would create a second source of truth that drifts out
of date. This file only records what those documents do not: exact current state, how to
verify it, and the open items.

---

## 1. Read in this order

| # | Document | What it is | Read it |
|---|---|---|---|
| 1 | **[CLAUDE.md](CLAUDE.md)** | The durable rules. Four structural rules, the mandatory dependency-reporting rule, design tokens, the stacking order, seeded-data invariants, Setup patterns. | Before writing any code. It is short and every line is load-bearing. |
| 2 | **[PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md)** | The full plan: requirements extracted from the RFP, tech-stack rationale, file structure, the 8-phase roadmap with **outcomes recorded per phase**, the 12-minute demo script, coverage matrix. | §1 for the requirements, then the phase you are about to build. It is 66KB — do not read it end to end. |
| 3 | **[DEPENDENCIES.md](DEPENDENCIES.md)** | Every package, resolved version, and why that version. §6 is the do-not-upgrade list. | Before touching `package.json`. |
| 4 | `Requirements/*.docx` | The RFP itself, read-only. | When a requirement is ambiguous — the plan quotes it but the source is authoritative. |
| 5 | `Reference/html_pages/` | The WHO JEE Reporting design pack, read-only. Source of every design token. | If you need a pattern the tokens do not already cover. |

**Never edit `Requirements/` or `Reference/`.** Both are inputs.

---

## 2. State of play

Phases 0–7 of 8 are complete and verified in a browser. Phase 8 is unstarted.

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
| 8 — Polish, demo script, packaging | ⬜ Next | |

**Use-case coverage so far:** UC001–002, 006, 013–017, 021–023, 025–030, 060 are
demonstrable, plus **UC024, UC031, UC032, UC033, UC034, UC043, UC044 and UC046** from Phase 4,
**UC047, UC048, UC049, UC050, UC051, UC052, UC053, UC054 and UC055** from Phase 5,
**UC035, UC036, UC037, UC038, UC039, UC040, UC042 and partial UC041** from Phase 6,
and **UC003, UC003.1, UC004, UC005, UC007, UC008, UC009, UC010, UC011, UC012, UC045, UC046,
UC056, UC058 and UC059** from Phase 7 — plus all ten Annex 3 mandatory rows on one screen.
Phase 3 added no use cases of its own — the engine is what makes the Workbook's computed
cells real. The full matrix is in PROTOTYPE_PLAN.md §8.

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
npm test          # 411 unit tests (domain, formula engine, workbook, QC rules, pivot, users,
                  #                 notifications, Annex 3, dashboard, mock client)
npm run build     # production build
```

### Browser verification

These are diagnostic harnesses, not CI gates. **Start `npm run dev -- --port 5199` first**,
then in another terminal:

```bash
npm run verify:theme    # both themes + WCAG contrast over 18 token pairs + toggle persistence
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
```

`verify:phase7` leaves the app in its delivered state — it resets the permission matrix at
the end. If a run is interrupted mid-section, the matrix may still hold Reports at *View*;
the Reset to delivered button on `/users/role-permissions` puts it back.

Screenshots land in `dms-prototype/artifacts/` (gitignored). Override the target with
`DMS_URL=http://localhost:4173 npm run verify:theme` to check a production preview.

`verify:theme` is the one to re-run after **any** token change — the light theme has three
known contrast shortfalls that are deliberate, documented at the foot of `globals.css`, and
must not be "fixed" by inventing new brand colours.

---

## 4. Phase 8 is next — start here

### The prompt to give Claude Code

`CLAUDE.md` is loaded automatically at the start of every session in this repo, so the prompt
does not need to restate any of its rules. Copy this:

```text
Continue the WHO Health Accounts DMS prototype with Phase 8 — Polish, demo script and
packaging.

Read HANDOVER.md first (all of it, it is short), then the "Phase 8 — Polish, demo script,
packaging" section of PROTOTYPE_PLAN.md. Phases 0–7 are complete, verified and committed.

The functional build is done; Phase 8 is about making it survive a live demo in front of
a panel. Route-level React.lazy on the five heavy modules to get the 2.11 MB bundle down,
a keyboard and accessibility pass, the contrast audit promoted into the repo as
scripts/contrast-audit.mjs and re-run after Phases 4–7's new colours, a responsive check
at 1920/1440/1280/1024/768 in both themes, DEMO_SCRIPT.md as a 12-minute click path, and
README.md with the mock-vs-real boundary table and the use-case coverage matrix.

Section 5 of HANDOVER.md lists the open items anchored to Phase 8. Item 4 — the CHE
financing split not reconciling — is the one an HA economist would spot on stage; do that
one first or decide explicitly not to.

Before reporting the phase done, run all three gates and tell me the results:
npx tsc -b · npm test · npm run build.
Then commit the phase as a single commit, and record the outcome in the Phase 8 section
of PROTOTYPE_PLAN.md the way Phases 1–7 were.
```

### What Phase 7 leaves you

- **`authStore.regularPermissions` is the only permission matrix.** `usePermissions` reads
  it, the UC008 editor writes it, and the capability preview on that page recomputes from
  the same functions the app gates on. Anything that needs to know what a role can do goes
  through `usePermissions` — never a second table.
- **Four more pure domain areas, all following the Phase 5/6 pattern.** `domain/users/`,
  `domain/notify/`, `domain/integration/` and `domain/home/` take their data as arguments
  and return values; the pages fetch through `XMartClient` and hand the rows in. That is
  what makes the dashboard's numbers testable against the seeded corpus rather than only
  inspectable on screen.
- **`notificationStore` now has two senders.** UC042's job queue and
  `useDueDateNotifications` (UC023), the latter mounted on the app shell. If Phase 8 adds a
  third, read the dedupe/cap note in CLAUDE.md first — both of the bugs that hook went
  through are invisible in a unit test.
- **The API call log is in-memory module state.** A full page load resets it. Any harness
  that compares the log before and after an action must navigate by clicking, not by URL.
- **`scripts/verify-phase7.mjs` resets the permission matrix when it finishes**, so the app
  is left in its delivered state. If you add checks after the reset, put them there
  deliberately.
- **UC044 is now complete.** The dataset-level restore lives on
  `/integration?tab=restore`, backed by `XMartClient.getDatasetAsOf`. It was the last open
  item anchored to Phase 7.

## 5. Open items, each anchored to a phase

| # | Item | When |
|---|---|---|
| 1 | **`date-fns`, `nanoid`, `@faker-js/faker` are installed but never imported.** Seeded data is hash-derived for reproducibility, so they may be genuinely unnecessary. Remove if still unused so the handover list reflects reality. | Phase 8 |
| 2 | **Light-theme contrast: 3 known shortfalls** inherited from the WHO reference palette, deliberately left alone and documented at the foot of `globals.css`. Phase 7 added no new tokens — its dashboard, heatmap and badge colours are all existing pass/warn/fail tokens with an alpha — so `verify:theme`'s figures are unchanged. Promote the audit into `scripts/contrast-audit.mjs`. | Phase 8 |
| 3 | **The before/after demo slide** needs the legacy Express Report screenshot, embedded in the RFP at `Requirements/2. Functional Requirements PFD-2026-001.docx` → `word/media/image5.png` (a .docx is a zip). | Phase 8 |
| 4 | **The seeded corpus does not reconcile the CHE financing split.** For Canada 2022 the Phase 3 tab shows `GGHE-D%CHE` 49.2% + `PVT-D%CHE` 66.1% + `EXT%CHE` 0.5% = 116%, because the generator draws `GGHE-D` as an independent share of CHE while `PVT-D` comes out of the FS partition. The engine and the arithmetic are correct; the two generator paths are not tied together. An HA economist would spot it. Fix in `generators/observations.ts` by deriving `GGHE-D` from `FS.1 + FS.3`, and re-run `phase1.test.ts` — it has an economic-plausibility suite attached. **Phase 5 note:** the same independence is why `GGHE-D` as a *share of CHE* ranges 8–75% within one income group, which is what forced the outlier rules onto year-on-year movement rather than level. Fixing this would let a plain cross-sectional outlier comparison work. | Phase 8, or sooner if a data-heavy demo is scheduled |
| 5 | **The bundle is 2.11 MB (635 kB gzipped)** and Vite warns on chunk size. DSG, SheetJS, Recharts and the grid all land in one chunk. Route-level `React.lazy` on the five heavy modules is the obvious fix and is a Phase 8 packaging task, not a correctness one. | Phase 8 |
| 6 | **QC report findings are not persisted, only run summaries are.** A thousand findings per run would fill the same `localStorage` quota the workbook's unsaved edits depend on, so findings live in memory for the session and a reloaded report offers to re-run its scope. The run is reproducible exactly — the corpus is derived, not sampled — so this costs a click rather than data. Revisit only if a backend exists to hold them. | — |
| 7 | **The QC check budget (`DEFAULT_MAX_CHECKS`, 400k value reads) is not reached by any delivered scope**, but a user-authored rule naming a hundred codes over every country would hit it. Truncation is reported per rule rather than hidden. **Phase 7 note:** the admin screens deliberately did not grow a "run everything over all 194 countries" action, so the budget is still unreached. Measure before adding one. | — |
| 8 | **UC020 was dropped from the bonus list.** Proving a component value is unused needs a full-corpus scan the front end cannot honestly perform. The LOV editor states the constraint instead. Revisit only if a backend exists. | — |
| 9 | **Report jobs and their generated `.xlsx` blobs are session state, not persisted.** Several megabytes of binary would fill the same `localStorage` quota the workbook's unsaved edits depend on — the same trade `qcStore` makes for findings. Notifications themselves persist, and a download link whose files have been dropped says so and offers to re-run. Revisit only if a backend exists to hold them. | — |
| 10 | **UC041 is partial.** EN / FR / ES are selectable for report labels; AR / ZH / RU are listed, disabled, and each carries the reason. Arabic needs right-to-left layout, which is scoped in the proposal rather than faked. Completing it needs translated variable labels in the seeded configuration, which is a content task, not a code one. | — |
| 11 | **`Variable.isCurrency` is per dimension, and MACRO mixes monetary series with population, an exchange rate and a PPP factor.** `domain/report/units.ts` names the three monetary members (`MONETARY_MACRO_CODES`) rather than reopening the Phase 1 seed. If the seed ever grows per-row currency flags, delete that constant. | Phase 8 |

---

## 6. Working conventions for whoever continues

- **Commit per phase, not per session.** History is currently a single "Initial commit"
  containing everything, so the decision trail lives in PROTOTYPE_PLAN.md's per-phase
  outcome notes rather than in git. Going forward, one commit per phase with the use cases
  it closes in the message will make the trail readable.
- **Record decisions where they will be re-read.** A phase outcome goes in
  PROTOTYPE_PLAN.md; a rule that must survive into future sessions goes in CLAUDE.md; a
  dependency goes in DEPENDENCIES.md. This file is not the place for any of them.
- **When the plan turns out to be wrong, revise the plan.** It has already been corrected
  three times — the grid choice, the light/dark decision, and the Phase 1 latency gate — and
  each revision is marked in place with the reason. That is the intended behaviour, not a
  failure of planning.
- **Be honest about what is simulated.** The Dev drawer, the "virus scan happens
  server-side" note on import, and the labelled prototype-only affordances all exist because
  overstating what is built is the one thing that loses a WHO evaluation.
