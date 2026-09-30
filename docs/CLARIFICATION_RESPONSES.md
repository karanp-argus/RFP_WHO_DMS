# RFP PFD-2026-001: Responses to Clarification Queries

**Develop a Data Management System (DMS) for Health Accounts**
Argusoft India Ltd.

This document answers the clarification queries received after submission of our technical
proposal: six technical queries (§1–§6) and eight commercial and contractual queries (§7–§14). Where an answer rests on a measurement, the measurement was taken on our working
prototype, which remains available for evaluation at **https://whohadms.argusservices.in/**, and
the conditions of the measurement are stated alongside it. Where an answer describes the design of
the delivered system rather than something the prototype already does, we say so.

---

## Summary

| # | Query | Answer in brief |
|---|---|---|
| 1 | Workbook grid component | **react-datasheet-grid** (MIT licence), the component our prototype's Workbook already runs on. Alternatives such as AG Grid are available if WHO prefers them, with the licensing implications set out in §1.4. |
| 2 | Formula engine | A purpose-built engine: tokenizer, parser, syntax tree, dependency graph with topological evaluation, and explicit handling of missing values. Cycles are refused when a formula is saved and named in full. Worked examples from the prototype are in §2.6. |
| 3 | Performance at realistic volumes | Rendering verified at the largest shapes the Functional Requirements allow, up to 194 countries × all variables for one year (34,532 cells): under 0.2 s once the data is in the browser. End-to-end performance cannot be tested on a prototype with synthetic data. Targets will be agreed with WHO and tested against xMart (§3.3). |
| 4 | Multiple crosses | A cross is one observation carrying values in two or more classifications. We analysed the cross tables in Annex 3 and the HAPT workbook, including how crosses reconcile with each other, and describe the model, display and checks in §4. |
| 5 | Large-volume operations | Heavy work runs on a separate background worker tier, partitioned by country, reading a consistent snapshot, throttled towards xMart, with no locks on data users are editing. Details in §5. |
| 6 | Scope coverage | Confirmed. The 396 person-days over seven months cover the scope of the Functional Requirements, with the single exception of UC003.1 (§6). |
| 7 | Database technology | Microsoft SQL Server, delivered as the Azure SQL Database PaaS service. We are open to another database if WHO prefers. |
| 8 | Licensing costs | No annual licence fees. The SQL Server licence is included in the Azure SQL Database service charge, and all other components are open source. |
| 9 | Effort beyond the estimate | Up to 20% scope adjustment is included in the proposed cost, and within it any additional effort is borne by Argusoft. Beyond that threshold, additional effort is agreed with WHO as a change request. |
| 10 | Team availability | Confirmed. All proposed Key Experts remain assigned for the full duration of the project. |
| 11 | Support and maintenance pricing | Confirmed. USD 50,000 for five years, approximately USD 833 per month, fixed for the whole period. |
| 12 | Support scope | Corrective maintenance, monitoring, security patching, backup verification, integration support, help desk and reporting, detailed in §12. |
| 13 | Azure hosting cost | Approximately USD 702 per month, or USD 8,425 per year, for the production environment in West Europe. |
| 14 | Source code ownership | Confirmed. All source code, including core components and reusable modules, and any commercial licences transfer to WHO and become WHO's property. |

---

## 1. Workbook grid component

> *Please specify which grid component you intend to use for the Workbooks module.*

### 1.1 Recommendation

We will use **react-datasheet-grid** (MIT licence) for the Workbooks module.

This is not a paper choice. The Workbook in our prototype is built on it, and it already carries
the behaviours the Functional Requirements ask for, working together at full-scale data volumes (§3).

### 1.2 How it meets the Workbook requirements

| Requirement (HLR8, UC031) | How it is met |
|---|---|
| Format similar to Excel: view and edit cells | Native in-place editing, with Enter, Tab and Escape following spreadsheet conventions |
| Copy and paste within a workbook and between workbooks | Native range selection and clipboard in tab-separated format, so ranges also copy to and from Excel. The three paste modes (values, formulas, metadata) and paste between workbooks are implemented in our application layer |
| Undo similar to Excel | A multi-level command stack in our application layer covers edits, pastes, fills and bulk status changes as single undoable steps |
| Formula cells shown in a different colour and in italic | Custom cell renderers: reported values, calculated indicators and formula cells are visually distinct, as are metadata, publishing-status and quality-check markers |
| Years across, variables down, headers visible while scrolling | Frozen year header row, frozen variable label and code column, and a frozen corner cell |
| Large selections without paging | Rows and columns are both virtualised. In our measurements a 34,532-cell workbook keeps about 405 cells in the page at any moment (§3.2) |
| Keyboard operation | Arrow keys, Tab, Enter and Escape are native. Undo, redo, copy and paste shortcuts are handled so that they never interfere with typing in other fields |

### 1.3 Why this component, and the risk we are managing

**Why.** react-datasheet-grid is purpose-built for spreadsheet-style data entry rather than for
data display. It is permissively licensed, supports current React (19), and has no commercial
edition. Features that a data display grid does not offer out of the box were easy to build on top
of it: frozen label columns, range copy and paste, per-cell rendering. It is also light enough that
the whole application's first screen loads in 226 kB (gzipped).

**The risk, stated plainly.** The component is maintained by a single author and is released
infrequently: five releases since July 2023, the most recent in March 2026. It is feature-complete
for our needs, but WHO should not depend on a single maintainer's schedule. We manage this in three
ways:

