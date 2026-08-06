# Handover — where this stands, and what to do next

**Last updated:** 6 August 2026, end of Phase 4.

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

Phases 0–4 of 8 are complete and verified in a browser. Phases 5–8 are unstarted.

| Phase | Status | What exists |
|---|---|---|
| **0 — Foundation** | ✅ Done | Vite 8 + React 19 + TS 6. App shell pixel-matched to the reference (260px sidebar, 70px header). All 8 modules routed. Mock SSO with a demo role switcher. **Light + dark theme** with a WCAG audit. |
| **1 — Domain + mock xMart** | ✅ Done | Pure `domain/` layer. 194 real WHO Member States, 143 currencies, SHA 2011 classifications (HF verbatim from FR §1), all 16 HLR8 formulas. Observations **derived on demand** from a seeded hash. `XMartClient` + mock implementation + API call log. |
| **2 — Setup module** | ✅ Done | All 7 tabs live against the mock client. `DataTable` with drag-reorderable headers (UC015, persisted). Cross builder, formula editor with per-country overrides, metadata fields, reporting follow-up. Read-only variant for regular users. |
| **3 — Formula engine** | ✅ Done | `src/domain/formula/` — tokeniser, recursive-descent parser, AST, dependency graph with topological order and cycle detection, evaluator, null-policy guards, series maths, 10 functions. All 16 seeded formulas evaluate live on the Formulas tab with an AST/dependency inspector. **129 passing tests.** |
| **4 — Workbook** | ✅ Done | The product. `react-datasheet-grid` with a frozen year header, a frozen variable label+code column and a frozen corner; filter chips serialised to the URL; editing with live recompute through the Phase 3 engine; three-mode clipboard; undo/redo; a metadata drawer *beside* the grid; series tools; bulk status; locking; version compare; xlsx export; Save → xMart. **166 passing tests** + a 34-check browser harness. |
| **5 — Quality Checks** | ⬜ Next | Defects are already planted in the seed data waiting for it — see §4. |
| 6 — Reports | ⬜ | |
| 7 — Users, dashboard, integration | ⬜ | Page stubs exist and are routed. |
| 8 — Polish, demo script, packaging | ⬜ | |

**Use-case coverage so far:** UC001–002, 006, 013–017, 021–023, 025–030, 045, 060 are
demonstrable, plus **UC024, UC031, UC032, UC033, UC034, UC043, UC044 and UC046** from Phase 4.
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
npm test          # 166 unit tests (domain, formula engine, workbook, mock client)
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
npm run verify:zindex   # overlays are not clipped by the header (see CLAUDE.md stacking order)
npm run verify:shell    # sidebar/header at 1440 / 768 / 390, permission-filtered nav
```

Screenshots land in `dms-prototype/artifacts/` (gitignored). Override the target with
`DMS_URL=http://localhost:4173 npm run verify:theme` to check a production preview.

`verify:theme` is the one to re-run after **any** token change — the light theme has three
known contrast shortfalls that are deliberate, documented at the foot of `globals.css`, and
must not be "fixed" by inventing new brand colours.

---

## 4. Phase 5 is next — start here

### The prompt to give Claude Code

`CLAUDE.md` is loaded automatically at the start of every session in this repo, so the prompt
does not need to restate any of its rules. Copy this:

```text
Continue the WHO Health Accounts DMS prototype with Phase 5 — the Quality Checks module.

Read HANDOVER.md first (all of it, it is short), then the "Phase 5 — Quality Checks module"
section of PROTOTYPE_PLAN.md. Phases 0–4 are complete, verified and committed.

Build all nine UC053 rule categories in src/domain/qc/ as pure, tested logic, then the
module: the rule list with dev-authored rules visibly distinct from admin-created ones,
the rule editor with country exclusions and a one-click reset, configurable thresholds,
run scope by country or by attribute group, and the findings report with an outlier
scatter and .xlsx/.csv download. Then wire UC052 into the workbook: run the applicable
rules against the current selection, ring the offending cells and show the findings
inline — the cell renderer already has the ringing states and reads them from
`findingFor` in the grid context, which currently returns undefined for every cell.

The seeded defects in data/generators/defects.ts were planted in Phase 1 for exactly
this: real findings at named countries and years the demo can navigate to, covering all
eight categories. A report that traces back to them is the acceptance criterion.

Before reporting the phase done, run all three gates and tell me the results:
npx tsc -b · npm test · npm run build.
Then commit the phase as a single commit, and record the outcome in the Phase 5 section
of PROTOTYPE_PLAN.md the way Phases 1–4 were.
```

