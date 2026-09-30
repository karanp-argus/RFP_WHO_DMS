# Health Accounts in plain English — a primer for presenting the DMS prototype

**Who this is for:** someone presenting the prototype to WHO who is new to health accounts.
It explains the vocabulary the client uses every day, gives an example from the RFP or from the
prototype for each term, and ends with the questions the panel is likely to ask.

**Where the examples come from:** the Functional Requirements (`Requirements/2. Functional
Requirements PFD-2026-001.docx`, cited as **FR**), our clarification responses
([CLARIFICATION_RESPONSES.md](CLARIFICATION_RESPONSES.md)), and the prototype's seed data
(`dms-prototype/src/data/seed/`). Prototype URLs assume `npm run serve:dist` on port 4173.

---

## 0. The big picture in one minute

Every country spends money on health. WHO's Health Accounts (HA) team collects, for **194
countries and every year since 2000**, *how much* was spent, *who paid*, *what it was spent on*
and *who provided it*. They check it, compute standard indicators (for example "health spending
as a % of GDP"), and publish it in the **Global Health Expenditure Database (GHED)** and the
**Global Health Observatory (GHO)**.

The accounting standard behind all this is **SHA 2011 — the System of Health Accounts**
(OECD / Eurostat / WHO). Think of it as the "chart of accounts" for national health spending.
Just as a company's books split spending by cost centre and by expense type, SHA 2011 splits a
country's health spending along several standard axes.

The pipeline, simplified from FR §3:

```
Countries send files ──► xMart (WHO's data warehouse: stores, validates, versions)
                             ▲        │
                             │ API    ▼
                         NEW DMS  ◄── this project: check, calculate, edit, estimate, report
                             │
                             └──► back to xMart ──► GHED / GHO (public)
```

**The DMS owns no master data.** xMart is the warehouse; the DMS is the analyst's workbench on top
of it. That one sentence answers a lot of architecture questions.

**How the six terms relate** (one picture to keep in your head):

```
CLASSIFICATIONS (the SHA 2011 axes: HF, FS, HC, HP ...)
   └─ each contains CATEGORIES / codes (HF.1, HF.1.1, HC.1 ...)  ──┐
                                                                    ├─► VARIABLES
FORMULAS compute INDICATORS from them (CHE, CHE%GDP ...)  ─────────┤
CROSSES combine two or more classifications (HC.1 x HF.1) ─────────┘
                                                                        │
An OBSERVATION = 1 country × 1 year × 1 variable  →  VALUE + METADATA ◄─┘
ATTRIBUTES describe the countries and variables themselves (region, income group, labels)
A WORKBOOK is the Excel-like screen that shows and edits observations
```

---

## 1. Classifications

### In simple terms

A **classification** is a standard way of sorting health spending along one axis, with a code
for every category. Each classification is a **tree**: broad categories at the top, detail
underneath. The codes are international, so `HF.3` means the same thing in Canada and in Kenya.

Analogy: a library's subject catalogue. "Science → Biology → Genetics" is a tree, and every book
sits on exactly one leaf. A euro of health spending sits on one leaf of each classification.

### The main ones (SHA 2011, FR §1 and Annex 2)

| Code | Name | The question it answers | Example category |
|---|---|---|---|
| **HF** | Financing schemes | *Through which arrangement* was care paid for? | `HF.3` Household out-of-pocket payment |
| **FS** | Revenues of financing schemes | *Where did the money come from* originally? | `FS.1` Transfers from government domestic revenue |
| **HC** | Health care functions | *What was bought*? | `HC.1` Curative care, `HC.6` Preventive care |
| **HP** | Health care providers | *Who delivered* it? | `HP.1` Hospitals, `HP.5` Retailers (pharmacies) |
| **FP** | Factors of provision | *What inputs* did providers use? | Salaries, medicines, equipment |
| **HK** | Capital formation | Investment (buildings, machines), kept separate from current spending | |
| **DIS**, **AGE**, **GEN** | Disease, age group, gender | *For whom / for what condition*? | `DIS.1.3` Malaria |
| **MACRO** | Macroeconomic series (not SHA; from World Bank / IMF / UN) | The denominators | `GDP`, `POP` (population), `EXR` (exchange rate) |

There are also "reporting item" classifications (`FS_RI`, `HC_RI`, `HKR`, `HCR`). Treat them as
memo lines, not a core axis.

### Example: the HF tree, verbatim from FR §1

```
HF.1      Government schemes and compulsory contributory health care financing schemes
  HF.1.1    Government schemes
  HF.1.2    Compulsory contributory health insurance schemes
    HF.1.2.1  Social health insurance schemes
    HF.1.2.2  Compulsory private insurance schemes
  HF.1.3    Compulsory Medical Savings Accounts
HF.2      Voluntary health care payment schemes
  HF.2.1 / HF.2.2 / HF.2.3   Voluntary insurance / NPISH / Enterprise
HF.3      Household out-of-pocket payment
  HF.3.1 / HF.3.2   OOP excluding cost-sharing / Cost-sharing with third-party payers
HF.4      Rest of the world financing schemes
HF.nec    Unspecified (n.e.c. = "not elsewhere classified")
```

Two ideas worth knowing:

- **Leaves vs parents.** Countries report the *leaves* (e.g. `HF.1.1`). A parent (`HF.1`) is the sum
  of its children. In the prototype, parents are **calculated, not stored**, and they show as
  pink rows.
- **`.nec` buckets** hold money the country could not assign to a category. A large `.nec`
  suggests poor data quality, which is why the prototype keeps them small and a QC rule can flag them.

### Where to see it in the prototype

`/setup?tab=classifications`: every classification and its tree.

### Terms you will hear alongside it

- **Category**: one code within a classification (`HF.1.1`). The RFP often says "classifications
  and categories" together.
- **ICHA**: *International Classification for Health Accounts*, the formal name of the HF/FS/HC/HP/FP
  families. `ICHA-HF` is the same thing as `HF`.

---

## 2. Formula

### In simple terms

A **formula** calculates an **indicator** (a number countries never report directly) from
other variables. Health spending as a percentage of GDP is the classic one: countries report
spending by scheme and GDP comes from the World Bank, and the DMS divides one by the other.

The DMS is not Excel in one important way. A DMS formula refers to **variable codes**, not to
cell addresses like `B7`. The same formula therefore works for every country and every year.

### Examples from the RFP (HLR8: all 16 are seeded in the prototype)

| Code | Formula | Condition ("null guard") | Plain meaning |
|---|---|---|---|
| `CHE` | `HF.1 + HF.2 + HF.3 + HF.4 + HF.nec` | at least one part not null | **Current Health Expenditure**, total health spending |
| `CHE%GDP_SHA2011` | `CHE / GDP * 100` | CHE and GDP not null | Health spending as % of the economy |
| `CHE_pc_US$_SHA2011` | `CHE / Population / Ex.rate` | all not null | Health spending per person in US dollars |
| `OOPS%CHE_SHA2011` | `HF.3 / CHE * 100` | both not null | Share paid **out of pocket** by households |
| `EXT%CHE_SHA2011` | `EXT / CHE * 100` | both not null | Share financed from abroad (donors) |

### Three things the client cares about, and the prototype shows

1. **Formulas depend on other formulas.** `CHE%GDP` needs `CHE`, `CHE` needs `HF.1`–`HF.nec`, and `HF.1`
   is the sum of its children. The engine builds a **dependency graph**, calculates in the right
   order, and **refuses a circular formula** (A uses B, B uses A).
   *See:* `/setup?tab=formulas` → **Inspect** on `CHE%GDP_SHA2011`.
2. **Blank is not zero.** Each formula has a *condition*. If GDP is missing, `CHE%GDP` is
   **blank**, not `0`. A zero would publish as "this country spends nothing on health". The
   blank is carried into the Excel export.
3. **Country overrides.** Under UC029 an admin can change a formula for *one* country only. The
   prototype's example is Argentina, whose CHE excludes `HF.nec`
   (`HF.1 + HF.2 + HF.3 + HF.4`). Every other country keeps the standard formula.

**Predefined vs custom:** *predefined* formulas (UC029) are written by admins and apply to
everyone. *Custom* formulas (UC030) are written by a regular user for one country, one workbook
or one observation.
**Old DMS formulas** (UC060) are migrated as read-only text in a metadata field, so analysts can
still see how the legacy system calculated things.

### Health-finance acronyms that appear in the formulas

| Acronym | Meaning |
|---|---|
| **CHE** | Current Health Expenditure. The headline total, excluding capital investment |
| **GGHE-D** | Domestic General Government Health Expenditure: what the government pays from its own revenue (`FS.1 + FS.3`) |
| **PVT-D** | Domestic private health expenditure (`FS.4 + FS.5 + FS.6 + FS.nec`) |
| **EXT** | External health expenditure: donor money (`FS.2 + FS.7`) |
| **OOPS / OOP** | Out-of-pocket spending: what patients pay directly at the point of care |
| **VPP** | Voluntary prepayment (mostly private insurance premiums) |
| **GDP / GGE** | Gross Domestic Product / General Government Expenditure |
| **NCU** | National Currency Units (pesos, yen, …). Raw values are "NCU millions" |
| **pc US$** | Per capita, converted to US dollars |

**Sanity check an economist will do:** `GGHE-D%CHE + PVT-D%CHE + EXT%CHE ≈ 100%`. Every dollar
comes from government, private or external sources. The prototype's data is built so this holds.

---

## 3. Metadata

### In simple terms

**Metadata is the information about a number**: where it came from, how it was produced and
what to watch out for. The value is `72,500`. The metadata says "Source: Ministry of Health
annual report. Method: estimated by WHO. Comment: excludes capital."

In health accounts, the metadata matters as much as the number. A published figure that no one
can trace back to a source cannot be defended.

### The observation metadata fields (UC027, from the FR's xMart screenshots)

| Field | Type | Example |
|---|---|---|
| `SOURCES` | Free text | "National Health Accounts report 2023" |
| `COMMENT` | Free text | "Excluding capital" (a real comment on Argentina's rows in the FR screenshots) |
| `WEB_LINK` | Free text | Link to the source document |
| `EST_METHOD` | List of values | "Reported by country", "Derived as Estimated", "Interpolated", "Extrapolated" |
| `DATA_TYPE` | List of values | "Reported", "Estimated", "Partially Derived", "Provisional" |
| `OLD_DMS_FORMULA` | Free text, separate area | The legacy formula, kept for reference (UC060) |

The FR allows three field **types**: free text, date, and list of values (a dropdown).

### Key points

- **An observation can have metadata and no value.** The FR says so explicitly. "Country says
  this category does not exist in its system" is a valid record with `VALUE` empty.
- **Estimates stamp their own metadata.** When the prototype fills a gap by interpolation, it
  writes `EST_METHOD = Interpolated`, so no one mistakes an estimate for a country submission.
- **Metadata vs attributes.** Metadata describes one *observation* (Canada, 2021, HF.1.1). Attributes
  describe a *country* or a *variable* and stay the same across years (next section and §8).
- **MET files (UC028)** are separate Excel metadata files that xMart keeps in SharePoint. The DMS
  links out to them. The prototype shows the link, but the file store is not connected.

### Where to see it in the prototype

In any workbook, look for a cell with a **small blue triangle** in its corner and click it. A
drawer opens **beside** the grid, and your cell and scroll position stay where they were. This fixes
the legacy tool, where metadata sat on a separate sheet tab ("SHA 2011 Metadata – EN").
Field definitions are at `/setup?tab=metadata`.

---

## 4. Crosses

### In simple terms

A single classification answers one question, such as "who paid?" (HF). A **cross** answers two
or more at once: "who paid, **for what**?" It is a cell in a two-way table.

**The FR's own example:** `HF.1xFS.1` = *"Compulsory and government schemes financed through
internal transfers"*. It is the part of government-scheme spending (`HF.1`) that was funded
from the government's own domestic revenue (`FS.1`).

Analogy: a sales report can be broken down by region or by product. "Sales of product X in
region Y" is a cross.

### What a cross table looks like (HC × HF)

|  | HF.1 Government | HF.2 Voluntary | HF.3 Out-of-pocket | Total |
|---|---|---|---|---|
| **HC.1 Curative care** | `HC.1xHF.1` | `HC.1xHF.2` | `HC.1xHF.3` | HC.1 |
| **HC.5 Medical goods** | `HC.5xHF.1` | … | `HC.5xHF.3` | HC.5 |
| **Total** | HF.1 | HF.2 | HF.3 | CHE |

The row and column totals must match the one-dimensional figures. The total of the HF.1 column
must equal `HF.1` itself. This check matters a lot to the client (see below).

### Real numbers from the RFP (Annex 3 = Canada 2023)

- Canada 2023 alone has **3,361 cross observations** across six cross tables (HC×HP, HC×HF, HF×HP,
  FS×HF, HK×HP, FP×HP).
- `HF.1` (government and compulsory schemes) is **230,759.53** in the HC×HF table, **230,759.53** in
  HP×HF and **230,759.53** in FS×HF. The same total appears in three tables and must agree.
  A mismatch is exactly the kind of error a quality check should catch.
- Crosses can combine **more than two** classifications. The UC031 example contains
  `HF1 × FS1 × HC1 × HP1 × FP1 = 72,500`.
- Crosses make up most of the data volume. About 3,400 per country-year × 194 countries × 25 years
  ≈ **16 million rows**, which is most of UC057's "up to 25 million".

### How the prototype models it (a likely technical question)

**A cross is not a separate kind of record.** In xMart's long format, each classification has its
own column. A plain `HF.1` observation fills only the `HF` column. `HC.1 × HF.1` fills both the `HC`
and `HF` columns. So a cross is an ordinary observation with more than one column filled. This
matches xMart exactly, and no conversion is needed.

### Predefined vs custom

- **Predefined crosses** (UC025) are created by admins and visible to everyone. Example:
  `HC.1xHF.3`, "Curative care financed out-of-pocket".
- **Custom crosses** (UC026) are created by a regular user for specific countries only. Example
  from the seed: `DIS.4.3xAGE.5`, "Cardiovascular disease expenditure, 70 years and over", for
  Japan and Italy.

*See:* `/setup?tab=crosses`. The builder writes the code (e.g. `HC.1xHF.1`) as you pick
dimensions.

**Be ready for this:** the UC025 text also describes a cross as a "2-dimensional data view" (one
country × years × variables, and so on), which sounds like a workbook. Our reading, set out in
the clarification responses, is that the FR §1 definition (classifications crossed together) is
the data concept. A cross can then be *viewed* in a workbook row, a cross table or a report.
If the panel reads it differently, say that the model supports both readings, because a cross is
simply a variable.

**Not yet built in the prototype:** the full cross-*table* screen (one classification down the
side, another across the top) and the shared-total checks between tables. Both are in the
proposed design. The prototype has individual crosses, not complete cross tables. Say this
plainly if asked.

---

## 5. Attributes

### In simple terms

**Attributes are the descriptive properties of a country or a variable**: things that are true of
the country or the code itself, not of one year's number.

FR §1: *"metadata fields associated with countries or variables (country attributes, such as
income group, region, focal point, OECD Member, etc., and variable attributes, such as label of
category in different languages, currency measured yes or no, etc.); there is no attribute for
the time dimension (Year)."*

Analogy: in a customer database, the customer's country and segment are attributes. Each
order's amount is the data.

### Examples from the prototype (`src/data/seed/countries.ts`)

| Attribute | Example (Canada) | Groupable? |
|---|---|---|
| `CODE_ISO_3` | `CAN` | No, it is the key |
| `GRP_WHO_REGION` | `AMR` (Region of the Americas) | **Yes** |
| `GRP_WB_INCOME` | `HIC` (World Bank high-income) | **Yes** |
| `GRP_OECD` | true | **Yes** |
| `CURRENCY_ISO_3` | `CAD` | Yes |
| `FOCAL_POINT_NAME` / `_EMAIL` | The country's data contact | No |

**Variable attributes:** the label in each of the six WHO languages, and whether the variable is
measured in currency. `HF.1` is money and gets converted between currencies. `CHE%GDP` is a
percentage and does not.

### Why attributes matter: groups (UC022)

An attribute can be flagged **groupable**. The `GRP_` prefix in xMart's field names is exactly this.
Groupable attributes become one-click selections everywhere: "all countries in the African
Region" or "all OECD members", in workbooks, reports and quality checks. QC outlier rules also
use them to compare a country with its **peer group** (the same income group or region).

**Admin can add new attributes** (UC018) with a type of free text, dropdown or date. A new groupable
attribute becomes a new way to group, with no code change.

*See:* `/setup?tab=countries` → **Attributes**, then open any country picker in a workbook and
look at the "WHO region / World Bank income group" headings.

### Attributes vs metadata: the question someone will ask

| | Attributes | Metadata |
|---|---|---|
| Describes | A country or a variable | One observation (country × year × variable) |
| Changes by year? | No (no attribute on Year) | Yes, per data point |
| Example | Canada is high-income | Canada's 2021 `HF.1.1` was estimated by WHO |
| Managed in | Setup → Countries / Classifications | The workbook cell → metadata drawer |

---

## 6. Workbook

### In simple terms

The **workbook** is the Excel-like screen where analysts spend their day. It is the core of the
product (HLR8, UC031). You pick countries, variables and years, and the grid shows one
observation per cell. You can view, edit, paste, apply formulas, read metadata and fill gaps.

### The rule: exactly one axis is fixed (UC031)

| Workbook type | Fixed | Rows | Columns | Typical use |
|---|---|---|---|---|
| **Country workbook** | 1 country | Variables | Years | "Show me all of Canada's financing, 2000–2024" (most common) |
| **Variable workbook** | 1 variable | Countries | Years | "Compare out-of-pocket spending across Africa" |
| **Year workbook** | 1 year | Variables | Countries | "Review everything submitted for 2023" |

*Demo URL (country workbook):*
`/workbooks/view?c=CAN&v=HF.1,HF.1.1,HF.1.2,HF.3,HF.3.1&y=2000-2024&type=country`

### What it does, in client language

- **Blue rows** are values the country reported. **Pink rows** are values the system calculated.
  These colours come from the legacy tool, and we kept them on purpose.
- **Type a value and dependants recalculate.** Edit `HF.1.1` and `HF.1` (its parent) updates at
  once, and so does `CHE%GDP` if it is in view.
- **Copy/paste in three modes**: values, formulas, or values with their metadata. Paste works across
  workbooks too, for example copying Canada's method onto Argentina "as formulas".
- **Undo/redo** like Excel. A 25-cell paste is undone in one step.
- **Fill gaps and extrapolate**: interpolate a missing year, or extend a series backwards or
  forwards. The estimate is stamped in its metadata.
- **Publishing status** (UC024): each observation is either *Not publish* or *Ready to publish*,
  set one at a time or in bulk. It shows as a green corner marker.
- **Run quality checks** from the workbook (UC052). Problem cells get red (error) or amber
  (warning) rings.
- **Version history** (right-click a cell, UC043/044): up to 10 previous versions, which can be
  compared and restored.
- **Locking** (UC033): if a second user opens the same workbook, they get a warning. The prototype
  simulates the second user and says so on screen.

### What we kept from the legacy tool, and what we replaced

This is the most important talking point in the demo (DEMO_SCRIPT 3:00).

| Kept (the team's muscle memory) | Replaced (what slowed them down) |
|---|---|
| Years across, variables down | Permanent filter dropdowns became **filter chips**, which can be shared as a link |
| "Millions (Default)" scale selector | Headers that scrolled away are now **frozen** headers |
| Blue = reported, pink = calculated | Paged tables are now **continuous scroll** (paging breaks copy/paste) |
| | Metadata on a separate tab is now an **inline drawer** beside the grid |

---

## 7. Other terms worth knowing

### Observation (the atom of everything)

**1 country × 1 year × 1 variable (or cross) → a value, plus optional metadata.**
Example: *Canada, 2023, HF.1 = 230,759.53 (from the RFP's Annex 3), with its source and comment as metadata.*
It is valid with no value as long as it has metadata (FR §1).

### Variable vs indicator

- A **variable** is anything measured for an observation: `HF.1`, `FS.1`, `GDP`, or `CHE%GDP`.
- An **indicator** is a variable that is **calculated**, never reported by a country (`CHE`, `CHE%GDP`).
  All indicators are variables. Not all variables are indicators.

### Long format and `SURVEY_FK`

xMart stores data in **long format**: one row per observation, one column per classification. Most
classification columns are empty on any given row. The row key is `SURVEY_FK = ISO3-YEAR`, e.g.
`ARG-2021`. The column list is fixed by the FR (`SURVEY_FK, AGE, DIS, FP, FS, … HF, … VALUE,
SOURCES, COMMENT, …, Sys_*`). The `Sys_*` columns are xMart's own versioning stamps (who loaded
the row, when, and in which batch).

### Where the data comes from (country submission formats)

| Format | Who sends it |
|---|---|
| **JHAQ** (Joint Health Accounts Questionnaire) | EU countries via **eDamis**; other OECD countries via shared folders |
| **HAQ / Mini** | Other countries, by email |
| **HAPT** (Health Accounts Production Tool) | The tool countries use to build their accounts. It produces the cross tables. The new HAPT will feed xMart by API |
| WB / IMF / UN files | Prepared by the HA team for GDP, population, exchange rates |

### Quality checks (QC)

Automated rules that flag suspicious data before publication (UC047–055). UC053 lists the
categories. Plain examples:

- **Year-on-year growth.** Spending jumped 300% in one year.
- **Inconsistency between categories.** Children do not add up to their parent.
- **Inconsistency between tables.** HF total ≠ FS total.
- **Missing or disappeared observations.** Reported last year, missing this year.
- **Outliers vs peers.** Far from the median of the same income group.

Thresholds are admin-configurable (UC054). Rules can be switched off for a named country and
year (UC048).

### Publishing status

A per-observation flag, *Not publish* or *Ready to publish* (UC024), which controls what goes to
GHED/GHO.

### Versioning

xMart keeps each change. The DMS shows **up to 10 versions** per observation and can compare
and restore them, or restore a whole dataset "as it stood on date X" (UC043/044).

### Roles

Only two: **Administrator** and **Regular user** (UC007). Users are **never deleted**, only
disabled (UC012), so the audit trail always resolves to a real person.

---

## 8. Questions the client may ask, and answers you can give

### Domain questions

| Question | Answer |
|---|---|
| *"How do you treat a missing value vs a zero?"* | "They are different, and the engine keeps them different. Every formula has a null condition; if it fails the result is blank, not zero, and the Excel export keeps the blank. An observation can also hold metadata with no value, as FR §1 allows." |
| *"Can a formula be different for one country?"* | "Yes, that is UC029. Argentina's CHE excludes the unspecified bucket in the prototype, and no other country is affected. Setup → Formulas → CHE → overrides." |
| *"What happens if someone writes a circular formula?"* | "It is refused, and the message shows the loop. The engine builds a dependency graph and calculates in order. It does not substitute text." |
| *"How do you handle crosses of more than two classifications?"* | "A cross is an observation with several classification columns filled, exactly as in the long format, so there is no limit on how many. The UC031 example crosses five." |
| *"Will the totals across cross tables be checked?"* | "Yes, it is designed as an 'inconsistency between tables' rule. In your Annex 3, HF.1 is 230,759.53 in three tables and must agree. The prototype checks HF vs FS totals today. The full cross-table checks are in the delivered scope." |
| *"How do you tell an estimate from reported data?"* | "Blue vs pink rows for reported vs calculated, and every gap-fill or extrapolation writes its method into `EST_METHOD`, so the provenance is on the cell." |
| *"Can we group countries by our own categories?"* | "Yes. Add an attribute and flag it groupable. It then shows up in every country picker with no code change (UC018 + UC022)." |
| *"Reports in other languages?"* | "All six WHO languages for report labels (UC041). Arabic is labels only; the right-to-left layout is scoped in the proposal, and the screen says so." |
| *"Are the numbers real?"* | "The structure is real: 194 member states, real ISO codes, regions, income groups, SHA 2011 codes, and the 16 formulas verbatim. The values are synthetic but realistic (government share rises with income, out-of-pocket falls), and the financing split adds to about 100%." |

### Architecture questions

| Question | Answer |
|---|---|
| *"Where is the data stored?"* | "In xMart. The DMS owns no master data. It reads through one API client and writes back through it. In the prototype, that client is mocked, and one file changes when xMart is real." |
| *"25 million rows?"* | "That is the volume retrieved from xMart, mostly crosses (≈16 M). It is an API concern: filtered, paged and incremental by `LastModified`. A workbook is a bounded window of a few thousand cells." |
| *"Is this the real system?"* | "No. It is the Pilot scope as a front end against a mocked xMart, so you can click every use case. The developer drawer shows every call it would make." |

### If you do not know the answer

Say *"Good question. Let me confirm against the requirement and come back to you,"* and note it.
In health accounts, a confident wrong answer about a definition does more damage than a
follow-up.

---

## 9. One-page cheat sheet

| Term | One line | Example |
|---|---|---|
| **Classification** | A standard tree for sorting health spending along one axis | HF = who paid; `HF.3` = out-of-pocket |
| **Formula** | Calculates an indicator from variable codes, with a null condition | `CHE%GDP = CHE / GDP * 100`, blank if GDP is missing |
| **Metadata** | Information about one number: source, method, comment | `EST_METHOD = Interpolated` |
| **Cross** | Two or more classifications combined in one observation | `HF.1xFS.1` = government schemes funded by domestic revenue |
| **Attribute** | A property of a country or variable, not tied to a year | Canada → `GRP_WB_INCOME = HIC` |
| **Workbook** | The Excel-like editing screen; exactly one of country / variable / year is fixed | Canada × HF codes × 2000–2024 |
| **Observation** | 1 country × 1 year × 1 variable → value + metadata | `CAN-2023`, HF.1 = 230,759.53 |
| **Indicator** | A calculated variable, never reported | CHE, OOPS%CHE |
| **SHA 2011** | The international accounting standard behind it all | OECD / Eurostat / WHO |
| **xMart** | WHO's data warehouse; the DMS reads and writes through it | Long format, `Sys_*` versioning |