1. **A thin adapter.** Exactly one component in our application talks to the grid library. The
   calculation engine, undo stack, clipboard modes, metadata panel and quality-check markers are
   all independent of it. Replacing the grid means replacing that one component, not the Workbook.
2. **Owned maintenance.** The MIT licence lets us hold a maintained copy of the component within
   the WHO codebase if upstream maintenance stalls. We have already resolved one compatibility issue
   with current React in the prototype, without modifying the component.
3. **Regression protection.** Automated browser tests exercise frozen headers, range selection,
   copy and paste, undo, keyboard navigation and virtualised scrolling, so any change to the grid
   is verified against the behaviours the Health Accounts team relies on.

### 1.4 Alternatives, if WHO prefers

We are glad to use another grid if WHO has a preference, for example to align with other WHO
applications. The main options, assessed against the same Workbook requirements:

| Option | Licence | Assessment |
|---|---|---|
| **react-datasheet-grid** (recommended) | MIT | All Workbook behaviours demonstrated in the prototype. Single-maintainer risk managed as described in §1.3 |
| **AG Grid Community** | MIT | Mature, actively maintained, very capable for data display. **Range selection, clipboard operations and Excel export are Enterprise features and are not included in Community.** Our technical proposal listed AG Grid Community among the grids offering range selection and copy and paste out of the box; on verification against AG Grid's own documentation, that capability belongs to the Enterprise edition, and we correct it here. With Community we would build range selection and clipboard ourselves, as we did for undo |
| **AG Grid Enterprise** | Commercial, licensed per developer and per deployment. Perpetual, with one year of support and updates | Everything above is built in. Only sensible if WHO already holds licences or accepts the cost. Licence keys would be handed over with the source code |
| Handsontable | Commercial (free for non-commercial use only) | Closest to Excel in behaviour, but the licence terms are unsuitable for an application WHO must own outright |
| Glide Data Grid | MIT | Canvas-based and very fast, but its latest stable release supports React only up to version 18 |

Whatever grid is selected, the adapter design in §1.3 applies, so the choice can be confirmed
during the design phase without affecting the rest of the Workbook.

---

## 2. Formula engine implementation

> *Provide a detailed explanation of how formulas will be implemented, including handling of nested
> formulas, circular dependency detection and resolution, performance considerations. We would
> appreciate a demonstration or example illustrating your practical understanding of formula
> behaviour.*

### 2.1 Why a purpose-built engine

Health Accounts formulas are not spreadsheet formulas, for four reasons that come from the
requirements themselves:

1. **They refer to variables, not cells.** `CHE = HF.1 + HF.2 + HF.3 + HF.4 + HF.nec` is resolved
   for the country and year being evaluated. The same formula applies to 194 countries and 25
   years.
2. **They refer to other formulas.** `CHE%GDP_SHA2011` needs `CHE`, which needs the HF categories,
   which are themselves sums of reported leaves. Evaluation needs a dependency graph resolved in the
   right order, not text substitution.
3. **Each carries its own rule for missing values.** The indicator table in HLR8 gives every
   formula a condition: *"at least one component not null"* for some, *"CHE and GDP not null"* for
   others. When the condition fails the result must be **blank, not zero**: a zero asserts that
   spending was nil, while a blank says it is unknown, and the difference reaches every published
   figure.
4. **A formula can be customised for one country** without changing it for any other (UC029).

General-purpose spreadsheet engines support none of these directly, and the mature ones carry
licences (GPL or commercial) that do not suit an application WHO must own. We therefore build the
engine, and we have already built and tested it in the prototype.

### 2.2 How the engine works

```
"CHE / GDP * 100"
      │
  1  tokenize ──── variable codes contain . % $ - and even spaces ("HF TOT"):
      │           CHE%GDP_SHA2011, GGHE-D_pc_US$_SHA2011. References are matched
      │           greedily against the set of known codes, never guessed from characters.
      ▼
  2  parse ─────── recursive-descent parser → syntax tree
      │           (+ − × ÷, parentheses, unary minus, numbers, variable references,
      │           and functions: SUM AVG MIN MAX ABS IF PREV GROWTH INTERPOLATE EXTRAPOLATE)
      ▼
  3  graph ─────── dependency graph over all formulas → topological order,
      │           cycle detection with the full path named
      ▼
  4  evaluate ──── walks the tree for (country, year): each reference resolves to
                  another formula, an aggregate of reported leaves, or a reported value,
                  under the formula's own missing-value policy
```

**Resolution order for a reference.** When a formula names a code, the engine resolves it for the
country and year being evaluated:

1. **A formula**, if one is defined for that code, with the country's override substituted when
   one exists.
2. **An aggregate**, if the code is a parent or a total (`HF.1` is the sum of `HF.1.1`, `HF.1.2`
   and `HF.1.3`).
3. **A reported value** from the data.

**Missing-value policies.**

| Policy | A missing input… | The result is blank when… |
|---|---|---|
| At least one component not null | counts as zero | every input is missing |
| All components not null | makes the result blank | any input is missing |

Division by zero also yields a blank rather than infinity, so an undefined value can never reach an
export. Numbers are kept at full precision throughout and rounded only for display, so an exported
workbook carries exactly the value the engine produced.

### 2.3 Nested formulas

