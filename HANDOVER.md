# Handover — where this stands, and what to do next

**Last updated:** 6 August 2026, end of Phase 3.

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

Phases 0–3 of 8 are complete and verified in a browser. Phases 4–8 are unstarted.

| Phase | Status | What exists |
|---|---|---|
| **0 — Foundation** | ✅ Done | Vite 8 + React 19 + TS 6. App shell pixel-matched to the reference (260px sidebar, 70px header). All 8 modules routed. Mock SSO with a demo role switcher. **Light + dark theme** with a WCAG audit. |
| **1 — Domain + mock xMart** | ✅ Done | Pure `domain/` layer. 194 real WHO Member States, 143 currencies, SHA 2011 classifications (HF verbatim from FR §1), all 16 HLR8 formulas. Observations **derived on demand** from a seeded hash. `XMartClient` + mock implementation + API call log. |
| **2 — Setup module** | ✅ Done | All 7 tabs live against the mock client. `DataTable` with drag-reorderable headers (UC015, persisted). Cross builder, formula editor with per-country overrides, metadata fields, reporting follow-up. Read-only variant for regular users. |
| **3 — Formula engine** | ✅ Done | `src/domain/formula/` — tokeniser, recursive-descent parser, AST, dependency graph with topological order and cycle detection, evaluator, null-policy guards, series maths, 10 functions. All 16 seeded formulas evaluate live on the Formulas tab with an AST/dependency inspector. **129 passing tests.** |
| **4 — Workbook** | ⬜ Next | The product. Depends on Phase 3, which is now in place — see §4. |
| 5 — Quality Checks | ⬜ | Defects are already planted in the seed data waiting for it. |
| 6 — Reports | ⬜ | |
| 7 — Users, dashboard, integration | ⬜ | Page stubs exist and are routed. |
| 8 — Polish, demo script, packaging | ⬜ | |

**Use-case coverage so far:** UC001–002, 006, 013–017, 021–023, 025–030, 045, 060 are
demonstrable. Phase 3 deepens UC029/UC030/UC031 rather than adding new ones — the
engine is what makes the Workbook's computed cells real. The full matrix is in PROTOTYPE_PLAN.md §8.

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
npm test          # 129 unit tests (domain, formula engine, mock client)
npm run build     # production build
```

### Browser verification

These are diagnostic harnesses, not CI gates. **Start `npm run dev -- --port 5199` first**,
then in another terminal:

```bash
npm run verify:theme    # both themes + WCAG contrast over 18 token pairs + toggle persistence
npm run verify:setup    # all 7 Setup tabs, UC015 reorder-survives-reload, admin vs regular
npm run verify:formulas # Phase 3: all 16 formulas evaluated, AST + dependency graph, cycle refused
npm run verify:zindex   # overlays are not clipped by the header (see CLAUDE.md stacking order)
npm run verify:shell    # sidebar/header at 1440 / 768 / 390, permission-filtered nav
```

Screenshots land in `dms-prototype/artifacts/` (gitignored). Override the target with
`DMS_URL=http://localhost:4173 npm run verify:theme` to check a production preview.

`verify:theme` is the one to re-run after **any** token change — the light theme has three
known contrast shortfalls that are deliberate, documented at the foot of `globals.css`, and
must not be "fixed" by inventing new brand colours.

---

## 4. Phase 4 is next — start here

### The prompt to give Claude Code

`CLAUDE.md` is loaded automatically at the start of every session in this repo, so the prompt
does not need to restate any of its rules. Copy this:

```text
Continue the WHO Health Accounts DMS prototype with Phase 4 — the Workbook module.

Read HANDOVER.md first (all of it, it is short), then the "Phase 4 — Workbook module"
section of PROTOTYPE_PLAN.md, and §2.4 Decision 2 which that phase implements.
Phases 0–3 are complete, verified and committed.

Day one is the react-datasheet-grid spike: left-column pinning is the known unknown, and
the fallback (a second synchronised grid for the label column) is already decided — do not
re-litigate it. Resolve the nested react-dom@18 in the same sitting (DEPENDENCIES.md §7.1).

Then build the module as scoped: axis pickers with the UC031 constraint, the virtualised
grid with frozen headers, cell renderers for all six states in both themes, filter chips
serialised to URL search params, editing that recomputes dependents through the Phase 3
engine, clipboard with three paste modes, undo/redo, the metadata drawer that opens beside
the grid without unmounting it, series tools, bulk status, locking, export, version compare
and Save → xMart.

Before reporting the phase done, run all three gates and tell me the results:
npx tsc -b · npm test · npm run build.
Then commit the phase as a single commit, and record the outcome in the Phase 4 section
of PROTOTYPE_PLAN.md the way Phases 1–3 were.
```

