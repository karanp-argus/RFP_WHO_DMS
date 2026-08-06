# WHO Health Accounts DMS — Front-End Prototype Implementation Plan

**RFP:** PFD-2026-001 — Develop a Data Management System (DMS) for Health Accounts
**Client:** WHO HQ / HSD / PFD / PPE (Performance, Planning and Economics)
**Artifact:** Zero-backend React prototype, to be demonstrated as part of the technical proposal
**Author:** Solutions Architecture
**Status:** Plan — ready to execute

---

## 0. What this prototype is (and is not)

The RFP's payment milestone 1 (20% of contract value, due 1 month after signature) is *"Technical and graphical design of the system, including prototypes delivered and accepted"*. The deliverables list explicitly names **"Wireframe/prototypes with UI/UX design"**. Key Expert 6 is a dedicated **Product Designer**, and the evaluation criteria reward *"demonstrated portfolio of successful system designs"*.

**Therefore the prototype's job is to win the bid by making the 41 Pilot use cases feel already-built.** It is a clickable, data-driven simulation — not a thin slice of production code.

| In scope | Out of scope |
|---|---|
| All 8 modules navigable, WHO-styled | Any server, database, or real auth |
| Excel-like Workbook with live formula evaluation | Real xMart API calls (mocked, but with realistic request/response shown in a Dev drawer) |
| Realistic seeded data: 196 countries, 2000–2024, SHA 2011 classifications | Real Entra ID SSO (mocked login + role switcher) |
| Quality Check rule engine that actually runs and produces reports | 25M-row performance (we demo virtualisation at ~250k rows and state the scaling story) |
| Pivot-style report builder + real .xlsx export | Multilanguage report labels beyond EN/FR/ES stubs (UC041 is non-Pilot) |
| Versioning: compare + restore up to 10 versions | Notifications module beyond a badge + panel (UC058/059 are non-Pilot) |

**Assumption stated for the record:** we build to *demo depth*, not *pilot depth*. Every Pilot use case is represented by a working screen and a defensible interaction; the persistence layer is `localStorage` + in-memory stores. Where a use case is inherently backend (SSO, locking, API round-trips), we simulate it visibly so the evaluator sees we understood it.

---

## 1. Requirements Summary

### 1.1 Business context (from *Terms of Reference* + *Functional Requirements* §1–3)

WHO's Health Accounts team (very small — HQ + regional/country offices) manages health-expenditure data for **196 countries back to 2000**. The current DMS is a legacy standalone server with **no source code**, requiring the whole team to connect simultaneously — a single point of failure for the Global Health Expenditure Database (GHED) and GHO publications.

**To-Be architecture** (FR §3.2, confirmed by the process diagram embedded in the FR document):

```
Countries ──JHAQ (EU)──► eDamis ──sftp──►┐
          ──JHAQ (OECD non-EU)──►┐       │
          ──HAQ / Mini──────────►│       │
                        Internal folder ─┼──► xMart ◄──API──► NEW DMS *  ◄── this project
   Self-created files (WB/IMF/UN) ──────►┘   (format validation,   (quality checks,
   New HAPT ─────────────API────────────►    transformation,        calculations,
                                             storage, views,        copy/paste/undo,
   Old DMS ──one-off migration──────────►     metadata,             estimations,
                                             versioning)            reports, tracking,
                                                  │                 visualisation)
                                                  ├──► New GHED Data Explorer (not yet available)
                                                  └──► GHO Database
```

**Architectural takeaway that drives the whole prototype:** *DMS owns no master data.* xMart is the warehouse. DMS pulls via API on demand and pushes changes back (UC045/UC046). This means our mock data layer must be shaped as a **repository over an API client**, not as a local database — so the real implementation is a client swap, and we can *show* that in the demo.

### 1.2 Domain vocabulary (FR §1) — encode this exactly

| Term | Definition | Prototype type |
|---|---|---|
| **Observation** | One data point: 1 country × 1 year × 1 variable/cross. Has ≥1 value **OR** ≥1 metadata value (so `value: null` + populated metadata is legal) | `Observation` |
| **Dataset** | A group of observations processed together | `Dataset` |
| **Variable** | A measured characteristic — a classification category (`HF.1`, `FS.1`) or a calculated indicator (`CHE%GDP`) | `Variable` |
| **Indicator** | Derived from ≥1 variable, never reported by a country | `Variable` with `isCalculated: true` |
| **Cross** | Two classifications crossed: `HF.1xFS.1` = "Compulsory/government schemes financed through internal transfers" | `Cross` |
| **Attributes** | Metadata *on dimension members*: country attributes (income group, region, focal point, OECD member), variable attributes (labels in 6 languages, is-currency). **No attributes on Year.** | `attributes: Record<string, AttrValue>` |

**Classifications (SHA 2011)** — the FR gives HF in full and the xMart long-format screenshots reveal the complete dimension set:

`AGE`, `DIS`, `FP`, `FS`, `FS_RI`, `GEN`, `HC`, `HC_RI`, `HCR`, `HF`, `HK`, `HKR`, `HP`, `IND`, `MACRO`

HF hierarchy from FR §1 (seed this verbatim): `HF.1` → `HF.1.1`, `HF.1.2` → `HF.1.2.1`, `HF.1.2.2`, `HF.1.3`, `HF.2` → `HF.2.1`–`HF.2.3`, `HF.3` → `HF.3.1`, `HF.3.2`, `HF.4`, `HF.nec`, `HF TOT`.

### 1.3 The xMart long-format contract (from FR embedded screenshots)

The observation table in xMart is exactly:

```
SURVEY_FK | AGE | DIS | FP | FS | FS_RI | GEN | HC | HC_RI | HCR | HF | HK | HKR | HP | IND | MACRO
| VALUE | SOURCES | COMMENT | WEB_LINK | EST_METHOD | DATA_TYPE
| Sys_RowId | Sys_Origin | Sys_LoadBatchId | Sys_CommitDateUtc | Sys_FirstLoadUser | Sys_ID | Sys_BatchId | Sys_FirstBatchID
```

- `SURVEY_FK` = `{ISO3}-{YEAR}` (e.g. `ARG-2021`, `CAN-2023`) — this is the country×year key.
- The dimension columns are **sparse**: a plain `HF.1` observation fills only `HF`; a cross `HC.1 × HF.1` fills both `HC` and `HF`. **A cross is not a separate entity in storage — it is a multi-dimension tuple.** Our data model must mirror this or the Workbook/Cross screens will not line up.
- Metadata fields observed: `SOURCES`, `COMMENT`, `WEB_LINK`, `EST_METHOD` ("Derived as Estimated", "Derived by …"), `DATA_TYPE` ("Estimated", "Partially Derived").
- `Sys_*` fields are xMart's native versioning — this is the substrate for UC043/UC044 (compare & restore ≤10 versions). **Model versions as `Sys_CommitDateUtc`-stamped snapshots**, not as a bespoke audit table.

**Setup component schemas** (also from screenshots — use these field names verbatim, it signals we read the annexes):

- **Country/Area List:** `CODE_ISO_3`* (key), `CODE_ISO_2`, `CODE_ISO_NUMERIC`, `CODE_WHO`, `NAME_SHORT_EN`, `NAME_FORMAL_EN`, `ADJECTIVE_PEOPLE`, `CAPITAL_CITY`, `NAME_SHORT_{AR,ES,FR,RU,ZH}`, `NAME_FORMAL_{AR,ES,FR,RU,ZH}`, `WHO_LEGAL_STATUS`, `WHO_LEGAL_STATUS_TITLE`, `WHO_LEGAL_NOTES`, `SOVEREIGN_ISO_3`, `GRP_WHO_REGION`, `GRP_WHO_REGION_OFFICE`, `GRP_WB_INCOME`, `POP_SMALL`
- **Currency List:** `CODE_ISO_3`* , `TITLE`*, `CODE_ISO_NUMERIC`, `DESCRIPTION`, `SYMBOL`, `SYMBOL_BEFORE`, `DEC_PLACES`, `TITLE_{EN,FR,ES,AR,RU,ZH}`

Note the `GRP_` prefix — it maps directly to **UC022 Groups of Countries** ("one country attribute will be a flag determining whether that attribute is available for grouping/filtering"). Model it as `groupable: boolean` per attribute definition.

### 1.4 Predefined indicator formulas (FR §5.8, HLR8) — seed all 16 verbatim