Nesting is handled by the dependency graph, not by expanding expressions into one another. Each
formula is parsed once. The graph records which formulas each one reads, and the engine evaluates
in dependency order.

Three properties matter in practice:

- **Every intermediate value is computed once.** Results are memoised per country, year and code,
  so `CHE` is computed once for Canada 2022 and reused by the eight indicators that read it.
- **Recalculation is targeted.** The graph also records the reverse direction. When a user edits
  a value, the engine knows exactly which indicators depend on it. For example, `CHE` feeds
  `CHE%GDP`, `CHE per capita`, `DOM%CHE`, `GGHE-D%CHE`, `PVT-D%CHE`, `OOPS%CHE`, `VPP%CHE` and
  `EXT%CHE`, and only those are recomputed.
- **Every value can be explained.** Because the evaluation is explicit, the engine returns the
  expression it used, every input it read and where each came from, the missing-value verdict, and
  the chain of formulas behind it. The prototype's **Formula Inspector** shows exactly this for any
  indicator, country and year.

### 2.4 Circular dependency detection and resolution

A formula may not depend on itself, directly or through other formulas. We enforce this at two
points.

**1. When a formula is saved.** Every new or edited formula, including a country override, is
checked against the whole formula set before it can be saved. The engine builds the candidate
dependency graph, orders it with Kahn's topological sort, and if anything cannot be ordered, a
depth-first search names the exact loop. The Save action is disabled and the user sees the path:

> *Circular reference: CHE → CHE%GDP_SHA2011 → CHE. A formula cannot depend on itself, directly or
> through another formula.*

**2. When a formula is evaluated.** The evaluator keeps the chain of formulas it is currently
inside. If a cycle ever reached evaluation, for instance through data loaded outside the
application, it stops with the same named error instead of looping. Formulas outside the cycle keep
evaluating normally, so one bad definition never blanks a whole workbook.

**How cycles are resolved.** The engine never "resolves" a cycle by guessing an answer or iterating
towards one, as some spreadsheets do. A circular definition in Health Accounts is always a
definition error, and a number produced from it would be wrong but look right. The resolution is
therefore to show the full path so the author can correct the definition. During migration of the
legacy formulas, any formula that would form a cycle is placed on the exception report for joint
review with the Health Accounts team rather than silently dropped.

**One case that looks like a cycle but is not.** The HLR8 table lists `GGHE-D` with the expression
`GGHE-D`, because it is sourced rather than derived. When a formula names its own code and that code
is also a real variable, the engine treats the reference as the underlying data rather than a loop.
When the code is not a real variable, the same self-reference is reported as a cycle.

### 2.5 Performance considerations