### What Phase 4 leaves you

- **`findingFor(observationKey)`** in `modules/workbooks/gridContext.ts` is the single seam
  for UC052. The cell renderer already rings a cell red for an `error` and amber for a
  `warning` and shows the message on hover; `WorkbookPage` currently passes a stub that
  returns `undefined`. Wire the runner to it and the workbook integration is done.
- **The "Run Quality Checks" toolbar button** exists and currently toasts that Phase 5 is
  where it lands. Replace the toast, not the button.
- **`useWorkbookData`** pulls a country's whole 2000–2024 series in one fetch and exposes
  both the `Observation` records and a resolver for the formula engine. A QC run over a
  workbook selection should read through it rather than fetching again.
- **`domain/formula/series.ts`** already has `growthPercent`, interpolation and
  linear/CAGR extrapolation — UC053's year-on-year growth rules should use them rather
  than re-deriving the maths.
- **`DataTable`** (Setup) is the list grid for the rule list and the findings table;
  `CountryPicker` already does attribute-based group selection, which is exactly UC053's
  *"Region=EURO or OECD=Y"* run scope.

## 5. Open items, each anchored to a phase

| # | Item | When |
|---|---|---|
| 1 | **`date-fns`, `nanoid`, `@faker-js/faker` are installed but never imported.** Seeded data is hash-derived for reproducibility, so they may be genuinely unnecessary. Remove if still unused so the handover list reflects reality. | Phase 8 |
| 2 | **Light-theme contrast: 3 known shortfalls** inherited from the WHO reference palette, deliberately left alone. Re-run `verify:theme` after Phases 4–7 add cell, chart and badge colours. | Phase 8 |
| 3 | **The before/after demo slide** needs the legacy Express Report screenshot, embedded in the RFP at `Requirements/2. Functional Requirements PFD-2026-001.docx` → `word/media/image5.png` (a .docx is a zip). | Phase 8 |
| 4 | **The seeded corpus does not reconcile the CHE financing split.** For Canada 2022 the Phase 3 tab shows `GGHE-D%CHE` 49.2% + `PVT-D%CHE` 66.1% + `EXT%CHE` 0.5% = 116%, because the generator draws `GGHE-D` as an independent share of CHE while `PVT-D` comes out of the FS partition. The engine and the arithmetic are correct; the two generator paths are not tied together. An HA economist would spot it. Fix in `generators/observations.ts` by deriving `GGHE-D` from `FS.1 + FS.3`, and re-run `phase1.test.ts` — it has an economic-plausibility suite attached. | Phase 8, or sooner if a data-heavy demo is scheduled |
| 5 | **UC044's admin dataset-level restore as of a date is not built.** Per-observation compare and restore is. The dataset-level variant needs a bulk as-of query the mock client does not expose, and it belongs with the Phase 7 admin screens. | Phase 7 |
| 6 | **The workbook bundle is 1.47 MB (456 kB gzipped)** and Vite now warns on chunk size. DSG, SheetJS, Recharts and the grid all land in one chunk. Route-level `React.lazy` on the five heavy modules is the obvious fix and is a Phase 8 packaging task, not a correctness one. | Phase 8 |
| 7 | **UC020 was dropped from the bonus list.** Proving a component value is unused needs a full-corpus scan the front end cannot honestly perform. The LOV editor states the constraint instead. Revisit only if a backend exists. | — |

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