| Folder | Code | Formula | Condition | Unit |
|---|---|---|---|---|
| AGGREGATES | `CHE` | `HF.1 + HF.2 + HF.3 + HF.4 + HF.nec` | ≥1 component not null | NCU millions |
| AGGREGATES | `CHE%GDP_SHA2011` | `CHE / GDP * 100` | CHE, GDP not null | Percent |
| AGGREGATES | `CHE_pc_US$_SHA2011` | `CHE / Population / Ex.rate` | all not null | USD per capita |
| AGGREGATES | `GGHE-D` | `GGHE-D` | ≥1 component not null | NCU millions |
| AGGREGATES | `PVT-D` | `FS.4 + FS.5 + FS.6 + FS.nec` | ≥1 component not null | NCU millions |
| AGGREGATES | `EXT` | `FS.2 + FS.7` | ≥1 component not null | NCU millions |
| FINANCING SOURCES | `DOM%CHE_SHA2011` | `(FS.1+FS.3+FS.4+FS.5+FS.6+FS.nec) / CHE * 100` | ≥1 FS + CHE not null | Percent |
| FINANCING SOURCES | `GGHE-D%CHE_SHA2011` | `GGHE-D / CHE * 100` | both not null | Percent |
| FINANCING SOURCES | `PVT-D%CHE_SHA2011` | `PVT-D / CHE * 100` | both not null | Percent |
| FINANCING SOURCES | `OOPS%CHE_SHA2011` | `HF.3 / CHE * 100` | both not null | Percent |
| FINANCING SOURCES | `VPP%CHE_SHA2011` | `FS.5 / CHE * 100` | both not null | Percent |
| FINANCING SOURCES | `EXT%CHE_SHA2011` | `EXT / CHE * 100` | both not null | Percent |
| FINANCING SOURCES | `GGHE-D%GDP_SHA2011` | `GGHE-D / GDP * 100` | both not null | Percent |
| FINANCING SOURCES | `GGHE-D%GGE_SHA2011` | `GGHE-D / GGE * 100` | both not null | Percent |
| FINANCING SOURCES | `GGHE-D_pc_US$_SHA2011` | `GGHE-D / Population / Ex.rate` | all not null | USD per capita |
| FINANCING SOURCES | `PVT-D_pc_US$_SHA2011` | `PVT-D / Population / Ex.rate` | all not null | USD per capita |

Two things this table proves about the required engine:
1. **Formulas reference other formulas** (`CHE%GDP` → `CHE` → `HF.*`). We need a **dependency graph with topological evaluation and cycle detection**, not naive string substitution.
2. **Every formula carries a null-guard condition** (`"at least one component not null"` vs `"all not null"`). This is a first-class field on the formula, not an afterthought. It is also the difference between `0` and *blank* in the export — which the RFP cares about.

### 1.5 Module map and Pilot scope

64 use-case rows; **41 flagged Pilot (Y)**, 23 deferred to phases 1–3.

| Module | Pilot use cases | Deferred (N) |
|---|---|---|
| **Shell / Home** | UC001 web app, UC002 access all modules, UC003 dashboard | UC003.1 role-specific dashboards |
| **Users** | UC004 module, UC005 grant access, UC006 SSO, UC007 assign roles, UC012 no hard delete | UC008 edit role permissions, UC009 restrict countries, UC010 disable, UC011 enable |
| **Setup** | UC013 module, UC014 import config from xMart, UC015 reorder columns, UC016 edit list of values, UC017 create value, UC022 country groups, UC023 country reporting follow-up, UC024 publishing status flag, UC025 predefined crosses, UC026 custom crosses, UC027 observation metadata fields, UC028 SharePoint MET files, UC029 predefined formulas, UC030 custom formulas | UC018 new attributes, UC019 edit component, UC020 delete value, UC021 export/import components |
| **Workbooks** | UC031 module (view/edit/formulas/copy-paste/metadata) | UC031.1 ordering, UC032 export, UC033 locking, UC034 custom metadata order |
| **Reports** | UC035 module, UC036 predefined report builder, UC039 data tracking, UC042 export to Excel | UC037 custom reports, UC038 copy report, UC040 custom list/favourites, UC041 multilanguage |
| **Quality Checks** | UC047 module, UC048 exclude countries, UC050 custom rule, UC052 run from workbook, UC053 predefined dev rules, UC054 status configuration, UC055 generate/visualise/download report | UC049 predefined rule builder, UC051 export/import rules |
| **Versioning** | UC043 versioning, UC044 compare & restore | — |
| **Integration** | UC045 xMart→DMS, UC046 DMS→xMart, UC056 develop in xMart, UC060 old-formula migration | UC057 volumes, UC060.1 formula translation |
| **Notifications** | — | UC058 module, UC059 create/edit |

**Deliberate strategy:** we will build **all 41 Pilot use cases plus 6 high-impact "N" items** (UC008 role permission matrix, UC010/UC011 disable/enable, UC032 workbook export, UC033 locking, UC040 favourites). Those six are cheap in a front-end-only build and each is a visible "they went beyond the pilot" moment.

### 1.6 Hard functional constraints worth calling out

- **UC031 — the Workbook is the product.** Exactly one of the three axes may be single-valued:
  - 1 country × N variables × N years → *country workbook*
  - 1 variable × N countries × N years → *variable workbook*
  - 1 year × N countries × N variables → *year workbook*

  Requirements: view/edit cells; **copy/paste values, formulas AND metadata** within and *across* workbooks; **Excel-like undo**; formula cells visually distinct (colour + italic — specified in the FR); formulas evaluate immediately; view/edit per-cell metadata; filter by any displayed element; fill gaps between existing points; extrapolate backwards and forwards.
- **UC024 — publishing status** is a 2-state workflow (`Not publish` / `Ready to publish`) editable **individually or in bulk**.
- **UC053 — predefined QC rules** must cover: YoY absolute/relative growth; growth between two data *versions*; new/disappeared/missing observations vs prior reporting; inconsistency between categories; inconsistency between tables; atypical entries (error *or* warning); outliers across country groups. Dev-created rules must be **visually distinguishable** from admin-created ones (colour/flag).
- **UC054** — the pass/fail/warning thresholds are **admin-configurable**, not hardcoded.
- **UC042** — complex reports run **in the background** with an in-app notification carrying a download link on success, or an error notification on failure. This is a *prototype opportunity*: a fake job queue with progress is genuinely impressive and takes an hour.
- **UC044** — up to **10 versions** viewable, comparable, and restorable per observation/variable; admins can restore a whole dataset as of a date.
- **HLR21** — reports (not the UI) must render labels in all 6 WHO languages: EN, FR, ES, AR, ZH, RU. Note the Arabic RTL implication.
- **UC057** — volumes swing from ~20 rows to **25 million**. Our grid choice must be defensible at that scale even if we seed less.

### 1.7 Annex 3 — Data retrieval API (what xMart will call on DMS)

Mandatory: HTTP GET; **CSV output** (explicitly preferred — "1/3 the size of JSON and by definition tabular"); filtering on business primary keys (country code, single year or year range); return the DMS internal ID; paging with **page size ~100,000**; **UTC `LastModified`** that is range-filterable and reflects updates, inserts *and deletes*; ability to return all data unfiltered; **soft-deleted record retrieval with an `IsDeleted` filter**; OAuth 2.0; HTTPS only. Should-have: streaming. Nice-to-have: JSON, non-PK filtering.

**Prototype treatment:** build a **"Data Retrieval API" simulator page** — a form (country, year range, `modifiedSince`, `includeDeleted`, `page`, `pageSize`) that generates the exact request URL and returns a real, downloadable CSV from the mock store with `Sys_ID` and `Sys_CommitDateUtc` columns present. This directly answers Annex 3 line-by-line and is one of the highest-scoring-per-hour screens in the whole build.

---

## 2. Reference UI Analysis (`/Reference/html_pages`)

The reference is a WHO **JEE Reporting** prototype: Bootstrap 5.0.1 + Source Sans Pro, with a hand-written SCSS layer (`jee-style.scss` → `_variables`, `_layout`, `_sidebar`, `_typography`, `utilities`). Pages: `index.html` (split-banner login), `account-management.html`, `manage-permissions.html`, `self-assessment-new.html`.

### 2.1 Design tokens to carry over verbatim

| Token | Value | Used for |
|---|---|---|
| `--who-sidebar` | `#4D7AC4` | Sidebar background |
| `--who-sidebar-hover` | `#4269a8` | Sidebar hover + active row |
| `--who-sidebar-accent` | `#3c3b54` | 4px active left-border |
| `--who-sidebar-logo` | `#446daf` | Logo block (70px, letter-spacing 4px) |
| `--who-violet-dark` | `#43425D` | Headings, primary button fill |
| `--who-primary-blue` | `#3B86FF` | Accent, active tab underline, focus ring, checkbox/radio border |
| `--who-text` | `#4D4F5C` | Body text |
| `--who-gray` | `#A3A6B4` | Muted text, table body |
| `--who-gray-light` | `#A4AFB7` | Auto-generated / hint text |
| `--who-icon` | `#BCBCCB` | Header icon row |
| `--who-page-bg` | `#F0F0F7` | App canvas |
| `--who-border` | `#E9E9F0` | Underline-only input border |
| `--who-card-shadow` | `4px 4px 11px #dedee2` | Cards |
| `--who-header-shadow` | `0 2px 4px rgba(0,0,0,.4)` | Fixed header |