| Consideration | How it is handled |
|---|---|
| Parsing cost | Each expression is parsed once and the syntax tree is cached |
| Repeated sub-results | Values are memoised per country, year and code for the duration of a calculation |
| Recalculation after an edit | Only the dependents of the edited value are recomputed, found from the reverse edges of the graph |
| Graph size at migration scale | The legacy DMS holds about 70,000 formulas. The graph used to evaluate a country is built from the standard indicators plus the overrides and custom formulas that apply to that country. We expect most legacy formulas to be specific to one country and series, which keeps each graph small; this will be confirmed when the legacy database is profiled. Either way, in the delivered system the topological sort uses adjacency lists and runs in time linear in formulas plus references, so even the complete migrated set orders in well under a second. (The prototype's simpler implementation is quadratic: we measured 1,000 formulas in 28 ms but 20,000 in 13 s, which is why the production version is written differently.) |
| Where calculation runs | The same engine runs in the browser, for immediate recalculation as the user types, and in the API layer, for reports, quality checks and write-back to xMart. We recommend a single engine implementation for both, so browser and server can never disagree. If WHO prefers a different language on the server, both implementations must pass one shared conformance test suite |

**Measured on the prototype** (Node.js 24, a laptop with an Intel Core i5-1335U and 32 GB RAM, one
thread):

| Operation | Result |
|---|---|
| All 16 HLR8 indicators × 194 countries × 25 years (77,600 evaluations, each resolving its aggregates) | **278 ms**, about 280,000 evaluations per second |
| Recalculating one country's 16 indicators over 25 years after an edit | **1.1 ms** |
| Automated tests covering the engine | 83 (tokenizer, parser, graph, missing-value policies, all 16 seeded formulas) |

### 2.6 Demonstration

The following results come from the prototype's engine, run against its seeded Canada and
Argentina data for 2022. The dataset is synthetic but economically calibrated, so the figures are
illustrative.

**Nested evaluation.** `CHE%GDP_SHA2011` for Canada 2022:

| Step | Expression | Inputs read | Result |
|---|---|---|---|
| Leaves (reported) | | HF.1.1 = 87,955.4 · HF.1.2.1 = 48,071.7 · HF.1.2.2 = 20,023.7 · HF.1.3 = *(not reported)* | |
| Aggregate | `HF.1.2` = sum of children | 48,071.7 + 20,023.7 | 68,095.5 |
| Aggregate | `HF.1` = sum of children | 87,955.4 + 68,095.5 + *(blank, no data)* | 156,050.9 |
| Formula | `CHE = HF.1 + HF.2 + HF.3 + HF.4 + HF.nec` | 156,050.9 + 157,812.4 + 80,456.9 + 2,069.4 + 4,455.2 | **400,844.8** NCU millions |
| Formula | `CHE%GDP_SHA2011 = CHE / GDP * 100` | CHE = 400,844.8 (formula), GDP = 3,773,037.6 (reported) | **10.62 %** |

Evaluation order computed by the graph: `CHE → CHE%GDP_SHA2011`, with `HF.1` and its children
resolved as aggregates underneath. The same pass gives `CHE_pc_US$_SHA2011` = 7,903.87,
`GGHE-D%CHE` = 70.12 %, `PVT-D%CHE` = 25.76 %, `OOPS%CHE` = 20.07 % and `EXT%CHE` = 0.18 %.

**Missing-value policies.** The same calculation with GDP and HF.4 withheld:

| Indicator | Policy | Result |
|---|---|---|
| `CHE` | at least one component not null | **398,775.4**: the missing HF.4 counts as zero and the four reported schemes are summed |
| `CHE%GDP_SHA2011` | all components not null | **blank**: GDP is missing, so the guard fails. It is not 0 % |
| `CHE` with every HF category missing | at least one component not null | **blank**: nothing was reported |

**Country override (UC029).** Argentina excludes one component from CHE:

| | Canada | Argentina |
|---|---|---|
| Expression used for `CHE` | `HF.1 + HF.2 + HF.3 + HF.4 + HF.nec` (standard) | `HF.1 + HF.2 + HF.3 + HF.4` (override) |
| `CHE` | unchanged | 12,195,263.2 (standard would give 12,297,812.8) |
| `CHE%GDP_SHA2011` | unchanged | 3.76 % (standard would give 3.79 %) |

The override changes Argentina and nothing else, and it flows through every indicator that depends
on `CHE`.

**Cycle detection.**

| Attempt | Outcome |
|---|---|
| Edit `CHE` to `HF.1 + HF.2 + HF.3 + HF.4 + HF.nec + CHE%GDP_SHA2011` | Refused at save: *Circular reference: CHE → CHE%GDP_SHA2011 → CHE* |
| Three formulas forming a loop, `X_A = X_B + 1`, `X_B = X_C * 2`, `X_C = X_A − CHE` | Graph reports `X_A → X_B → X_C → X_A`. `X_A` evaluates to blank with the named error, and `CHE%GDP_SHA2011` still evaluates to 10.62 % |
| `GGHE-D = GGHE-D` | Evaluates to the underlying series (281,086.2). An identity, not a cycle |

**To see this in the prototype:**

- **Setup → Formulas** (`/setup?tab=formulas`): choose a country and year and all 16 indicators
  evaluate live. **Inspect** on any indicator shows its syntax tree, every input with its origin,
  the missing-value verdict and the dependency chain. The **dependency graph** view shows the full
  evaluation order. Editing a formula into a cycle disables Save and names the loop.
- **Workbook**:
  `/workbooks/view?c=CAN&v=HF.1.1,HF.1,CHE,CHE%25GDP_SHA2011&y=2000-2024&type=country`.
  Edit an `HF.1.1` cell and the `HF.1`, `CHE` and `CHE%GDP` rows recalculate immediately. Formula
  cells appear in a different colour and in italic, and **Ctrl+Z** undoes the edit together with
  its effects.

---

## 3. Performance under realistic volumes

> *Please confirm that your Workbook interface has been tested with realistic Health Accounts volumes
> (e.g., multiple countries × variables × years displayed simultaneously), and indicate the expected
> response time when visualising large datasets.*

### 3.1 What we verified

We verified the **rendering performance** of the prototype's Workbook at realistic Health Accounts
volumes. That is how quickly the grid displays a workbook once its data is in the browser,
including evaluating every formula in view, and how smoothly it scrolls.

The prototype is not connected to xMart and runs on synthetic (dummy) data generated in the
browser. The **actual end-to-end performance** of the delivered system, which includes retrieval
from xMart, the DMS API, the network and the hosting environment, therefore cannot be tested on the
prototype. The figures below describe rendering only and should not be read as end-to-end response
times.

The rendering tests used:

- the **production build** of the prototype, served locally;
- **Google Chrome 151** under automated control;
- a laptop with an Intel Core i5-1335U and 32 GB RAM, at 1920 × 1080;
- synthetic data for all **194 WHO Member States**, **161 classification variables** plus the
  **16 HLR8 indicators**, and **25 years (2000–2024)**.

Each figure is the median of three runs.

### 3.2 Rendering results

UC031 defines a workbook as a two-dimensional view in which one of the three axes holds a single
value. We rendered the full-scale version of each workbook shape, plus a workbook of crosses:

| Workbook | Cells | Cells in the page | Render time | Scroll frame time, p50 / p95 |
|---|---|---|---|---|
| Country: Canada × all variables × 25 years | 4,450 | 405 | **70 ms** | 23 / 37 ms |
| Variable: CHE%GDP × 194 countries × 25 years | 4,850 | 405 | **169 ms** | 21 / 39 ms |
| Variable: HF.1.1 × 194 countries × 25 years | 4,850 | 405 | **67 ms** | 23 / 45 ms |
| Year: 2022 × 194 countries × all variables | **34,532** | 405 | **121 ms** | 37 / 56 ms |
| Crosses: Canada × 15 crosses × 25 years | 375 | 240 | **41 ms** | 17 / 21 ms |

**Render time** is the time to lay out the grid, evaluate every formula in view and paint the first
screen, with the data already in the browser. It excludes data retrieval.

What the table shows:

- **Rendering cost does not grow with the size of the workbook.** Whether the workbook holds 4,450
  cells or 34,532, about 405 are in the page at any moment, because rows and columns are both
  virtualised. Render time stays between 41 and 169 ms.
- **Formulas stay live at full scale.** The CHE%GDP workbook evaluates the indicator, and
  everything it depends on, for 194 countries × 25 years inside the 169 ms.
- **Scrolling holds up under a stress test.** The scroll figures come from a deliberately harsh
  test that jumps diagonally across the whole grid in 120 steps, so every frame paints fresh rows
  and columns. Even the year workbook's 95th-percentile frame is 56 ms. Ordinary scrolling is
  smoother.
- **No errors** were recorded in any run.

Views across all three axes at once, many countries by many variables by many years, are served by
the **Reports** module's pivot builder rather than the Workbook. It runs on the server, and in the
background when the volume is large (UC042, §5).

### 3.3 End-to-end response times in the delivered system

The response time a user experiences is the time to retrieve the workbook's data from xMart through
the DMS API, plus the rendering time above. Retrieval depends on xMart, the network and the hosting
environment, so it can only be measured against the real system. We will therefore:

1. **Measure retrieval with the xMart team during discovery**, for a filtered request returning one
   workbook's data, including the inputs its formulas need.
2. **Agree 95th-percentile response-time targets with WHO** for each workbook shape on that basis,
   and adopt them as acceptance criteria.
3. **Test against those targets during development**, against xMart in UAT with realistic volumes:
   browser timings with Playwright and load with k6. The load tests include the Proposal's planning
   figure of about twenty concurrent users working while a full quality-check run is in progress
   (§5).

The design keeps retrieval as short as possible:

- **Retrieve only what the screen needs.** A workbook requests its own countries, years and
  variables, plus the inputs its formulas depend on, with filtering and paging done on the server.
- **Cache reference data.** Countries, currencies, classifications, crosses, metadata definitions
  and formulas change rarely. They are cached (Redis is our recommendation) and cleared
  automatically when edited in Setup.
- **Keep the browser's work bounded.** The grid is virtualised, recalculation is targeted, and
  modules are loaded on demand.

---

## 4. Multiple crosses

> *Please provide demonstration of your understanding of multiple-crosses and how they will be
> implemented in practice.*

### 4.1 Our understanding

The Functional Requirements define a cross as classification categories crossed together, with
`HF.1xFS.1` ("compulsory and government schemes financed through internal transfers") as the worked
example. In storage, a cross is **not a separate kind of record**. It is an ordinary observation
that carries a value in two or more classification columns of the xMart long format.

We analysed the cross tables embedded in the Functional Requirements to understand what "multiple
crosses" means in practice. Annex 3 is Canada's 2023 cross-table data in long format; the HAPT
workbook shows the cross tables themselves.

**1. A country-year carries many crosses at once.** Annex 3 contains **3,361 cross observations for
Canada 2023 alone**, across six cross tables:

| Cross table | Observations |
|---|---|
| HC × HP (health care functions by providers) | 1,530 |
| HC × HF (functions by financing schemes) | 675 |
| HF × HP (financing schemes by providers) | 510 |
| FS × HF (revenues by financing schemes) | 375 |
| HK × HP (capital formation by providers) | 136 |
| FP × HP (factors of provision by providers) | 135 |

The new HAPT cross-table workbook embedded in the Functional Requirements has **21 cross-table
sheets**, including HF×FS, HP×HF, HC×HF, HC×HP, HC×FS, DIS×FS, HP×FP, HK×HP, HK×FS, DIS×AGE, DIS×GEN,
FS×FS.RI, HC×FP, DIS×HP, DIS×FP, DIS×HC, FP×FS and HC.RI×FS.

**2. Crosses can involve more than two classifications.** The UC031 example workbook includes an
observation crossing five classifications at once: HF1 × FS1 × HC1 × HP1 × FP1 = 72,500. The model
must therefore support crosses of any number of classifications, not only pairs.

**3. Crosses contain composite and total members.** Annex 3 uses members such as
`HC.1.1+HC.2.1` (inpatient curative and rehabilitative care together) and bare totals such as `HC`
and `HP` (all functions, all providers). We checked all **196 composite members** in Annex 3: each
equals the sum of its parts exactly. For example, `HC.1.1+HC.2.1 × HF.1` = 46,834.35, which is
43,334.97 + 3,499.38.

**4. Crosses must reconcile with one another.** Different cross tables share totals, and in valid
data the shared totals agree exactly. In Annex 3:

| Shared total | Value in each cross table it appears in |
|---|---|
| Curative care (HC.1), all schemes / all providers | HC×HF: 149,233.37 · HC×HP: 149,233.37 |
| Government and compulsory schemes (HF.1), all functions / all providers / all revenues | HC×HF: 230,759.53 · HP×HF: 230,759.53 · FS×HF: 230,759.53 |

This is the practical core of working with multiple crosses. The same aggregate is reported several
times, once in each table it borders, and a discrepancy between those appearances is one of the
most important errors a quality check can catch.

**5. Crosses dominate the data volume.** About 3,400 cross observations per country-year, across
194 countries and 25 years, is roughly **16 million rows**. That is most of the "up to 25 million
rows" in UC057, and it is why retrieval must be filtered and paged (§5).

### 4.2 Implementation in practice

**Data model.** An observation is keyed by country-year (`SURVEY_FK`, e.g. `CAN-2023`) plus the set
of classification columns it fills. A plain `HF.1` fills only the HF column. `HC.1 × HF.1` fills HC
and HF. A five-way cross fills five columns. This mirrors the xMart long format exactly, so crosses
move to and from xMart with no conversion and no extra entity.

Cross codes are written in a canonical order (`HC.1xHF.1`, `HF.1xFS.1xHC.1xHP.1xFP.1`), so the same
cross always has the same code however it was selected.

**Cross definitions in Setup (UC025, UC026).**

- **Predefined crosses** are created by administrators and visible to all users, with export and
  copy but no editing.
- **Custom crosses** are created by regular users for specific countries or groups of countries,
  and are visible only for those countries.

A cross definition names the classifications and members it covers, from two classifications
upwards. It selects observations; it does not store them.

**Displaying crosses.**

- **Cross-table view.** For a chosen country and year, one classification down the side and another
  across the top, with row and column totals. This matches the HAPT cross tables the team already
  knows, and it is available for every cross table in the data.
- **In the Workbook.** A cross can be used like any variable. A country workbook can hold, for
  example, `HC.1xHF.1`, `HC.1xHF.3` and `HP.1xHF.1` as rows across 25 years, alongside the plain
  classifications. Multiple crosses in one workbook are supported, with the same editing, copy and
  paste, metadata, versioning and quality-check markers as any other cell.
- **In Reports.** Classification columns are fields of the pivot builder, so any cross can be
  analysed by country, region, income group or year.

**Checks across crosses.** The reconciliation rules in §4.1 become delivered quality checks under
the "inconsistency between tables" category (UC053), with tolerances set on the Thresholds screen
(UC054):

- Shared totals agree across every cross table they appear in. For example, HF.1 in HC×HF, HP×HF
  and FS×HF must equal each other and the one-dimensional HF.1.
- A composite member equals the sum of its parts (`HC.1.1+HC.2.1` = `HC.1.1` + `HC.2.1`).
- Within a cross, parents equal the sum of their children along each classification
  (`HC.1 × HF.1` = the sum over the children of HC.1, within HF.1).

Each finding names the cross tables, members and values that disagree, and links to the cells
concerned.

**Formulas over crosses.** Because the engine matches references against the full set of known
codes, including cross codes, a formula can use crosses directly. For example, the government share
of curative care is `HC.1xHF.1 / HC.1 * 100`. Greedy matching also handles composite members
correctly: `HC.1.1+HC.2.1xHF.1` is recognised as one cross code rather than as an addition, and
where the two readings would differ, the composite-member check above flags it.

### 4.3 What the prototype demonstrates today

| Aspect | Status in the prototype |
|---|---|
| Crosses stored as multi-classification observations with no separate entity | Demonstrated. The long format is round-tripped column for column |
| Predefined and custom crosses, with a builder for two or more classifications | Demonstrated in **Setup → Crosses** (`/setup?tab=crosses`). The builder derives the notation, e.g. `HC.1xHF.1`, as dimensions are picked |
| Several crosses in one workbook across 25 years | Demonstrated. Renders in 41 ms (§3.2) |
| Reconciliation between classifications (HF total vs HC total, HF total vs FS total) | Demonstrated as delivered quality checks |
| Cross-table view, checks on totals shared between cross tables, formulas that reference crosses | Part of the delivered system, as designed above. Not yet built in the prototype, whose seeded data holds individual crosses rather than complete cross tables |

---

## 5. Large-volume operations

> *Describe how your solution ensures that heavy operations, such as year-end quality checks
> involving up to 25 million rows, will not impact users working concurrently in the system.*

The Functional Requirements note that each country can send data up to ten times a year, that the
full quality-check process is run for all countries at year end, and that a single process may
retrieve anything from 20–30 rows up to 25 million. The same period is also the team's busiest time
in the Workbook, so heavy processing and interactive work must be kept apart by design.

### 5.1 Separate the work

- **A dedicated background tier.** Year-end quality-check runs, large reports and bulk exports run
  as jobs in a durable queue (Hangfire or Quartz), executed by **worker processes on compute
  separate from the interactive API**. A heavy job cannot take threads, memory or CPU from a user
  opening a workbook, because it does not run in the same processes.
- **Priorities and limits.** Interactive requests are served first. Checks a user runs from a
  workbook (UC052) are bounded to the selection in view and return in seconds. Scheduled and
  user-requested batch jobs run with a set degree of parallelism, and each user has a limit on
  concurrent heavy jobs, so a single run cannot occupy the whole worker pool.
- **Independent scaling.** The worker tier scales out for the year-end peak and back down
  afterwards, through the infrastructure-as-code pipelines described in the Proposal, without
  changing the interactive tier.

### 5.2 Partition and stream the data

- **Partition by country.** A full run is split into one unit of work per country. At 25 million
  rows that is about 130,000 rows per country on average. Each unit is small enough to process in
  memory, to retry on its own, and to run in parallel with the others.
- **Compare across countries in a second stage.** Rules that compare a country with its peers,
  such as outliers within a WHO region or income group, cannot be judged one country at a time.
  The per-country units also produce the few series those rules compare. A short second stage then
  runs the cross-country rules on that reduced data, so it needs a small fraction of the rows, not
  all 25 million again.
- **Stream, don't load.** Each unit reads its data from xMart in pages (Annex 3's reference page
  size is 100,000 rows) and evaluates rules as the pages arrive. The job never holds the whole
  dataset in memory.