### What Phase 3 leaves you

The formula engine is done and is the thing the Workbook is built on. The parts Phase 4
will reach for:

- **`useFormulaEngine(iso3, formulas?)`** (`src/hooks/`) — the only place the pure engine
  meets data. It pulls one country's whole 2000–2024 reported series through
  `XMartClient` and hands the engine a resolver closure. Do not add a second path.
- **`engine.evaluate(code, iso3, year)`** returns the value *and* the trace: the expression
  used, the AST, every input read with year and origin, the guard verdict and the
  dependency chain. `FormulaInspectorDialog` already renders all of it and is reusable
  from a grid cell.
- **`engine.dependentsOf(code)`** — the transitive list to recompute after an edit, so the
  grid refreshes only the cells the edit actually touched.
- **`engine.validate(expr, { code })`** — syntax, unknown references and a cycle check.
  This is what a cell's `=HF.1+HF.2` entry should go through before it is accepted.
- **`fillSeries` / `interpolateAt` / `extrapolateAt`** (`domain/formula/series.ts`) already
  implement `SeriesToolsDialog`'s maths, and tag every filled point `reported |
  interpolated | extrapolated | blank` so a filled value is never indistinguishable from a
  reported one.
- **`formatValue(value, unit)`** (`src/lib/format.ts`) renders a missing value as an em
  dash. Never `?? 0` in a cell renderer — Phase 3 goes to some trouble to keep blank and
  zero apart and it would be lost at the last step.

Two things about the engine that look like bugs and are not, both documented in place:
a formula may reference its own code (`GGHE-D`) and that is an identity onto the macro
series, not a cycle; and the three per-capita formulas carry an explicit `* 1000000`
because expenditure is in NCU millions while `POP` is a count of people.

## 5. Open items, each anchored to a phase

| # | Item | When |
|---|---|---|
| 1 | **`react-datasheet-grid` carries a nested `react-dom@18`.** `react` itself is a single instance at 19, so no hooks hazard, but a second renderer exists. Currently inert — DSG is not imported yet. Resolve alongside the planned DSG spike. Options in DEPENDENCIES.md §7.1. | Phase 4, day 1 |
| 2 | **Left-column pinning in DSG is the known unknown.** Spike it before building the toolbar and clipboard on top. Fallback (a second synchronised grid for the label column) is already decided — do not re-litigate. | Phase 4, day 1 |
| 3 | **`date-fns`, `nanoid`, `@faker-js/faker` are installed but never imported.** Seeded data is hash-derived for reproducibility, so they may be genuinely unnecessary. Remove if still unused so the handover list reflects reality. | Phase 8 |
| 4 | **Light-theme contrast: 3 known shortfalls** inherited from the WHO reference palette, deliberately left alone. Re-run `verify:theme` after Phases 4–7 add cell, chart and badge colours. | Phase 8 |
| 5 | **The before/after demo slide** needs the legacy Express Report screenshot, embedded in the RFP at `Requirements/2. Functional Requirements PFD-2026-001.docx` → `word/media/image5.png` (a .docx is a zip). | Phase 8 |
| 6 | **The seeded corpus does not reconcile the CHE financing split.** For Canada 2022 the Phase 3 tab shows `GGHE-D%CHE` 49.2% + `PVT-D%CHE` 66.1% + `EXT%CHE` 0.5% = 116%, because the generator draws `GGHE-D` as an independent share of CHE while `PVT-D` comes out of the FS partition. The engine and the arithmetic are correct; the two generator paths are not tied together. An HA economist would spot it. Fix in `generators/observations.ts` by deriving `GGHE-D` from `FS.1 + FS.3`, and re-run `phase1.test.ts` — it has an economic-plausibility suite attached. | Phase 8, or sooner if a data-heavy demo is scheduled |
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