**Type scale** (base 16px, Source Sans Pro 200/300/400/600/700/900): h1 40 · h2 36 (page titles override to **28**) · h3 30 · h4 24 · h5 20 · h6 16 · body 18/15/14 · table header **12 uppercase** · meta 10.

**Layout geometry:** fixed sidebar **260px** full-height · fixed header **70px** offset by 260px · content `padding: 110px 40px 80px 300px` · below 767px the sidebar hides behind a hamburger (bar1/bar2/bar3 → X animation) and content padding collapses to 0.

### 2.2 Component patterns worth keeping

1. **Shell:** fixed coloured sidebar (icon + label list, 15px padding, 4px active left-border) + fixed white header with search-left / icon-row-right (help, chat, bell) + name/role block with avatar and a `::before` vertical divider. **Adopt as-is** — it reads instantly as "WHO internal tool".
2. **Page pattern:** `<h2>` page title → **pill tabs** with a 3px `--who-primary-blue` bottom-border on active → shadowed card containing the working area. Every DMS module maps onto this (`Setup` → tabs = Countries / Currencies / Classifications / Crosses / Metadata / Formulas).
3. **Table pattern:** 12px uppercase headers, generous 20px cell padding, first column is a composite identity cell (avatar + name + secondary email), inline `form-switch` toggles for active/inactive, inline selects for role, trailing `⋮` dropdown for row actions, bottom-right shadowed pagination. **Maps 1:1 onto the Users module (UC004).**
4. **Modal pattern:** `modal-lg`, two-column form, absolutely-positioned close button, `<hr>` above a right-aligned primary action. **Use for Setup create/edit and the Cell Metadata editor.**
5. **Form pattern:** underline-only inputs (`border-bottom` only, focus → blue underline + `box-shadow: 0 1px 0`) and floating labels on login. Softer than boxed inputs — **keep for forms, but use boxed inputs inside the Workbook grid** where cell boundaries must be unambiguous.
6. **Login pattern:** 5/7 split — full-bleed banner image left, centred title with 8px letter-spacing + tagline right. **Reuse for the mock SSO screen**, replacing the password form with a "Sign in with WHO account (Entra ID)" button plus a demo role switcher.

### 2.3 Where we deliberately diverge

| Reference | DMS prototype | Why |
|---|---|---|
| Bootstrap 5 components | Tailwind + shadcn/ui, reference tokens preserved | Bootstrap has **no multi-select**, no combobox, no command palette, no resizable panels, no drawer. DMS needs all of them (country/year/variable pickers, metadata drawer, pivot builder). Fidelity lives in the *tokens*, not the framework. |
| Plain `<table>` | TanStack Table (Setup/Users/Reports) + `react-datasheet-grid` (Workbook) | Column drag-reorder (UC015), virtualisation, Excel-like editing (UC031). |
| No dark mode | **Light + dark** | *Revised after Phase 0.* The reference is light-only, so the dark palette is designed rather than lifted: hue is preserved (the sidebar stays WHO blue at 217°, deepened not neutralised) and so are semantics (blue still means reported, pink/red still means calculated, so the workbook colour coding the HA team knows reads the same in both themes). Built in Phase 0 while the surface area was 24 files — retrofitting after Phase 7 would have cost several days instead of one. |
| jQuery `custom-script.js` | React state | — |
| 4 static pages | 8 modules, ~30 routes | — |

### 2.4 The legacy DMS — what we keep, what we replace

The FR embeds screenshots of the current DMS "Express Report" — a Windows-desktop grid with a country tree on the left, a toolbar (Refresh / print / PDF / Excel export / zoom), a filter row (Countries, Language, Scale = "Millions (Default)", Show contacts), tabbed sheets ("… Estimates – General – EN", "SHA 2011 Metadata – EN"), and a wide years-across-columns matrix (2000–2023) with **pink rows for indicators and blue rows for reported values**.

**Decision 1 — keep the mental model.** Years across the top, variables down the side, a scale/currency selector, and the pink/blue row semantics. This is muscle memory for a team that has used the legacy tool for years, and fighting it would cost us both in the demo and in adoption. The dark palette in §2.3 preserves the same semantics for the same reason.

**Decision 2 — replace the chrome, and say so out loud.** The mental model is sound; the 2000s-era desktop chrome around it is what makes the legacy tool slow to work in. Four specific replacements, each tied to a use case:

| Legacy behaviour | Replacement | Why it matters |
|---|---|---|
| A permanent filter row of dropdowns (Countries / Language / Scale / Show contacts) consuming vertical space whether or not it is in use | **Filter chips.** The active selection renders as a single wrapping row of removable chips; clicking a chip reopens its picker in a popover; an "Add filter" affordance appends more | Returns vertical space to the grid, which is the whole point of the screen. UC031 requires attribute-based filtering on all three axes with multiple filters **AND**-ed together — chips express conjunction legibly where a dropdown row cannot. Chips also serialise to URL params, so a workbook selection becomes a shareable link (and a re-playable demo state) |
| Header row and label column scroll away; a 100% zoom control compensates | **Frozen headers.** Sticky year header row, sticky variable label + code column, frozen corner cell | At 25 years × ~250 variables you cannot identify a cell without both axes on screen. The zoom control exists only because the headers don't stick |
| Paged/zoomed rendering of a fixed table | **Virtualised scrolling.** The whole selection is one continuous scroll | No pagination on a data-entry surface — paging breaks copy/paste across a range, which UC031 requires |
| Metadata lives on a **separate sheet tab** ("SHA 2011 Metadata – EN"), so reading a cell's metadata means leaving the data | **Inline metadata.** A marker on cells carrying metadata, opening a drawer beside the grid that keeps the cell and the selection in view; editable in place | This is what UC031 actually asks for — *"view and edit observations metadata fields **from the workbook cells**"* — plus UC027 and UC034. Tab-switching to read a cell's provenance is the single biggest friction in the legacy tool |

**The trade-off, stated honestly:** every one of these changes what the team's hands already know. Decision 1 is the mitigation — the data model, orientation and colour coding are untouched, so what changes is only the furniture around them. The walkthrough leans into this rather than glossing it: **§6 includes a before/after beat** that puts the legacy screenshot beside the new workbook and names the four changes. Presenting them as deliberate, reasoned replacements is far stronger than hoping nobody compares.

---

## 3. Recommended Tech Stack

### 3.1 Core

| Concern | Choice | Rationale |
|---|---|---|
| Build | **Vite 6 + React 19 + TypeScript** | Instant HMR; TS is non-negotiable given ~15 sparse dimensions and a formula AST |
| Routing | **React Router 7** (declarative mode) | 8 modules × nested tabs; URL-addressable workbook selections make the demo re-playable |
| Styling | **Tailwind CSS v4** | Token-first via `@theme`; §2.1 drops straight in as CSS custom properties |
| Components | **shadcn/ui** (Radix primitives, copied into repo) | Owned source = restyle to WHO tokens freely. Ships the exact hard parts: `Command` (multi-select pickers), `Sheet` (metadata drawer), `Dialog`, `Popover`, `Tabs`, `ResizablePanelGroup`, `Toast` |
| Icons | **Lucide React** | Matches the reference's bootstrap-icons vocabulary 1:1 (`house-door`→`Home`, `bar-chart-fill`→`BarChart3`, `bell-fill`→`Bell`, `three-dots-vertical`→`MoreVertical`) |
| State | **Zustand** + slices | Workbook editing needs cross-component reads without prop-drilling; store snapshots give **undo/redo nearly free** |
| Server-state | **TanStack Query** | *Deliberate:* wrapping the mock xMart client in Query makes the fake API loading/error/refetch behaviour honest — and swapping in real xMart later is a one-file change |
| Fonts | **Source Sans Pro** (self-hosted via `@fontsource`) | Reference font; self-hosted so the demo works offline |

### 3.2 Data & grid