- **Re-check only what changed.** Countries resubmit up to ten times a year. With xMart's
  range-filterable last-modified timestamps, a run can be limited to the countries and series that
  changed since the previous run, while a full year-end run remains available on demand.

### 5.3 Never block the people who are editing

- **Read a consistent snapshot.** A run reads data as it stood when the run started, using xMart's
  commit timestamps. Users can keep editing and saving throughout: the run neither waits for them
  nor sees a half-saved change. Anything saved after the run started is flagged in the report as
  "changed since this run".
- **No locks on user data.** Quality checks only read. The editing locks that stop two users
  changing the same data (UC033) apply to editors only and are never taken by a job. Findings are
  written to the DMS database in bulk, in short transactions, to tables that interactive screens do
  not lock.

### 5.4 Protect xMart as a shared platform

xMart serves other WHO programmes as well as the DMS, so the DMS must be a good neighbour:

- The number of simultaneous requests to xMart is capped and adapts to the response times
  observed, so a year-end run slows itself down rather than slowing xMart down.
- The extraction window and concurrency for the year-end run will be agreed with the xMart team
  during discovery. Where the team prefers, the full run can be scheduled outside working hours.

### 5.5 Keep the user informed and in control

- Progress is shown per country, and a run can be cancelled.
- A failed country is retried automatically, and a run resumes from the countries it has not yet
  completed, so an interruption costs minutes rather than a full re-run.
