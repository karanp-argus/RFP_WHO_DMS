# Handover — where this stands, and what to do next

**Last updated:** 6 August 2026, end of Phase 2.

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

Phases 0–2 of 8 are complete and verified in a browser. Phases 3–8 are unstarted.

| Phase | Status | What exists |
|---|---|---|
| **0 — Foundation** | ✅ Done | Vite 8 + React 19 + TS 6. App shell pixel-matched to the reference (260px sidebar, 70px header). All 8 modules routed. Mock SSO with a demo role switcher. **Light + dark theme** with a WCAG audit. |
| **1 — Domain + mock xMart** | ✅ Done | Pure `domain/` layer. 194 real WHO Member States, 143 currencies, SHA 2011 classifications (HF verbatim from FR §1), all 16 HLR8 formulas. Observations **derived on demand** from a seeded hash. `XMartClient` + mock implementation + API call log. **46 passing tests.** |
| **2 — Setup module** | ✅ Done | All 7 tabs live against the mock client. `DataTable` with drag-reorderable headers (UC015, persisted). Cross builder, formula editor with per-country overrides, metadata fields, reporting follow-up. Read-only variant for regular users. |
| **3 — Formula engine** | ⬜ Next | Nothing yet. This is the technical centrepiece — see §4. |
| 4 — Workbook | ⬜ | The product. Depends on Phase 3. |
| 5 — Quality Checks | ⬜ | Defects are already planted in the seed data waiting for it. |
| 6 — Reports | ⬜ | |
| 7 — Users, dashboard, integration | ⬜ | Page stubs exist and are routed. |
| 8 — Polish, demo script, packaging | ⬜ | |

**Use-case coverage so far:** UC001–002, 006, 013–017, 021–023, 025–030, 045, 060 are
demonstrable. The full matrix is in PROTOTYPE_PLAN.md §8.

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
npm test          # 46 unit tests (domain + mock client)
npm run build     # production build
```

### Browser verification

These are diagnostic harnesses, not CI gates. **Start `npm run dev -- --port 5199` first**,
then in another terminal:

```bash
npm run verify:theme    # both themes + WCAG contrast over 18 token pairs + toggle persistence
npm run verify:setup    # all 7 Setup tabs, UC015 reorder-survives-reload, admin vs regular
npm run verify:zindex   # overlays are not clipped by the header (see CLAUDE.md stacking order)
npm run verify:shell    # sidebar/header at 1440 / 768 / 390, permission-filtered nav
```

Screenshots land in `dms-prototype/artifacts/` (gitignored). Override the target with
`DMS_URL=http://localhost:4173 npm run verify:theme` to check a production preview.

`verify:theme` is the one to re-run after **any** token change — the light theme has three
known contrast shortfalls that are deliberate, documented at the foot of `globals.css`, and
must not be "fixed" by inventing new brand colours.

---

## 4. Phase 3 is next — start here

Read PROTOTYPE_PLAN.md §Phase 3 in full. The scope is a tokeniser → recursive-descent
parser → dependency graph → evaluator in `src/domain/formula/`, about 250 lines, with ~30
unit tests.

Everything it needs is already in place:

- **All 16 formulas are seeded** in `data/seed/formulas.ts` with their expressions, null
  policies and the FR's verbatim condition text.
- **Aggregates are deliberately not generated.** Every parent and total in
  `data/seed/classifications.ts` is `isCalculated: true`, so the engine has real work to do
  and the demo can show it happening.
- **The Formulas tab already renders** expressions, `ANY`/`ALL` policy badges and
  per-country overrides — so the engine has a UI waiting for it.

Three things that will bite if you miss them:

1. **Variable codes contain `.`, `%`, `$` and `-`** — `CHE%GDP_SHA2011`,
   `GGHE-D_pc_US$_SHA2011`. Tokenise references greedily against the known-variable set.
   Never infer token boundaries from characters.
2. **Formulas reference formulas.** `CHE%GDP` → `CHE` → `HF.*`. You need topological
   evaluation with cycle detection, not string substitution.
3. **A failed null-guard yields blank, not 0.** This is visible in exports and the RFP cares
   about it. `all-not-null` and `any-not-null` behave differently — see `NullPolicy`.

---

## 5. Open items, each anchored to a phase

| # | Item | When |
|---|---|---|
| 1 | **`react-datasheet-grid` carries a nested `react-dom@18`.** `react` itself is a single instance at 19, so no hooks hazard, but a second renderer exists. Currently inert — DSG is not imported yet. Resolve alongside the planned DSG spike. Options in DEPENDENCIES.md §7.1. | Phase 4, day 1 |
| 2 | **Left-column pinning in DSG is the known unknown.** Spike it before building the toolbar and clipboard on top. Fallback (a second synchronised grid for the label column) is already decided — do not re-litigate. | Phase 4, day 1 |
| 3 | **`date-fns`, `nanoid`, `@faker-js/faker` are installed but never imported.** Seeded data is hash-derived for reproducibility, so they may be genuinely unnecessary. Remove if still unused so the handover list reflects reality. | Phase 8 |
| 4 | **Light-theme contrast: 3 known shortfalls** inherited from the WHO reference palette, deliberately left alone. Re-run `verify:theme` after Phases 4–7 add cell, chart and badge colours. | Phase 8 |
| 5 | **The before/after demo slide** needs the legacy Express Report screenshot, embedded in the RFP at `Requirements/2. Functional Requirements PFD-2026-001.docx` → `word/media/image5.png` (a .docx is a zip). | Phase 8 |
| 6 | **UC020 was dropped from the bonus list.** Proving a component value is unused needs a full-corpus scan the front end cannot honestly perform. The LOV editor states the constraint instead. Revisit only if a backend exists. | — |

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