| Concern | Choice | Rationale |
|---|---|---|
| **Workbook grid** | **`react-datasheet-grid`** (MIT) | *Revised in Phase 0.* Glide Data Grid was the original pick, but its latest release peers on `react@16 \|\| 17 \|\| 18` — no React 19 — with nothing beyond it but alpha builds, and it drags in `lodash`, `marked` and `react-responsive-carousel`. It also corrects a mis-reading on my part: UC057's 25-million-row figure is the volume *retrieved from xMart*, not cells rendered at once. A workbook is a bounded 2D slice (1 country × ~250 variables × 25 years ≈ 6,000 cells), so DOM virtualisation is right-sized and canvas rendering was over-specified. The scaling story belongs to the Annex 3 API page. DSG ships range selection, copy/paste and keyboard nav — the UC031 essentials. |
| List/table grids | **TanStack Table v8** (headless) | Setup, Users, Reports, QC results. Column ordering API delivers UC015 drag-reorder; pairs with `@tanstack/react-virtual`. **Pin to v8** — `@tanstack/react-table@9` is a full API rewrite (`useTable`, feature composition, atom subscriptions, deprecated direct state reads) and npm resolves `^9` by default. Verified in Phase 2 |
| Drag & drop | **@dnd-kit/core + sortable** | UC015 column reorder, UC034 metadata field order, UC040 report list order |
| Formula engine | **Custom evaluator** (~250 LOC) over a hand-written recursive-descent parser | See §3.3 — this is the deliberate build-not-buy call |
| Excel export | **SheetJS (`xlsx`)** | UC032/UC042. Writes real formulas via `{f: 'B2/C2*100'}` cells — satisfying *"values are exported as values and formulas as formulas"* literally |
| Excel/CSV import | **SheetJS** + **PapaParse** | UC021/UC051 round-trip; PapaParse for the Annex-3 CSV generator |
| Charts | **Recharts** | Dashboard sparklines/bars, QC outlier scatter. Small API, adequate for a prototype |
| IDs / dates | **nanoid**, **date-fns** | `Sys_ID` generation, `Sys_CommitDateUtc` formatting |
| Mock data | **@faker-js/faker** (dev-only) + hand-curated seeds | Realistic contacts/comments; classifications and formulas are **curated, never faked** |
| Persistence | `zustand/middleware` **persist** → `localStorage` | Edits survive reload during a demo. Ship a visible "Reset demo data" action |

### 3.3 Two decisions that need defending

**Why a custom formula engine instead of HyperFormula or Handsontable?**

*Licensing:* Handsontable is free for non-commercial use only, and HyperFormula is GPL-3-or-commercial. A prototype attached to a commercial bid should not carry that ambiguity.

*Fit:* DMS formulas are not Excel formulas. They reference **variables** (`HF.1 + HF.2 + HF.nec`), not cells; they carry **null-guard conditions** (`"at least one component not null"`); they must be **per-country overridable** (UC029: "editing/customizing a predefined formula for a specific country, so that the formula would not be altered for other countries"); and they must display **as the formula text in the cell** while showing the computed value. A general spreadsheet engine fights all four. A purpose-built evaluator — tokeniser → recursive-descent parser → AST → topologically-ordered evaluation with cycle detection — is ~250 lines, has zero licence risk, and *is itself a proposal talking point*: we can show the parsed AST and the dependency graph in the demo.

Grammar to support:
```
expr    := term (('+' | '-') term)*
term    := factor (('*' | '/') factor)*
factor  := number | ref | funcall | '(' expr ')' | '-' factor
ref     := VARIABLE_CODE                    // HF.1, FS.nec, CHE, GDP, Population
                                            // optional [year±n] offset for growth rules
funcall := IDENT '(' args ')'               // SUM, AVG, MIN, MAX, ABS, IF, PREV, GROWTH
```
Functions needed by HLR8 + UC053: `SUM`, `AVG`, `MIN`, `MAX`, `ABS`, `IF`, `PREV(ref)`, `GROWTH(ref)`, `INTERPOLATE(ref)`, `EXTRAPOLATE(ref, direction)`.

**Why Tailwind + shadcn over MUI, given the reference is Bootstrap?**

MUI would impose Material's own visual language and fight the WHO tokens at every turn; theme-overriding MUI to look like §2.1 is slower than composing unstyled Radix. React-Bootstrap would let us reuse `jee-style.scss` almost verbatim — genuinely tempting — but it has no multi-select, no combobox, and no drawer, and we would hand-build the three controls this app leans on hardest.

*Fallback:* if Tailwind v4's `@theme` layer causes friction with the shadcn CLI, pin **Tailwind 3.4 + shadcn stable**. Decide this in Phase 0, hour one, and do not revisit.

### 3.4 Install script

```bash
npm create vite@latest dms-prototype -- --template react-ts
cd dms-prototype
npm i react-router-dom zustand @tanstack/react-query
npm i @tanstack/react-table @tanstack/react-virtual react-datasheet-grid
npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm i papaparse recharts lucide-react date-fns nanoid clsx tailwind-merge next-themes
npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz   # NOT npm's abandoned `xlsx`
npm i @fontsource/source-sans-pro
npm i -D tailwindcss @tailwindcss/vite @types/papaparse @faker-js/faker
npx shadcn@latest init
npx shadcn@latest add button input select checkbox switch tabs table dialog sheet \
  popover command dropdown-menu badge card tooltip toast separator scroll-area \
  resizable breadcrumb avatar label textarea radio-group progress alert skeleton
```

---

## 4. Project & File Structure