- The user is notified in the application when the run completes or fails, with a link to the
  report (UC055).

### 5.6 Evidence and sizing

The quality-check engine in our prototype already follows this design. It is a pure component that
receives its data and returns findings. It has a check budget that reports truncation instead of
hiding it, and it already takes its scope as a list of countries, which is the unit of partitioning
in §5.2.

**Measured on the prototype** (one thread, same laptop as §3.1): all 18 delivered and seeded rules
over all 194 countries and 25 years performed **723,415 value checks on 225,155 observations in
0.79 s**, about 900,000 checks per second, and returned 3,848 findings.

Scaled linearly to 25 million rows, rule evaluation is in the order of **one to two minutes of
single-core computing**, before parallelism. The dominant cost of a year-end run is therefore
**data retrieval from xMart**, not calculation, which is why the design concentrates on paging,
partitioning, incremental runs and throttling. This extrapolation will be replaced by measured
figures from the performance tests.

**Verified in testing.** Our performance test plan includes this exact scenario: a full
quality-check run over production-scale data, with simulated users working in workbooks at the
same time. The acceptance criterion is that the agreed interactive response times (§3.3) are still met
while the run is in progress.

---

## 6. Scope coverage

> *Please confirm that the estimated 396 person-days over 7 months fully cover the scope described
> in the Functional Requirements document shared with the invitation to bid, including workbooks,
> calculation engine, quality checks, xMart integration, formula migration, etc.*

We confirm that the estimated **396 person-days** over the **seven-month** implementation period
cover the scope described in the Functional Requirements, including the Workbooks module, the
calculation engine, quality checks, xMart integration in both directions, the data retrieval API,
and the migration of legacy data and formulas. The single exception is the use case below.

| Use case | Title | Priority in the Functional Requirements | Treatment |
|---|---|---|---|
| **UC003.1** | Different dashboard for administrators and regular users | Not Pilot (N) | Not included in the 396 person-days. The home-site dashboard (UC003) is delivered as a common dashboard whose content is filtered by each user's role and permissions. Separate dashboard layouts for administrators and regular users can be added in a later phase if WHO requires them |

The seven months correspond to the Terms of Reference milestones from contract signature to
production deployment, training and handover of source code. The three-month warranty period
follows within the overall ten-month contract period.

---

## 7. Database technology

> *Confirm which database technology will be used for the DMS and whether it bears any annual
> licence cost.*

We recommend **Microsoft SQL Server**, delivered as the **Azure SQL Database** PaaS service. In our
experience across several WHO projects, including the JEE Reporting Platform, eNAPHS and eSPAR, SQL
Server is the database WHO already uses and supports. The legacy DMS also runs on SQL Server, which
simplifies the migration of its data and formulas.

We are nevertheless open to a different database technology if WHO prefers one for this
assignment.

Azure SQL Database does not carry a separate annual licence fee (§8).

---

## 8. Licensing costs

> *Indicate whether any component of the proposed solution bears any annual licensing fee.*

No component of the proposed solution carries an annual licence fee.

- **Database.** With Azure SQL Database as a PaaS service, the SQL Server licence is included in
  the service charge, so no separate licence is purchased or renewed. The service charge itself is
  part of the hosting cost in §13.
- **Application components.** All libraries and frameworks in the proposed solution are open
  source under permissive licences, including the Workbook grid, react-datasheet-grid (MIT, §1).
  None charges a fee.
- **The one exception would be WHO's choice.** If WHO preferred a commercial alternative to one of
  our recommended components, such as AG Grid Enterprise for the Workbook grid (§1.4), that
  component would carry its vendor's licence fee. We would confirm any such cost with WHO before
  adopting it.

---

## 9. Effort beyond the estimate

> *If the actual effort exceeds your estimate, please clarify who will bear the additional cost.*