```
Prototype/
├── PROTOTYPE_PLAN.md                    ← this file
├── Requirements/                        ← untouched RFP source
├── Reference/                           ← untouched JEE reference
└── dms-prototype/
    ├── index.html
    ├── vite.config.ts
    ├── tsconfig.json
    ├── components.json                  ← shadcn config
    └── src/
        ├── main.tsx
        ├── App.tsx                      ← providers + <RouterProvider>
        ├── routes.tsx                    ← single route manifest (also feeds the sidebar)
        │
        ├── styles/
        │   ├── globals.css              ← Tailwind v4 @theme: §2.1 tokens as CSS vars
        │   └── who-tokens.css           ← geometry: sidebar 260, header 70, content pads
        │
        ├── domain/                       ← types + pure logic. ZERO React imports.
        │   ├── types.ts                 ← Observation, Variable, Cross, Country, Currency,
        │   │                              Formula, QcRule, Report, User, Version, Notification
        │   ├── constants.ts             ← DIMENSIONS[], YEARS, WHO_REGIONS, WHO_LANGUAGES,
        │   │                              PUBLISHING_STATUS, ROLES, METADATA_FIELDS
        │   ├── keys.ts                  ← surveyFk(iso3, year), observationKey(dims), parseSurveyFk
        │   │
        │   ├── formula/
        │   │   ├── tokenizer.ts
        │   │   ├── parser.ts            ← recursive descent → AST (§3.3 grammar)
        │   │   ├── ast.ts
        │   │   ├── evaluator.ts         ← AST + resolver → number | null
        │   │   ├── functions.ts         ← SUM AVG MIN MAX ABS IF PREV GROWTH
        │   │   │                          INTERPOLATE EXTRAPOLATE
        │   │   ├── dependencies.ts      ← dep graph, topo sort, cycle detection
        │   │   ├── nullPolicy.ts        ← 'any-not-null' | 'all-not-null' guards
        │   │   └── index.ts
        │   │
        │   ├── qc/
        │   │   ├── ruleTypes.ts         ← growth | versionDelta | newObs | missingObs |
        │   │   │                          disappearedObs | categoryConsistency |
        │   │   │                          tableConsistency | atypical | outlier
        │   │   ├── runner.ts            ← rule × scope → QcFinding[]
        │   │   ├── predefined.ts        ← the UC053 dev-authored rule set (flagged origin:'dev')
        │   │   ├── thresholds.ts        ← UC054 configurable pass/fail/warn
        │   │   └── report.ts            ← findings → QcReport
        │   │
        │   ├── workbook/
        │   │   ├── shape.ts             ← axis validation: exactly one single-valued axis
        │   │   ├── build.ts             ← selection + observations → WorkbookMatrix
        │   │   ├── edit.ts              ← setCell, setFormula, setMetadata, bulk status
        │   │   ├── clipboard.ts         ← TSV serialise/parse for values|formulas|metadata
        │   │   ├── undo.ts              ← bounded command stack (Excel-like)
        │   │   └── series.ts            ← interpolate gaps, extrapolate back/forward
        │   │
        │   ├── report/
        │   │   ├── pivot.ts             ← rows/cols/values/filters/groups → PivotResult
        │   │   └── definitions.ts       ← seeded predefined reports
        │   │
        │   └── versioning/
        │       ├── snapshot.ts          ← Sys_CommitDateUtc-stamped versions, cap 10
        │       └── diff.ts             ← version compare
        │
        ├── data/                         ← the fake xMart
        │   ├── xmart/
        │   │   ├── client.ts            ← XMartClient interface — THE swap point
        │   │   ├── mockClient.ts        ← in-memory impl + artificial latency
        │   │   ├── longFormat.ts        ← ↔ SURVEY_FK/AGE/…/Sys_* row mapping (§1.3)
        │   │   ├── apiLog.ts            ← every simulated call, for the Dev drawer (UC045/046)
        │   │   └── retrievalApi.ts      ← Annex-3 GET simulator: paging, modifiedSince,
        │   │                              includeDeleted, CSV emit
        │   ├── seed/
        │   │   ├── countries.ts         ← 196, real ISO3/ISO2/WHO region/WB income
        │   │   ├── currencies.ts
        │   │   ├── classifications.ts   ← HF full from FR §1 + FS, HC, HP, FP, DIS, GEN,
        │   │   │                          AGE, IND, MACRO, HK, HCR, HKR, HC_RI, FS_RI
        │   │   ├── crosses.ts           ← predefined + per-country custom
        │   │   ├── formulas.ts          ← all 16 from §1.4, plus legacy-DMS text formulas
        │   │   ├── metadataFields.ts    ← SOURCES COMMENT WEB_LINK EST_METHOD DATA_TYPE
        │   │   ├── users.ts
        │   │   ├── qcRules.ts
        │   │   ├── reports.ts
        │   │   └── reportingFollowUp.ts ← UC023 country comms log + due dates
        │   ├── generators/
        │   │   ├── observations.ts      ← plausible time series: trend + noise +
        │   │   │                          deliberate gaps, outliers, and inconsistencies
        │   │   │                          so QC rules have real findings to report
        │   │   ├── versions.ts          ← 1–10 historical versions for some observations
        │   │   └── seedRandom.ts        ← seeded PRNG → identical data every demo
        │   └── db.ts                     ← builds the store once, persists to localStorage
        │
        ├── stores/
        │   ├── authStore.ts             ← mock user, role, demo role-switcher
        │   ├── setupStore.ts            ← components, attributes, column order, LOVs
        │   ├── workbookStore.ts         ← selection, matrix, dirty cells, undo stack, locks
        │   ├── qcStore.ts               ← rules, runs, reports, thresholds
        │   ├── reportStore.ts           ← definitions, favourites, background job queue
        │   ├── notificationStore.ts     ← in-app notifications (UC042 job completion)
        │   └── uiStore.ts               ← sidebar, drawers, dev-drawer visibility
        │
        ├── hooks/
        │   ├── useObservations.ts       ← TanStack Query over XMartClient
        │   ├── useWorkbook.ts
        │   ├── useUndoRedo.ts           ← Ctrl+Z / Ctrl+Y binding
        │   ├── useClipboard.ts          ← Ctrl+C / Ctrl+V over the grid selection
        │   ├── usePermissions.ts        ← can(module, action) from the role matrix
        │   └── useColumnOrder.ts        ← persisted per-component order (UC015)
        │
        ├── components/
        │   ├── ui/                      ← shadcn primitives (generated)
        │   ├── layout/
        │   │   ├── AppShell.tsx         ← sidebar + header + content grid (§2.1 geometry)
        │   │   ├── Sidebar.tsx          ← from routes.tsx, permission-filtered
        │   │   ├── Header.tsx           ← search, help, notifications bell, user block
        │   │   ├── PageHeader.tsx       ← <h2> 28px + breadcrumb + action slot
        │   │   ├── ModuleTabs.tsx       ← pill tabs, 3px blue active underline
        │   │   └── DevDrawer.tsx        ← live xMart API call log — the "we get it" flourish
        │   ├── common/
        │   │   ├── DataTable.tsx        ← TanStack + drag headers + pagination + CSV out
        │   │   ├── MultiSelectCombobox.tsx  ← shadcn Command; attribute-based filtering
        │   │   ├── CountryPicker.tsx    ← region/income/OECD group chips (UC022)
        │   │   ├── VariablePicker.tsx   ← classification tree + cross builder
        │   │   ├── YearRangePicker.tsx
        │   │   ├── AttributeFilterBar.tsx
        │   │   ├── StatusBadge.tsx      ← publishing status, QC pass/fail/warn
        │   │   ├── EmptyState.tsx / LoadingState.tsx
        │   │   └── ConfirmDialog.tsx
        │   └── workbook/
        │       ├── WorkbookGrid.tsx     ← react-datasheet-grid host; frozen headers (§2.4)
        │       ├── cellRenderers.tsx    ← value vs formula (blue italic) vs indicator (pink)
        │       ├── FormulaBar.tsx
        │       ├── WorkbookFilterChips.tsx ← §2.4 chips; syncs selection ↔ URL params
        │       ├── MetadataDrawer.tsx   ← per-cell metadata, dnd-kit field order (UC034)
        │       ├── WorkbookToolbar.tsx  ← scale, currency, undo/redo, run QC, export
        │       ├── SeriesToolsDialog.tsx← fill gaps / extrapolate
        │       ├── BulkStatusDialog.tsx ← UC024 bulk publishing status
        │       └── VersionCompare.tsx   ← UC043/044 side-by-side + restore
        │
        ├── modules/                      ← one folder per RFP module; pages only
        │   ├── auth/LoginPage.tsx        ← reference 5/7 banner split + Entra ID mock
        │   ├── home/HomePage.tsx         ← UC002 module tiles + UC003 dashboard
        │   ├── users/{UsersListPage,UserDetailPage,RolePermissionsPage,CreateUserDialog}.tsx
        │   ├── setup/
        │   │   ├── SetupPage.tsx        ← tab host
        │   │   └── tabs/{Countries,Currencies,Classifications,Crosses,Metadata,
        │   │              Formulas,ReportingFollowUp}Tab.tsx
        │   ├── workbooks/{WorkbookSelectPage,WorkbookPage}.tsx
        │   ├── reports/{ReportsListPage,ReportBuilderPage,ReportRunPage,
        │   │             DataTrackingReportPage}.tsx
        │   ├── quality/{QcListPage,QcRuleEditorPage,QcRunPage,QcReportPage,
        │   │             QcThresholdsPage}.tsx
        │   ├── notifications/NotificationsPage.tsx
        │   └── integration/{XMartStatusPage,RetrievalApiPage}.tsx
        │
        └── lib/
            ├── cn.ts
            ├── format.ts                ← NCU/USD/millions/percent, decimals from currency
            ├── excel.ts                 ← SheetJS wrappers, values-as-values/formulas-as-formulas
            ├── csv.ts                   ← PapaParse wrappers, Annex-3 shaped output
            ├── download.ts
            └── i18n.ts                  ← 6-language label lookup for reports (HLR21)
```

**Three structural rules, enforced:**
1. `domain/` never imports React, a store, or a component. It is pure, unit-testable logic — and it is the part that survives into production.
2. All data access goes through `XMartClient`. No module reads `db.ts` directly. When xMart is real, one file changes.
3. `routes.tsx` is the single source of truth for navigation, page titles, and required permissions. The sidebar is derived, never hand-maintained.

---

## 5. Phase-by-Phase Roadmap

Effort in **developer-days for one senior engineer**. Total **≈19 days**; the demo is presentable from day 9 and compelling from day 14.

### Phase 0 — Foundation (1.5 d)

1. Scaffold Vite + React 19 + TS in `Prototype/dms-prototype/`.
2. Install everything in §3.4. **Verify Tailwind v4 + shadcn CLI in the first hour**; fall back to Tailwind 3.4 if it fights, and record the decision.
3. `styles/globals.css`: every §2.1 token as a CSS variable inside `@theme`; wire Source Sans Pro; set the type scale.
4. `styles/who-tokens.css`: sidebar 260px, header 70px, content `110px 40px 80px 300px`, the 767px collapse.
5. `AppShell` + `Sidebar` + `Header` — pixel-match the reference. Hamburger with the bar1/bar2/bar3 → X animation.
6. `routes.tsx` with all 8 modules and placeholder pages; sidebar derives from it.
7. `LoginPage`: reference 5/7 split, "Sign in with WHO account (Entra ID)" button, plus a demo role switcher (Administrator / Regular user). Mock SSO = set `authStore` and redirect.

**Done when:** every module is reachable, the shell is indistinguishable from the reference at 1440px and usable at 768px, and role switching works. → **UC001, UC002, UC006** demonstrable.

### Phase 1 — Domain model & mock xMart (2.5 d)

1. `domain/types.ts` — `Observation` mirrors §1.3 exactly: sparse dimension record, `value: number | null`, metadata record, `sys` block. **Do not invent a `crossId` field**; a cross is a multi-dimension tuple.
2. `domain/constants.ts`, `domain/keys.ts` (`surveyFk`, `parseSurveyFk`, `observationKey`).
3. `data/seed/*`: 196 real countries with `GRP_WHO_REGION` / `GRP_WB_INCOME` / `OECD` / focal point; currencies; HF verbatim from FR §1 plus the other 14 dimensions at 2–3 levels; the 16 formulas from §1.4; the 5 metadata fields.
4. `data/generators/observations.ts` with a **seeded PRNG** — identical data every run, so the demo script never drifts. Generate for ~40 countries × 2000–2024 × ~250 variables (≈250k observations) and **plant the defects QC needs to find**: gaps mid-series, a 400% YoY jump, a category sum that doesn't reconcile, a per-capita outlier inside a region, observations present in 2022 and absent in 2023.
5. `data/generators/versions.ts` — 1–10 versions on a curated subset.
6. `data/xmart/longFormat.ts` — round-trip mapping to the exact §1.3 column list.
7. `data/xmart/mockClient.ts` behind the `XMartClient` interface, with 150–400ms artificial latency and an `apiLog` entry per call.
8. `db.ts` + zustand `persist`; a "Reset demo data" action in the header.

**Done when:** `mockClient.getObservations({country:'CAN', years:[2020,2023]})` returns correct long-format rows, and the API log records the call. → **UC014, UC045** foundation.

*Revised during Phase 1:* the original "<300ms" figure conflicted with the mock client's own deliberate 150–400ms artificial latency, which exists so the UI exercises real loading states. The gate is now split — wall-clock bounded by the configured latency band, and pure derivation timed separately (a 4-year country slice derives in single-digit milliseconds).

*Also added during Phase 1:* an **economic plausibility suite**. The first generator pass produced Canada with a $619k GDP per capita, an exchange rate of 862 CAD/US$, 42% out-of-pocket spending and `HF.nec` as the largest financing scheme — every one of which an HA economist would spot immediately, and the seed file claims "nothing here is faked". Fixed by real reference exchange rates per currency, real populations, `LAST_YEAR` anchoring, income-sensitive out-of-pocket and external-financing shares, and normalised within-dimension shares. The resulting medians now track WHO GHED: HIC 9.8% CHE/GDP · 12.1% OOP · 0.3% external; LIC 5.3% · 33.1% · 11.4%. All of it is asserted in tests so a later change cannot silently regress it.

### Phase 2 — Setup module (2.5 d)

1. `DataTable`: TanStack Table + `@tanstack/react-virtual`, `dnd-kit` header drag-reorder persisted per component (**UC015**), column visibility, filter, CSV export, reference-styled pagination.
2. Tabs — Countries, Currencies, Classifications & Categories, Crosses, Metadata, Formulas — each with view / create / edit, using the real xMart field names from §1.3.
3. Attribute editor: `groupable` flag per attribute (**UC022**); list-of-values editing (**UC016**); create new value (**UC017**); create new attribute typed free-text / LOV / date (**UC018**, bonus); delete guarded by usage with disable-instead (**UC020**, bonus).
4. **Crosses tab:** predefined crosses list, read-only for regular users with export/copy (**UC025**); cross builder picking two dimensions + members, scoped to a country for custom crosses (**UC026**).
5. **Formulas tab:** all 16 seeded with folder grouping, formula text, condition, and unit; create/edit; **per-country override** (UC029's "customize for a specific country without altering others"); custom formulas scoped to observation/workbook/country (**UC030**); a read-only "Legacy DMS formulas" section showing migrated plain-text formulas (**UC060**).
6. **Metadata tab:** two areas — Observations and Old DMS Formulas — with the three field types (**UC027**).
7. **Reporting follow-up tab:** per-country communications log, focal-point contact, request-sent / response-due dates, status (**UC023**).
8. Excel export/import per component via SheetJS with a validation summary (**UC021**, bonus).
9. SharePoint MET-files hyperlink card, with an explanatory tooltip (**UC028**).

**Done when:** all 6 components are viewable and editable by an admin, read-only for a regular user, columns drag-reorder and the order persists across reload. → **UC013, 014, 015, 016, 017, 022, 023, 025, 026, 027, 028, 029, 030, 060** (+ 018, 021).

*Phase 2 outcome:* all seven tabs render against the mock client with no console errors; 194 countries across 15 columns with search and pagination; drag-reorder verified to survive a reload (the acceptance criterion); all 16 formulas grouped by folder with their verbatim conditions, `ANY`/`ALL` null-policy badges and the UC029 country-override badge; the cross builder derives `HC.1xHF.1` from two dimension picks; and a regular user sees the read-only variant while retaining Export CSV per UC007. UC020 (delete guarded by usage) was **dropped from the bonus list** — proving a value is unused needs a full-corpus scan the front end cannot honestly perform, so the LOV editor states the constraint instead of miming a check it did not make.

### Phase 3 — Formula engine (2 d) — *the technical centrepiece*

1. `tokenizer.ts`, `parser.ts`, `ast.ts` — the §3.3 grammar. Variable codes contain dots, `%`, `$`, and `-` (`CHE%GDP_SHA2011`, `GGHE-D_pc_US$_SHA2011`): tokenise refs greedily against the known-variable set, don't guess from characters.
2. `dependencies.ts` — dependency graph, topological order, cycle detection with a clear error naming the cycle.
3. `nullPolicy.ts` — `any-not-null` vs `all-not-null`, returning `null` (blank) not `0` when the guard fails. This distinction is visible in exports and the RFP cares about it.
4. `evaluator.ts` — AST + a resolver closure `(code, year) => number | null`. `PREV`/`GROWTH` shift the year; `INTERPOLATE`/`EXTRAPOLATE` read the whole series.
5. `functions.ts` — the 10 functions.
6. `series.ts` — linear interpolation between known points; linear/CAGR extrapolation backwards and forwards (HLR8's "filling data series" and "extrapolate for previous and future values").
7. **Unit tests** on all 16 seeded formulas: `CHE = HF.1+HF.2+HF.3+HF.4+HF.nec`, `CHE%GDP = CHE/GDP*100` (nested), null-guard behaviour, and a deliberate cycle. Vitest, ~30 cases.

**Done when:** every seeded formula evaluates correctly for a real country-year, nested formulas resolve in dependency order, guards produce blanks, and cycles are reported rather than hanging. *Show the AST and dependency graph in the demo — it is proof of engineering depth that screenshots cannot fake.*

*Phase 3 outcome:* the engine is 12 files in `src/domain/formula/` — tokeniser, recursive-descent parser, AST, dependency graph, evaluator, null policies, series maths, the 10 functions, and a `createFormulaEngine` facade — with **83 new unit tests** (129 total, all three gates green). All 16 seeded formulas evaluate for Canada 2022 with no blanks: CHE 400,845 NCU m · CHE%GDP **10.6%** · CHE per capita **US$ 7,904** · OOP share **20.1%** · external share **0.5%**. `CHE%GDP → CHE → HF.1 → HF.1.1` resolves through the topological order, and `HF TOT` — computed as an aggregate rather than by formula — agrees with `CHE` to six decimals, which is a genuine cross-check of the two paths against each other.

Four decisions worth recording:

1. **Greedy tokenisation was load-bearing, and the corpus is worse than the plan warned.** Beyond `.`, `%`, `$` and `-`, the classification set contains `HF TOT` — a variable code **with a space in it**. No character-level rule separates it from two adjacent tokens, so references are matched longest-first against the known-code set and nothing is inferred from characters. Tests cover all five character classes.
2. **A formula may reference its own code, and that is not a cycle.** The FR lists `GGHE-D` among the indicators with the expression `GGHE-D`, because it is sourced from the macro series rather than derived. A self-reference onto a code that is also a real variable resolves as an identity onto the underlying data; a self-reference onto anything else is a genuine cycle and is reported. Both are tested.
3. **The FR's per-capita expressions had a unit bug on our corpus.** `CHE / Population / Ex. rate`, taken verbatim, gave Canada **US$ 0.0079** per capita: expenditure is in NCU *millions* while Phase 1 locked `POP` to a count of people. The three per-capita formulas now carry an explicit `* 1000000` and the seed file explains why, so the assumption is visible on the Formulas tab where an evaluator can challenge it — rather than hidden inside the evaluator.
4. **The tab now evaluates rather than describes.** A country-year selector drives live values on all 16 rows; an **inspector** per formula shows the expression, the parsed AST, every input read with its year and origin, the guard verdict and the dependency chain; a **dependency-graph dialog** shows the topological order and names any cycle; and the editor validates live — syntax, unknown codes, and a cycle check that disables Save before a circular formula can be created. `npm run verify:formulas` drives all of that in a browser and is clean.

*Not fixed here, and deliberately:* the seeded corpus does not reconcile `GGHE-D%CHE` (49.2%) + `PVT-D%CHE` (66.1%) + `EXT%CHE` (0.5%) to ~100% for Canada, because Phase 1 draws `GGHE-D` as an independent share of CHE while `PVT-D` comes out of the FS partition. The engine is right and the arithmetic is right; the generator's two paths are not tied together. It is a Phase 1 generator change with its own economic-plausibility suite attached, so it is recorded as an open item rather than folded into this phase.

### Phase 4 — Workbook module (4 d) — *the product*

**Chrome spec:** this phase implements §2.4 Decision 2. Before writing the toolbar, re-read that table — the four replacements are requirements of this phase, not polish to reach if time allows. They land in `WorkbookGrid` (frozen headers, virtualised scroll), `cellRenderers` (metadata marker), `WorkbookFilterChips` (chips) and `MetadataDrawer` (inline metadata).

1. **`WorkbookSelectPage`** — three axis pickers with the constraint from UC031 enforced in the UI: choosing multi on two axes forces the third to single, and the resulting workbook type is named on screen (*country / variable / year workbook*). Attribute-based filtering on every axis; multiple filters AND together (per UC031).
2. **`WorkbookGrid`** on `react-datasheet-grid`: virtualised, years across / variables down for a country workbook, with a **sticky year header row, sticky variable label + code column, and a frozen corner** (§2.4). Left-column pinning is the known unknown in DSG — **spike this first, before anything is built on top of it.** If it cannot be done cleanly, the fallback is a second synchronised grid rendering the label column, decided on day 1 of this phase and not revisited.
3. **Cell renderers** matching both the RFP and the legacy screenshots: reported values plain; **formula cells blue-italic** (FR: *"cells containing formulas with a different format (color, italic)"*); calculated indicators on a pink-tinted row; publishing status as a corner marker; a **metadata-present marker** (§2.4 — the affordance that replaces the legacy metadata tab); QC failures ringed red / warnings amber. All six states must read correctly in **both themes** — the cell tokens flip, so verify against `--who-cell-*` rather than hardcoding.
4. **`WorkbookFilterChips`** — the active country / variable / year selection and every attribute filter render as a wrapping row of removable chips; clicking a chip reopens its picker in a popover; "Add filter" appends more (§2.4). **Chips serialise to URL search params**, so a workbook selection is a shareable link — this is also the mechanism behind the `?scenario=` demo shortcuts in Phase 8.8.
5. **Editing:** type a value; type `=HF.1+HF.2` to create a formula; `FormulaBar` shows the formula while the cell shows the computed value; edits recompute dependents immediately.
6. **Clipboard (UC031):** `Ctrl+C`/`Ctrl+V` over a range, with three paste modes — values, formulas, metadata — and **cross-workbook paste** via a store-level clipboard that survives navigation. TSV format so Excel interop works both directions.
7. **Undo/redo:** bounded command stack, `Ctrl+Z`/`Ctrl+Y`, covering value, formula, metadata, and bulk-status changes.
8. **`MetadataDrawer`:** shadcn `Sheet` on cell click; edit the 5 metadata fields; dnd-kit reordering persisted per user (**UC034**, bonus). Per §2.4 this **replaces the legacy metadata sheet tab**, so two things are non-negotiable: the drawer opens *beside* the grid without unmounting it, and the cell selection survives opening, editing and closing. If reading a cell's metadata loses your place in the data, we have rebuilt the problem we set out to remove.
9. **`SeriesToolsDialog`:** select a range → fill gaps / extrapolate back / extrapolate forward, with a preview before commit.
10. **`BulkStatusDialog`:** set publishing status for a selection or by classification/category/indicator across a country (**UC024**).
11. **Locking (UC033, bonus):** a `locks` map in `workbookStore`; opening a workbook another (simulated) user holds shows the RFP's exact warning — *"This data set is being edited by another user, so it will be displayed in View Only mode"* — and the grid goes read-only. A demo control lets the presenter simulate the second user.
12. **Export (UC032, bonus):** SheetJS `.xlsx` where formula cells emit `{f: …}` and value cells emit values.
13. **"Run Quality Checks" toolbar action** (wired in Phase 5).
14. **Version compare (UC043/044):** right-click a cell → up to 10 versions with `Sys_CommitDateUtc` and author, side-by-side diff, restore-as-current; admin dataset-level restore as of a date.
15. **Save → xMart (UC046):** an explicit Save that logs a `POST` to the API drawer, with the author user-id in the payload, and clears the dirty state.

**Done when:** a presenter can open Canada 2000–2024 × HF classification, edit a value, watch `CHE` and `CHE%GDP` update, copy a range into another workbook, undo it, open metadata, fill a gap, compare versions, restore one, and save — without a stumble. → **UC031, 024, 043, 044, 046** (+ 032, 033, 034).

**Also done when** all four §2.4 replacements hold under use: scrolling to 2024 × `HF.nec` keeps both headers pinned; removing a filter chip narrows the grid and updates the URL; pasting the link into a fresh tab restores the same selection; and opening metadata on a cell leaves the grid mounted with that cell still selected. Capture a screenshot of the finished workbook here — Phase 8 needs it for the before/after beat.

*Phase 4 outcome:* the module is 14 files across `src/domain/workbook/` (pure), `src/stores/`,
`src/hooks/` and `src/modules/workbooks/`, with **37 new domain tests** (166 total) and a
34-check browser harness, `npm run verify:workbook`, that drives the "done when" sentence end
to end and comes back clean with no console errors. Screenshots in `artifacts/shots-p4/`.

**The day-1 spike answered both questions, and the second answer was better than expected.**

1. **The nested `react-dom@18` was not inert — it crashed every route.** DEPENDENCIES.md §7.1
   had it recorded as a latent bundle-size concern. It was not: `react-resize-detector@7.1.2`
   pulls a React 18 `react-dom` that reads `ReactCurrentDispatcher` off the single React **19**
   instance at module-evaluation time, an internal React 19 deleted, so importing DSG threw
   before anything rendered — on *every* page, because `routes.tsx` imports the workbook
   statically. Fixed with one `overrides` entry pinning `react-resize-detector` to `^12.3.0`,
   which removes the nested `react-dom`, the nested detector and `lodash` from the tree
   together. Full reasoning and the two regression paths are now **DEPENDENCIES.md §6.5**, a
   do-not-touch entry rather than an open item.
2. **The planned fallback was not needed.** DSG's `gutterColumn` is the one slot it makes
   `position: sticky; left: 0`; widened to 260px and given the variable label over its code, it
   *is* the frozen label column, and its header slot is the frozen corner. So all four §2.4
   replacements land natively — no second synchronised grid, and the Phase 4 day-1 contingency
   is closed rather than spent.

**Three bugs the browser harness caught that no unit test would have.** Each was a real defect,
not a test artefact, and each is worth recording because they are the class of thing that only
appears under a real pointer:

- `keepFocus: true` on the columns put every *clicked* cell straight into edit mode, so a single
  click replaced the value and range selection — which UC031's copy/paste depends on — was
  impossible. Removed.
- Enter in the formula bar bubbled to DSG's document-level key handler, which then opened the
  active cell for editing immediately after the bar had committed to it. The bar now stops
  propagation of Enter and Escape.
- DSG clears its active cell whenever focus leaves the grid, which is every time the user
  reaches for the toolbar — so Copy, the series tools and bulk status all saw an empty
  selection. The page now retains the last real selection and clears it only when the workbook
  itself changes.

**One deliberate deviation from the item list above.** Item 8 says the metadata drawer is a
shadcn `Sheet`. A `Sheet` is a Radix portal with a scrim: it renders *over* the grid and takes
focus, which rebuilds the very "leave the data to read about the data" motion the legacy
metadata tab forces. §2.4 is the more specific requirement and it wins, so the drawer is a flex
sibling of the grid instead. The harness asserts the consequence directly: opening it leaves
36/36 cells mounted, `CAN · 2019 · HF.3.1` still selected, and zero modal dialogs on screen.

*Also worth noting:* DSG ships light-only CSS variables, so in dark mode the grid's chrome
stayed white while its cells flipped. Mapped onto the WHO tokens in `globals.css` — the one file
allowed to hold colour — rather than by editing DSG's generated stylesheet, which any reinstall
would overwrite.

*Deferred, and stated rather than quietly dropped:* UC044's **admin dataset-level restore as of
a date** is not built. Per-observation compare and restore is (right-click any cell → up to ten
versions with the delta against current, restore writes a normal undoable edit authored by the
restorer). The dataset-level variant needs a bulk as-of query the mock client does not expose,
and it belongs with the Phase 7 admin screens rather than bolted onto the grid.

### Phase 5 — Quality Checks module (2.5 d)

1. `ruleTypes.ts` + `runner.ts` covering all nine UC053 categories: YoY absolute/relative growth; growth between two data versions; new / disappeared / missing observations vs prior reporting; between-category inconsistency; between-table inconsistency; atypical entries (error **or** warning); group outliers by country attribute.
2. `predefined.ts` — the dev-authored rules, tagged `origin: 'dev'` and rendered with a distinct badge and colour so users can tell them from admin-created rules (**UC053** requirement).
3. `QcListPage` — rules grouped by type, with a "My custom rules" group; run, edit, duplicate.
4. `QcRuleEditorPage` — build a rule from variables, a comparison, a threshold, and a scope; **country exclusions with a one-click reset** (**UC048**); custom rules private to their author and visible to admins (**UC050**); admin predefined-rule authoring (**UC049**, bonus).
5. `QcThresholdsPage` — configurable pass / fail / warning criteria (**UC054**).
6. Run scope: single country, or a group selected by attribute (*"Region=EURO or OECD=Y"* — the FR's own example).
7. `QcReportPage` — findings table (country, year, variable, rule, expected, actual, deviation, severity), summary tiles, a Recharts outlier scatter, download as `.xlsx` and `.csv`, and a persistent report history in the module (**UC055**).
8. Workbook integration (**UC052**): run applicable rules against the current workbook selection, ring the offending cells, and surface a findings panel inline.
9. Excel export/import of the rule set (**UC051**, bonus).

**Done when:** running the full predefined set over EURO produces a report with real findings that trace back to the defects planted in Phase 1, and running from a workbook visibly marks the offending cells. → **UC047, 048, 050, 052, 053, 054, 055** (+ 049, 051).

### Phase 6 — Reports module (2 d)

1. `pivot.ts` — rows / columns / values / filters / groupings over observations, with subtotals.
2. `ReportBuilderPage` — drag fields between Rows / Columns / Values / Filters buckets (dnd-kit), a live preview, save as predefined (admin) or custom (regular user). This is the RFP's *"similar to Excel Pivot Tables"* (**UC036**, **UC037** bonus).
3. `ReportsListPage` — grouped into Predefined / Custom / Data Tracking; favourites star (**UC040** bonus); duplicate-as-custom (**UC038** bonus).
4. `ReportRunPage` — parameter prompts, then unit + currency + scale selection (the legacy screenshot's "Millions (Default)"), and a display-on-screen vs download-only choice.
5. **Background jobs (UC042):** reports flagged heavy, or multi-country runs, enqueue into `reportStore` with a progress bar; on completion push an in-app notification carrying a download link; on failure push an error notification. Multi-country runs produce **one .xlsx per country**, exactly as the FR describes.
6. `DataTrackingReportPage` (**UC039**) — per-country submission status from the mock xMart import metadata: last received date, series, format (JHAQ / HAQ / Mini / HAPT), row count, batch id.
7. Language selector stub for report labels — EN / FR / ES populated, AR / ZH / RU listed (**UC041** partial; note the Arabic RTL work in the proposal rather than faking it).

**Done when:** an admin builds a pivot report, saves it, a regular user runs it for 5 countries, and 5 `.xlsx` files arrive via a notification with a working download link. → **UC035, 036, 039, 042** (+ 037, 038, 040, partial 041).

### Phase 7 — Users, Home dashboard, Integration (2 d)

1. **Users (UC004/005/007/012):** the reference table pattern almost verbatim — avatar + name + email identity cell, active switch, role select, `⋮` actions, pagination. Grant access by email (internal vs Entra ID guest); guests are `Regular User` with the role control disabled (per UC007); **no delete action anywhere** — only disable (UC012). Disable/enable with the last-admin guard (**UC010/011**, bonus).
2. **`RolePermissionsPage` (UC008, bonus):** the module × permission matrix from the FR, read-only with an Edit button, values `No Access | View | Edit | Edit Selected Countries | Country Customized | Create Predefined`. `usePermissions` reads it live, so flipping Setup to *View* immediately hides admin controls — a strong 20-second demo beat.
3. **`HomePage` (UC002/UC003):** module tiles (permission-filtered) plus a dashboard — countries reported this cycle, observations pending publication, open QC findings by severity, recent activity, upcoming reporting due dates, a data-completeness heatmap. Different tile sets for admin vs regular user (**UC003.1**, bonus).
4. **`XMartStatusPage` (UC045/046/056):** the To-Be architecture diagram rendered live, last-sync timestamps per source (eDamis, OneDrive, HAPT, WB/IMF/UN), a manual "Pull from xMart" that shows real progress, and the API call log.
5. **`RetrievalApiPage` (Annex 3):** the request builder from §1.7 — country, year range, `modifiedSince`, `includeDeleted`, `page`, `pageSize` (default 100,000) — showing the generated URL, an OAuth 2.0 bearer-token placeholder, response headers with paging metadata, and a downloadable CSV carrying `Sys_ID` and `Sys_CommitDateUtc`. **Walk the evaluator down the Annex 3 mandatory list on this one screen.**
6. **Notifications panel:** header bell with an unread count, panel listing job completions and reporting due dates, `NotificationsPage` list view.

**Done when:** the permission matrix visibly changes what a regular user can do, and the Retrieval API page answers every mandatory Annex 3 row on screen. → **UC004, 005, 007, 012, 045, 046, 056** (+ 003.1, 008, 010, 011, partial 058).

### Phase 8 — Polish, demo script, packaging (1.5 d)

1. Loading skeletons, empty states, error boundaries, and toasts everywhere — a prototype that never shows a blank pane reads as finished.
2. Keyboard pass: `Ctrl+Z/Y`, `Ctrl+C/V`, arrow navigation and `Tab`/`Enter` commit in the grid, `Esc` closes drawers.
3. Accessibility pass. *Largely done in Phase 0:* focus-visible rings, ARIA labels on icon-only buttons, and a WCAG audit over 18 token pairs in both themes (script at `scratchpad/theme.mjs` — **promote it into the repo as `scripts/contrast-audit.mjs` here**). Remaining: re-run it after Phases 4–7 add cell, chart and badge colours, and re-check the three documented light-theme shortfalls at the foot of `globals.css`.
4. Responsive check at 1920 / 1440 / 1280 / 1024 / 768, **in both themes**.
5. **`DEMO_SCRIPT.md`** — a 12-minute click-path (§6). Needs one asset for the 3:00 before/after beat: the legacy Express Report screenshot, which is embedded in the RFP at `Requirements/2. Functional Requirements PFD-2026-001.docx` → `word/media/image5.png` (a .docx is a zip; extract that one entry). Put it beside the Phase 4 workbook screenshot in a side-by-side slide.
6. **`README.md`** — run instructions, the architecture diagram, the mock-vs-real boundary table, and the use-case coverage matrix. The coverage matrix is a proposal exhibit in its own right.
7. `npm run build` → static bundle; verify it runs from `file://` or a static host so the demo cannot be broken by a network.
8. Optional: `?scenario=` URL params to jump straight to demo states, so a mis-click never costs 30 seconds in front of the panel.

---

## 6. Demo script skeleton (12 minutes)

| min | Beat | Use cases |
|---|---|---|
| 0:00 | Entra ID sign-in → Home dashboard as Administrator | UC001, 002, 003, 006 |
| 1:00 | Setup → Countries: 196 rows, drag a column, group by WHO region | UC013, 014, 015, 022 |
| 2:00 | Setup → Formulas: `CHE%GDP`, show the parsed AST and dependency graph, override it for one country | UC029, 030 |
| 3:00 | **Before / after (§2.4).** Legacy "Express Report" screenshot beside the new workbook. Name the four replacements — filter chips for the dropdown row, pinned headers for the zoom control, continuous scroll for paging, inline metadata for the separate tab — then state what is deliberately *unchanged*: years across, variables down, pink/blue row semantics, scale selector. "We kept what your team knows and replaced what slows them down." | §2.4 |
| 3:30 | Workbook: Canada × HF × 2000–2024. Edit `HF.1` → `CHE` and `CHE%GDP` recompute live | UC031 |
| 5:00 | Copy a range into an Argentina workbook, paste as formulas, `Ctrl+Z` | UC031 |
| 6:00 | Open cell metadata, fill a series gap, bulk-set "Ready to publish" | UC024, 027 |
| 7:00 | Right-click → compare 4 versions → restore | UC043, 044 |
| 8:00 | Run QC from the workbook → cells ring red → open the QC report → download | UC052, 055 |
| 9:00 | QC module: run the predefined set over EURO, show the outlier scatter | UC047, 048, 053, 054 |
| 10:00 | Reports: build a pivot, run for 5 countries, 5 `.xlsx` arrive via notification | UC035, 036, 042 |
| 11:00 | Users: flip Setup permission to *View*, switch to a regular user, controls vanish | UC004, 007, 008, 012 |
| 11:30 | Retrieval API page: generate the Annex 3 request, download the CSV | Annex 3, UC045, 046 |

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| ~~Glide Data Grid's API has a learning curve~~ **RESOLVED in Phase 0:** Glide does not support React 19, so `react-datasheet-grid` is now the primary choice | Custom cell renderers for the UC031 value/formula/indicator semantics are still the main unknown. Spike them at the start of Phase 4, before building the toolbar and clipboard on top |
| Formula engine over-runs its 2 days | It is scoped to arithmetic + refs + 10 functions. No string functions, no dates, no ranges. Cut `EXTRAPOLATE` first if needed |
| Scope creep into the 23 non-Pilot use cases | The six bonus items are named in §1.5 and fixed. Anything else is a proposal roadmap line, not code |
| Tailwind v4 + shadcn friction | Decided in Phase 0 hour one; fallback pinned to Tailwind 3.4 |
| Demo data looks synthetic | Real ISO codes, real WHO regions, real SHA 2011 codes, real formula set, plausible magnitudes. Curate the 5–6 countries used on stage by hand |
| `localStorage` quota at 250k observations | Persist only *user edits* as a diff over the seeded data; regenerate the seed from the PRNG on load. Also keeps "Reset demo data" instant |
| Panel asks "is this the real system?" | The Dev drawer and the mock-vs-real table in the README make the boundary explicit and honest. Claiming more than we built is the one thing that loses a WHO bid |

## 8. Coverage summary

| | Count |
|---|---|
| Pilot use cases (Y) in the RFP | 41 |
| Pilot use cases covered by this prototype | **41** |
| Non-Pilot (N) use cases covered as bonus | 6 — UC008, 010, 011, 032, 033, 040 (+ partial 003.1, 018, 020, 021, 034, 037, 038, 041, 049, 051, 058) |
| Annex 3 mandatory API requirements demonstrated | 10 of 10, on one screen |
| Estimated effort | ≈19 developer-days |