Our estimate is based on the Terms of Reference, the Functional Requirements and our understanding
of the expected system. During the requirements finalisation phase we will confirm the detailed
requirements with WHO, make any necessary amendments to the proposed solution and agree the final
effort. We consider the likelihood of a material difference from our estimate to be low.

As stated in our technical proposal, the proposed cost already includes:

- **up to 20% scope adjustment** during development and warranty, planned and prioritised by the
  WHO working group; and
- any individual modification that one resource can complete within **10 working days**.

Within the agreed scope and this threshold, any additional effort is borne by Argusoft. If the
requirements confirmed during finalisation, or later change requests, take the effort beyond this
threshold, the additional effort will be assessed jointly with WHO and borne by WHO through an
agreed change request.

---

## 10. Team availability

> *Please confirm that all key experts proposed in your submission will remain assigned and
> available for the full duration of the project.*

Yes. We confirm that all Key Experts proposed in our submission will remain assigned to the project
and available for its full duration.

---

## 11. Support and maintenance pricing

> *Your technical proposal states that post-warranty support is a separate assignment, while your
> financial proposal includes 5 years of support at USD 50,000 total. If the financial form is
> correct, please confirm that the monthly cost of approximately USD 833 will remain fixed for the
> entire 5-year period.*

Yes. The financial form is correct. Post-warranty support and maintenance for five years is offered
at **USD 50,000** in total, approximately **USD 833 per month**, and this monthly cost will remain
fixed for the entire five-year period.

---

## 12. Support scope breakdown

> *Please provide a breakdown of activities included in the 5-year support and maintenance
> package.*

The five-year package begins when the three-month warranty ends. It keeps the delivered DMS
running, secure and correct in production. It continues the operating model established during
the warranty, as described in the Support, Maintenance and Warranty Services section of our
technical proposal.

| Area | Activities included |
|---|---|
| Corrective maintenance | Diagnosis and fixing of production defects in all DMS modules, including workbooks, formulas, quality checks, reports and notifications. Every fix is tested and released through the controlled release process, with rollback planned |
| Monitoring and uptime | 24×7 automated monitoring and alerts for application and API availability, error rates, failed or delayed background jobs, database availability and capacity, and certificate expiry. Alerts and reported errors are investigated within the support window |
| Server and platform auditing | Regular review of server and database health, capacity, performance, logs and configuration, with recommendations when usage grows |
| Security maintenance | Regular security checks and vulnerability scanning of the application, its dependencies and the hosting configuration. Security patches for known vulnerabilities are applied to the application runtime, frameworks and third-party libraries, after impact assessment and testing, through WHO-approved change procedures |
| xMart integration support | Diagnosis of failures in the bidirectional DMS–xMart integration and of reconciliation issues, in coordination with the WHO xMart team |
| Backup and recovery | Monitoring of backup jobs, periodic restoration tests, and restoration of service after an operational failure using the agreed runbooks |
| Year-end support | Closer monitoring during the year-end quality-check run over all countries, including failed-job restart and retry and prompt diagnosis of any issue |
| Help desk | Incidents and requests reported through an agreed email or ticketing channel during an 8×5 support window overlapping WHO Geneva business hours, with severity-based response targets (initial response within one business hour for Critical incidents, four business hours for High, one business day for Medium and two business days for Low) |
| Reporting and governance | A monthly support report covering incidents, fixes, security patches, monitoring results, backup status and recommended actions, with periodic review meetings with WHO |

**Not included.** New functionality and enhancements beyond corrective maintenance, which would be
agreed with WHO as separate change requests. Azure hosting charges, which are consumption costs
paid for WHO's subscription (§13). Changes to the xMart platform and to WHO tenant administration,
which remain with the relevant WHO teams.

Final severity definitions, response targets and the support window will be confirmed with WHO and
recorded in the Support and Maintenance Plan before the package begins.

---

## 13. Azure hosting cost estimate

> *Provide a rough annual estimate of Azure hosting costs for your proposed architecture, assuming
> ~20 concurrent users and year-end processing of ~25 million rows.*

Our estimate for the production environment, sized for the assumptions above and deployed in the
**West Europe** Azure region, is:

| Environment | Monthly (USD) | Annual (USD) |
|---|---|---|
| Production | approx. 702 | approx. 8,425 |

The production environment comprises:

- Azure App Service, Premium v2 (P3v2: 4 vCPU, 14 GB RAM);
- Azure SQL Database Hyperscale (up to 4 vCores);
- Blob Storage (1 TB);
- Azure Front Door Premium;
- Virtual Network, Key Vault and static IP addresses.

A detailed breakdown by resource is available at
https://docs.google.com/spreadsheets/d/1y-3FlPaSvJZL5pkLux3vxwUHzin782fUsadKL8Kfcbw/edit?gid=467248193#gid=467248193.

---

## 14. Source code ownership

> *Please confirm that, upon project completion, all source codes and licenses, if any, including
> any core components or reusable modules, will be fully transferred to WHO and become WHO's
> property.*

Yes. Upon project completion, all source code developed for the DMS, including any core components
and reusable modules, will be fully transferred to WHO and will become WHO's property. Any
commercial licences procured for the project will likewise be transferred to WHO.

Third-party open-source libraries used in the solution remain under their own open-source licences,
such as MIT. These licences grant WHO the right to use, modify and distribute the libraries without
fees, and they are listed in the Third-Party Components and Licence Inventory handed over with the
source code.
