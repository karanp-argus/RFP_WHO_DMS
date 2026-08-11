# Proposed Solution

> **Draft for review — Step 2 of the agreed sequence.**
> This text is written to be inserted under the existing empty *Proposed Solution* Heading 2 in
> `Technical Proposal_Argusoft India Ltd_WHO_Data_Management_System.docx`, between *Methodology*
> and *Proposed Work Plan*.
>
> Heading levels map as: `##` → Heading 2 (the section itself), `###` → Heading 3,
> `####` → Heading 4. Figure and screenshot callouts are marked `[FIGURE n]` and
> `[SCREENSHOT n]` and are produced in Steps 3 and 4.

---

## Solution Overview

In response to the Terms of Reference and the Functional Requirements, Argusoft proposes a
centralized, web-based **Health Accounts Data Management System (DMS)** built upon WHO's existing
xMart data warehouse. The solution replaces the legacy standalone application with a modern,
configurable, multi-user platform that supports the complete lifecycle of National Health Accounts
data — collection, consolidation, validation, calculation, quality assurance, versioning, reporting
and publication — for more than 194 countries with time series extending back to 2000.

The proposed solution is designed around a principle stated in the Functional Requirements
themselves: **xMart remains the main data warehouse for Health Accounts data, and DMS provides the
business functionality and user experience on top of it.** DMS retrieves observations, metadata,
formulas, configuration and version information from xMart through its secured API whenever data is
required for display or processing, and returns processed results, user edits and configuration
changes to xMart for storage. In line with HLR11, DMS additionally maintains its **own local
database** for operational data that belongs to the application rather than to the Health Accounts
warehouse — user accounts and permissions, quality check and report definitions, saved user
preferences, background job state, notifications, edit locks and application audit logs. This
separation keeps a single authoritative source for Health Accounts data while giving the DMS the
transactional store it needs to perform responsively and to support the collaborative, multi-user
working model that the legacy system cannot.

The solution is organized into nine functional modules accessible from a single application home
site, each mapped directly to the high-level requirements and use cases of the Functional
Requirements document:

| # | Module | Primary requirements |
|---|---|---|
| 1 | Application Home & Dashboard | HLR2, HLR3 · UC001–UC003.1 |
| 2 | User & Role Management | HLR4, HLR5, HLR6 · UC004–UC012 |
| 3 | Setup & Configuration | HLR7 · UC013–UC030 |
| 4 | Workbook Management | HLR8, HLR9 · UC031–UC034 |
| 5 | Formula Management & Calculation Engine | HLR8 · UC029, UC030, UC060 |
| 6 | Reports & Analytics | HLR10, HLR21 · UC035–UC042 |
| 7 | Quality Checks | HLR15 · UC047–UC055 |
| 8 | Data & Metadata Versioning | HLR12 · UC043, UC044 |
| 9 | Notifications | HLR18 · UC023, UC042, UC058, UC059 |

Underpinning these modules are the integration services that connect DMS to xMart (HLR13, HLR14,
HLR16 · UC045, UC046, UC056), the data retrieval API defined in Annex 3 of the RFP, and the
one-off migration of legacy formulas described in HLR19 and UC060.

The solution will be delivered through the phased approach required by HLR20 and UC061: a Pilot
covering the 41 use cases flagged for Pilot priority, followed by the incremental delivery of the
remaining functionality according to the agreed priority order.

### Working prototype

To validate our understanding of the requirements before development begins — and to give the WHO
Health Accounts team something concrete to react to rather than a written description alone —
Argusoft has already developed a **working, interactive prototype of the proposed DMS**, available
for evaluation at:

> **https://whohadms.argusservices.in/**

The prototype implements the application shell, the Setup module, the Workbook with its
calculation engine, Quality Checks, Reports, versioning, the dashboard and the Annex 3 data
retrieval interface, working against a representative Health Accounts dataset. The screenshots
throughout this section are taken from it. It demonstrates the interaction model, information
architecture and visual design we propose, and it evidences that the more demanding requirements in
this RFP — the Excel-like workbook, the formula dependency engine, configurable quality checks and
multi-dimensional reporting — have been thought through in practice rather than in principle.

**The prototype represents Argusoft's proposed solution based on our current understanding of the
Terms of Reference, the Functional Requirements, the API specifications and the clarifications
issued. It is a design and validation instrument, not the delivered product, and the screens shown
in this section are not the final design.** During the requirements finalization and design phases,
Argusoft will conduct detailed workshops with the WHO Health Accounts team, study the existing DMS
and its working practices, and establish a precise understanding of the expected outcomes. The
prototype will then be updated to reflect that input, and the resulting design will be submitted for
WHO's review and approval before development begins, as set out in Phase 2 of the Work Plan.

We have chosen to invest in a working prototype ahead of the bid precisely so that this conversation
starts from something WHO can use and challenge, rather than from a written description. Every
element of it — the navigation, the workbook layout, the report builder, the dashboard content — is a
proposal open to revision, and we expect it to change as a result of stakeholder input.

---

## Functional Landscape

The diagram below presents the functional landscape of the proposed Health Accounts Data
Management System: the user communities it serves, the nine functional modules, the shared
platform services on which those modules rely, and the external systems with which the DMS
exchanges data.

> **[FIGURE 1 — Functional landscape / module map]**

Users reach every module from a single application home site following authentication through WHO
Entra ID. Regular users and Administrator users see the same navigation, with capabilities filtered
according to the permissions attached to their role. The modules share a common set of platform
services — authentication and authorization, the calculation engine, the notification service, the
job scheduler, audit logging and the xMart integration layer — so that behaviour such as permission
enforcement, versioning and event notification is implemented once and applied consistently
everywhere.

---

## Solution Architecture

Argusoft proposes an **n-tier, service-oriented architecture** with a clear separation between the
presentation, business logic and data access layers. This is the same architectural pattern we have
applied successfully across WHO and government enterprise platforms, and it is chosen here for four
specific reasons relevant to this assignment:

- **Independent evolution of the user experience and the business rules.** The Health Accounts
  domain is stable but the working practices around it are not; separating the layers allows the
  workbook or reporting experience to be refined without disturbing the calculation or validation
  logic beneath it.
- **A single, controlled boundary to xMart.** All communication with xMart is concentrated in one
  integration layer rather than distributed across the application, so that a change to an xMart API
  contract, authentication method or data model is absorbed in one place.
- **Independent scalability.** The API tier can be scaled to absorb the year-end peak, when full
  quality check processing runs across all countries, without over-provisioning the rest of the
  system.
- **Testability and long-term maintainability.** Business rules expressed in a distinct layer can be
  unit-tested against known expected results — which matters greatly for a system whose credibility
  rests on the correctness of its calculated indicators.

> **[FIGURE 2 — Solution architecture diagram]**

### Presentation Layer

The presentation layer is a responsive, browser-based single-page application delivering the
complete DMS user experience: the home dashboard, the nine functional modules, the workbook grid,
the report builder and the administration screens. It communicates with the server exclusively
through the API layer, holds no business rules of its own, and enforces no security decision that
is not also enforced on the server.

Two characteristics of the Health Accounts working model shape this layer in particular.

First, **the Workbook is the primary working surface and must behave like a spreadsheet.** Health
Accounts analysts have used a spreadsheet-like tool for years, and the requirement in HLR8 for
Excel-like viewing, editing, formula insertion, copy, paste and undo is a requirement about muscle
memory as much as about function. The presentation layer therefore uses a virtualized data grid
capable of range selection, keyboard navigation, multi-cell copy and paste, and an undo stack, with
frozen header rows and columns so that the year and variable context never scrolls out of view. The
grid renders only the cells within the viewport, which keeps interaction responsive on large
country time series.

Second, **the interface must degrade gracefully across the volumes described in UC057.** Data
requests are paged and filtered on the server; the browser is never asked to hold a result set that
approaches the stated maximum. Long-running operations — full quality check runs, complex report
generation, bulk exports — are dispatched to background processing and reported back through
notifications rather than blocking the interface.

The interface will be delivered in English, in accordance with HLR21, with report output available
in all six official WHO languages as described in §7.4.

### API and Business Logic Layer

The API layer exposes the application's functionality as a set of secured, versioned service
endpoints consumed by the presentation layer and, where appropriate, by other WHO systems. It also
hosts the business logic of the DMS — the rules that make the system a Health Accounts tool rather
than a generic data editor:

- **Authorization and data scoping.** Every request is authorized against the caller's role and, for
  regular users whose access is restricted to specific countries (UC009), against their country
  scope. Authorization is applied at the service boundary so that it cannot be bypassed.
- **The calculation engine.** Parsing, dependency resolution and evaluation of predefined and custom
  formulas, including the null-handling conditions attached to each formula. This is described in
  detail in §5.5.
- **The quality check engine.** Evaluation of predefined and custom rules against a selected country
  or group of countries, producing the pass, fail, warning and error outcomes defined in UC054.
- **Versioning and change capture.** Recording the authorship and time of every change and assembling
  the version histories that UC043 and UC044 expose for comparison and restoration.
- **Orchestration of xMart exchange.** Deciding what must be retrieved, what must be written back and
  when, and reconciling the results.
- **Background job management.** Queueing, executing, monitoring and reporting on long-running
  operations, with restart and retry behaviour.

Services are designed to be stateless so that the tier can be scaled horizontally, with shared state
held in the database or cache rather than in server memory.

### Data Access and Integration Layer

The data access layer abstracts every underlying store behind a consistent internal interface, so
that the business logic above it is not written against a particular database technology or a
particular version of the xMart API. It comprises three elements:

- **The xMart integration client**, which handles authentication, request construction, paging,
  filtering, retry and error handling for all traffic to and from xMart, and which maps between the
  xMart long-format observation structure and the DMS domain model.
- **The DMS local database access components**, providing persistence for the operational data
  described below.
- **The caching layer**, which holds frequently used and slowly changing reference data — country and
  currency lists, classifications and categories, crosses, metadata field definitions and formula
  definitions — so that routine screens do not generate repeated calls to xMart for data that has not
  changed. Cache invalidation is driven by configuration changes made in the Setup module and by the
  synchronization process, and cache lifetimes will be agreed with WHO during design.

Using an abstraction at this layer also protects the investment: should WHO later extend the xMart
platform, change an ingestion mechanism or introduce an additional source, the change is confined to
this layer.

### The DMS Local Database and the xMart Boundary

HLR11 establishes both halves of the storage model, and the division between them is one of the more
consequential design decisions in this solution. Argusoft proposes the following boundary, to be
confirmed and refined with WHO during the design phase.

**Held in xMart — the authoritative Health Accounts record:**

- All observations: values, the dimension tuple that identifies them, and their metadata fields
  (sources, comments, web links, estimation method, data type).
- Configuration and reference data: countries and their attributes, currencies, classifications and
  categories, crosses, metadata field definitions and formula definitions.
- The version history of observations, datasets and metadata, on which UC043 and UC044 build.
- The legacy formulas imported from the old DMS as plain-text metadata under UC060.

**Held in the DMS local database — operational data belonging to the application:**

- User accounts, role assignments, role permission configuration and country restrictions.
- Quality check rule definitions, their configuration values, country exclusions and run history.
- Report definitions, layouts, user favourites and the user-customized report list.
- Saved user preferences: workbook selections, column ordering, metadata field display order.
- Edit locks supporting the concurrency control required by HLR9 and UC033.
- The background job queue, job status and generated output artefacts.
- Notification definitions, subscriptions and the user inbox.
- The application audit log, and the cached reference data described above.

Two properties follow from this design and are worth stating explicitly. First, **no Health Accounts
value is authoritative anywhere except xMart** — the local database never becomes a competing copy
of the warehouse, which is what makes the GHED and GHO publication chain downstream of xMart safe.
Second, **the DMS remains responsive and usable for configuration and administration work
independently of xMart call latency**, because the data those screens operate on is local.

Where WHO's review concludes that a particular category of operational data is better held in xMart
— for example, if quality check rule definitions are to be shared with other xMart consumers — the
boundary can be moved without architectural change, because both stores are reached through the same
data access abstraction.

### Cross-Cutting Services

The following services are implemented once and consumed by every module:

- **Authentication and single sign-on** through WHO Entra ID, covering both WHO internal users and
  external users managed as Entra ID guest accounts, as required by HLR4 and HLR5.
- **Authorization**, enforcing the two roles defined in HLR6, the configurable role permissions of
  UC008 and the country restrictions of UC009.
- **Audit logging**, capturing user identity, timestamp and action for every data modification,
  configuration change, permission change, quality check run, report generation and integration
  event.
- **Notification services**, delivering the in-app, event-driven notifications required by HLR18.
- **Job scheduling and background processing**, supporting quality check runs, report generation,
  bulk exports and synchronization.
- **Configuration management**, so that thresholds, rules, formulas, metadata fields and permissions
  are changed through the interface by authorized users rather than through code changes and
  releases.

---

## DMS–xMart Integration Model

Integration with xMart is not an interface at the edge of this solution; it is the mechanism by
which the solution holds its data. HLR13 and HLR14 define the exchange in both directions, UC045 and
UC046 give it its acceptance criteria, and Annex 3 of the RFP defines a further API that xMart will
call on the DMS.

> **[FIGURE 3 — DMS–xMart integration flow]**

### Retrieval from xMart (UC045)

Whenever the DMS must display or process Health Accounts information, it retrieves that information
from xMart through the secured xMart API. This covers observations for the workbook, the
configuration data behind the Setup module, the data underlying reports and quality checks, and
version information.

Retrieval is designed around three principles:

- **Request only what the screen needs.** Requests are filtered by country, year range and the
  variables in scope, so that a workbook opens by retrieving one bounded slice rather than a
  country's full history.
- **Page and stream large results.** Where a request legitimately spans a large volume — a year-end
  quality check across all countries, or a multi-country report — retrieval is paged and processed
  incrementally in the background rather than assembled in memory.
- **Preserve the distinction between values and formulas.** As UC045 requires, values are transmitted
  as values and formulas as formulas, so that a calculated cell arrives in the DMS as an expression
  to be evaluated rather than as a static number.

### Write-back to xMart (UC046)

Changes made in the DMS are returned to xMart so that xMart remains the authoritative record. This
covers observation values and metadata edited in the workbook, and changes made in the Setup module
to countries, currencies, classifications, categories, crosses, metadata fields and formulas.

Each write-back transmits the identity of the user who made the change, as UC046 requires, and again
preserves values as values and formulas as formulas. The precise trigger for write-back — an
explicit save action, leaving a screen, or a combination — is identified in UC046 as a decision to be
taken at the start of the project; Argusoft's recommendation is an **explicit save with a clearly
indicated unsaved-changes state**, because it gives the analyst a defined commit point, makes
concurrent editing conflicts detectable at a known moment, and produces a version history whose
entries correspond to deliberate user decisions rather than to incidental navigation. This will be
confirmed with WHO during design.

Write-back operations are transactional from the user's point of view: a save either succeeds in
full or reports a failure that identifies the affected observations, and failed transmissions are
queued for retry with the outcome surfaced to the user and to administrators through the integration
monitoring screens described in §5.10.

### Data Retrieval API for xMart (RFP Annex 3)

In addition to consuming the xMart API, the DMS exposes a data retrieval API that xMart calls to
extract DMS data. Argusoft will implement this to the specification in Annex 3:

| Annex 3 requirement | Implementation |
|---|---|
| HTTP GET | GET endpoints, no side effects |
| CSV output (preferred over JSON) | CSV as the default response format; JSON offered additionally |
| Filtering on business primary keys | Filters on country code and on a single year or year range |
| Return the DMS internal identifier | Internal record identifier included in every row |
| Paging | Server-side paging designed for the Annex 3 reference page size of 100,000 records |
| UTC `LastModified`, range-filterable | Maintained on every record and reflecting inserts, updates and deletes |
| Ability to return all data unfiltered | Supported, through paged or streamed retrieval |
| Soft-deleted record retrieval | Records soft-deleted and retrievable through an `IsDeleted` filter |
| OAuth 2.0 | OAuth 2.0 authentication |
| HTTPS only | Transport restricted to HTTPS |
| Streaming (should-have) | Streamed responses for large extractions |
| Non-primary-key filtering (nice-to-have) | Offered on agreed additional fields |

Because the `LastModified` semantics and the soft-delete behaviour determine whether xMart can
perform reliable incremental extraction, these are treated as first-class design requirements rather
than as reporting conveniences: every mutation path in the DMS updates the timestamp, and deletion is
implemented as a state change rather than a physical removal.

> **[SCREENSHOT 1 — Prototype: Annex 3 data retrieval API screen, showing the generated request URL
> and a returned CSV extract]**
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current understanding. Not a final design — subject to revision following requirements finalization with WHO stakeholders.*

### Functionality Delivered Within xMart (HLR16 · UC056)

HLR16 and UC056 ask bidders to implement functionality within the xMart platform itself wherever
doing so saves effort and cost, and state that WHO will give benefit to solutions that use xMart
technology even partially. Argusoft has taken this seriously in shaping the architecture, and
proposes the following division, to be confirmed during discovery when the current xMart
configuration has been reviewed in detail:

**Proposed for implementation within xMart:**

- **Storage and the data model** for observations, metadata and configuration, using the existing
  Health Accounts mart structure rather than replicating it in the DMS.
- **Native data versioning**, on which UC043 and UC044 are built, using xMart's own version tracking
  rather than a bespoke audit table in the DMS. HLR12 explicitly anchors versioning on "the data
  versioning available in xMart".
- **Format validation and transformation on ingestion**, which the To-Be process map already places
  in xMart for data arriving from eDamis, HAPT, OneDrive and other sources.
- **Views and derived structures** for reporting and extraction, where a view in xMart is cheaper and
  faster than an equivalent query assembled in the DMS.
- **Storage of the legacy formulas** imported under UC060 as metadata fields.
- **The Model Uploader** for onboarding and updating data model definitions — a capability Argusoft
  has used in production on the WHO Emergency Public Dashboard.

**Proposed for implementation within the DMS:** the interactive workbook, the calculation engine,
the quality check engine, the report builder, user and permission management, notifications, job
orchestration and the Annex 3 API — that is, the interactive and business-rule functionality for
which xMart is not the appropriate execution environment.

Argusoft's existing hands-on experience with the xMart OData API and the xMart Model Uploader, gained
on the WHO Emergency Public Dashboard, means this assessment can be refined quickly and accurately
during the discovery phase rather than being deferred until development is under way.

---

## Proposed Modules

The following sections describe each functional module of the proposed DMS: what it does, how users
interact with it, and how it satisfies the corresponding use cases.

### Application Home and Dashboard

**Requirements addressed:** HLR2, HLR3 · UC001, UC002, UC003, UC003.1

The DMS is delivered as a web-based application (UC001) accessible through a standard browser with no
local installation, replacing the legacy system's requirement for simultaneous direct connections to
a single server. Following authentication, the user arrives at the application home site, from which
every module is reachable through a persistent navigation structure (UC002). Navigation is filtered
by permission, so a user is never presented with an entry point to a module they cannot use.

The home site presents a **dashboard** (UC003) that answers the questions a Health Accounts analyst
asks at the start of a working session:

- **Reporting round status** — which countries have reported for the current cycle, which are
  outstanding, and which are approaching or past their due date, drawing on the country reporting
  follow-up configuration of UC023.
- **Publication readiness** — the distribution of countries across the publishing status flag defined
  in UC024, so the team can see how much of the round is ready to publish.
- **Quality findings** — the outcome of recent quality check runs, summarized by severity, with
  navigation directly to the affected country and observation.
- **Recent activity and notifications** — submissions received, changes made and the user's
  outstanding notifications.
- **Data completeness** — coverage across countries and years, highlighting gaps that require
  follow-up.

Each dashboard element links directly into the module and record it describes, so the dashboard
functions as a working queue rather than as a static summary.

UC003.1 requires distinct dashboards for administrators and regular users. In the Pilot the dashboard
is common to both roles with content filtered by permission and country scope; the role-specific
dashboard layouts are delivered in the subsequent phase according to their assigned priority, with
administrator views adding system-wide operational content — integration health, job queue status,
user activity and configuration changes.

> **[SCREENSHOT 2 — Prototype: home dashboard]**
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current understanding. Not a final design — subject to revision following requirements finalization with WHO stakeholders.*

### User and Role Management

**Requirements addressed:** HLR4, HLR5, HLR6 · UC004–UC012

The Users module (UC004) provides administrators with a single place to manage who may use the DMS
and what they may do within it.

**Authentication (UC006, HLR5).** Access is through WHO Single Sign-On using Entra ID. The DMS does
not store or manage passwords. As required by HLR4, the system serves both WHO internal users and
external users managed as guest accounts in Entra ID, with the same authentication path and the same
permission model applied to both.

**Granting access (UC005).** An administrator grants a user access by identifying them by their WHO
account or guest email address and assigning a role. The user's identity is established by Entra ID
at first sign-in; the DMS record holds the authorization, not the credential.

**Roles (UC007, HLR6).** The system implements the two roles defined in the requirements —
**Administrator** and **Regular user**. Administrators hold every capability available to a regular
user in addition to their administrative rights, so there is no capability that a regular user has
and an administrator does not. Roles are assigned and changed from the user list.

**Configurable role permissions (UC008).** Rather than encoding capabilities in the application,
permissions are configuration. For each module, an administrator sets the permission level that
applies to regular users, chosen from the levels defined in the requirements — no access, view,
view and export, edit selected countries, edit all, and full administrative control — offering only
those levels that carry meaning for the module in question. Because regular users retain view and
export rights on modules they cannot edit, the configuration cannot produce a user who is unable to
see the data they are responsible for. Changes to the matrix take effect immediately and are audited.

**Country restrictions (UC009).** A regular user's access can be restricted to specific countries, so
that a regional office user works only within their own countries. The restriction is applied at the
service boundary and therefore governs every module consistently — workbook, reports, quality checks
and exports alike — rather than being enforced screen by screen.

Although UC009 is not flagged for the Pilot, Argusoft proposes to **deliver it within the Pilot at no
additional cost**. Because authorization is enforced centrally rather than screen by screen, adding a
country dimension to an authorization decision that is already being made is a small increment of
work — whereas retrofitting it later would mean revisiting every data access path in the system. It
is therefore both cheaper and safer to build it in from the outset, and it gives regional and country
office users a correctly scoped Pilot from the first release.

**Disable and enable (UC010, UC011).** A user's access can be temporarily withdrawn and later
restored, preserving all of their history and authorship. The system prevents the last enabled
administrator from being disabled or demoted, so the platform cannot be left without administrative
access.

**Users are never deleted (UC012).** In accordance with UC012, DMS users cannot be hard-deleted. This
is a structural property of the design rather than a hidden control: user records are referenced by
observation authorship, version histories, quality check rule ownership, report ownership and audit
entries, and deleting a user would break the traceability those references provide. Withdrawal of
access is achieved by disabling the account.

> **[SCREENSHOT 3 — Prototype: user list with inline role and status controls, and the role
> permission matrix]**
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current understanding. Not a final design — subject to revision following requirements finalization with WHO stakeholders.*

### Setup and Configuration

**Requirements addressed:** HLR7 · UC013–UC030

The Setup module (UC013) is where the Health Accounts team defines the vocabulary of the system. It
presents each configurable component on its own tab within a consistent list-and-editor pattern, so
that the interaction learned on one component applies to all of them.

**Configuration components.** The module manages countries and their attributes, currencies,
classifications and categories, crosses, observation metadata fields, and formulas. Values can be
created, edited and — where the requirements permit — disabled and enabled, through a user-friendly
interface rather than through database intervention.

**Import from xMart (UC014).** Configuration data is imported from xMart, so that the DMS begins from
the reference data already maintained in the warehouse and stays aligned with it. Subsequent changes
made in the DMS are written back under UC046.

**Column ordering (UC015).** Users can reorder the columns of any component list by dragging the
column headers, and the chosen order persists for that user across sessions. This applies uniformly
across every list in the module.

**Editing lists of values and creating new values (UC016, UC017).** Predefined lists of values can be
edited and new values created for a component, with the attribute definitions of that component
determining the fields presented.

**New attributes and component editing (UC018, UC019).** Administrators can define new attributes for
existing components and edit component details, extending the metadata model without a code change.

**Deleting a value (UC020).** In accordance with HLR7, a value may be deleted only if it has not been
used in any record. The system verifies usage before permitting deletion and, where the value is in
use, states where it is used rather than simply refusing.

**Export and import of component values (UC021).** Component values and their attributes can be
exported to a structured file and re-imported, supporting bulk maintenance and offline review.

**Groups of countries (UC022).** Country attributes can be flagged as available for grouping and
filtering, so that a group such as a WHO region or an income classification can be selected wherever
the system offers a country selection — quality check scope, report filters and workbook selection
alike. Groups are therefore defined once and consumed everywhere.

**Country reporting follow-up (UC023).** The module records the expected reporting schedule for each
country, including due dates and focal point information, which drives the dashboard's reporting
round view and the due-date notifications described in §5.9.

**Data publishing status flag (UC024).** Each country and year carries a publishing status —
*Not publish* or *Ready to publish* — which can be set individually or applied in bulk to a selection,
so that a full reporting round can be moved to publication readiness in a single operation.

**Predefined and custom crosses (UC025, UC026).** Crosses between classifications are configured as
multi-dimension combinations. A cross is not a separate entity in the data model: it is an
observation that carries values in more than one classification dimension simultaneously, which is
exactly how the xMart long-format structure represents it. Predefined crosses are configured
centrally; users can define additional custom crosses.

**Observation metadata fields (UC027).** The metadata fields carried by each observation — sources,
comments, web links, estimation method and data type among them — are defined here, so that the
metadata model can evolve without a release.

**Metadata files stored in xMart (UC028).** Metadata files held in xMart are accessible from the DMS
in the context of the observation or country to which they relate, so that supporting documentation
is reachable without leaving the application.

**Predefined and custom formulas (UC029, UC030).** Formula management is presented in §5.5.

> **[SCREENSHOT 4 — Prototype: Setup module showing the component tabs and a component list with
> reorderable columns]**
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current understanding. Not a final design — subject to revision following requirements finalization with WHO stakeholders.*

### Workbook Management

**Requirements addressed:** HLR8, HLR9 · UC031, UC031.1, UC032, UC033, UC034

The Workbook is the principal working surface of the DMS and the module in which Health Accounts
analysts will spend most of their time. HLR8 and UC031 define it clearly: a spreadsheet-like
environment in which values for a country and year can be viewed and edited, formulas inserted and
evaluated, metadata consulted, and Excel-like copy, paste and undo performed.

**Workbook definition.** A workbook is a two-dimensional view of a three-dimensional dataset, formed
by fixing one axis and displaying the other two:

- **Country workbook** — one country, many variables, many years.
- **Variable workbook** — one variable, many countries, many years.
- **Year workbook** — one year, many countries, many variables.

The user selects the workbook type and its scope; the selection is reflected in the address of the
page, so a particular working view can be bookmarked, returned to, or shared with a colleague.

**Grid behaviour.** The grid presents years across the top and variables down the side, following the
convention the Health Accounts team already uses, with a scale and currency selector governing how
values are displayed. Reported values and calculated indicators are visually distinguished. In
accordance with UC031, formula cells are rendered in a different colour and in italic so that a
calculated cell is never mistaken for a reported one.

The header row, the variable label column and the corner are **frozen**, so the year and variable
context remains visible at any scroll position — addressing a specific and well-known limitation of
the legacy tool. Scrolling is continuous and virtualized rather than paged, because paging a data
entry surface breaks range selection and range copy and paste.

**Editing and calculation.** Values are edited in place. Formulas can be entered directly into cells
and are evaluated immediately, with dependent indicators recalculating as soon as an input changes,
so the analyst sees the consequence of an edit without an explicit refresh. Editing behaviour follows
spreadsheet conventions: type to replace, Enter and Tab to commit and advance, Escape to abandon.

**Copy, paste and undo.** The requirement in HLR8 is for copy, paste and undo functionality similar to
Excel, and the module implements it accordingly. Ranges can be copied and pasted **within a workbook
and across workbooks**, and the paste operation distinguishes between pasting **values**, **formulas**
and **metadata**, because the three are meaningfully different operations in Health Accounts work.
A multi-level undo and redo stack covers edits, pastes, fills and bulk operations.

**Filtering.** The workbook can be filtered by any displayed element. Filters are presented as
removable chips above the grid rather than as a permanent row of dropdowns, so the active filter set
is visible at a glance and a filter can be removed or reopened in one action. The filter state is
carried in the page address, which makes a filtered view shareable.

**Metadata (UC031, UC034).** Every observation carries metadata, and the workbook marks cells that
have it. Opening a cell's metadata opens a panel **beside** the grid rather than over it: the grid
remains mounted, the cell selection is preserved, and the analyst does not lose their place in the
data while reading or editing a comment or source. Editing metadata is subject to the same
permissions, versioning and write-back as editing a value. Under UC034, users can customize which
metadata fields are displayed and in what order, and the preference persists.

**Series operations.** As required by HLR8, the workbook supports **filling gaps between existing
data points** and **extrapolating a series backwards and forwards**, with the interpolation or
extrapolation method selected by the user and the resulting observations marked with the appropriate
estimation method and data type so their provenance remains visible.

**Statistical and country-specific calculation.** The workbook supports the calculation of standard
indicators applicable to all countries, simple statistical values such as average, minimum and maximum
across a selected group of countries, and country-customized formulas for statistical estimation which
are saved for later reuse. Legacy formulas imported under UC060 are viewable in the metadata of the
observations to which they relate.

**Concurrency and locking (HLR9, UC033).** Only one user may edit the same observations at any one
time. When a user begins editing, the affected scope is locked for other users, who retain read-only
access and are shown who holds the lock and since when. Locks are released on save or on
disconnection after a configurable interval, and administrators can release a lock that has been left
open. This directly addresses the concurrency limitation of the legacy system while ensuring that a
second user is never simply locked out without explanation.

**Export (UC032).** Workbook data is exported to Excel with values exported as values and formulas
exported as formulas, so that an exported workbook remains a working document rather than a flat
snapshot.

**Ordering (UC031.1).** Under UC031.1, workbook data can be ordered by any displayed element. The
default order follows the classification hierarchy, which is what makes the parent and child
relationships legible; user-selected ordering is delivered according to its assigned priority.

**Quality checks from the workbook (UC052).** Quality check rules can be run directly from the
workbook against the data in view, with failing cells highlighted in place. This is described in
§5.7.

> **[SCREENSHOT 5 — Prototype: workbook with frozen headers, filter chips, calculated cells shown in
> italic, and the metadata panel open beside the grid]**
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current understanding. Not a final design — subject to revision following requirements finalization with WHO stakeholders.*

### Formula Management and Calculation Engine

**Requirements addressed:** HLR8 · UC029, UC030, UC060

The calculation engine is the technical core of the DMS. The Health Accounts indicators it produces
are published through GHED and the GHO, so correctness is not a quality attribute of this component —
it is the component's entire purpose. Argusoft treats it as a distinct piece of engineering rather
than as a feature of the workbook.

**Why a purpose-built engine.** Health Accounts formulas are not spreadsheet formulas, and the
difference is structural in four ways:

1. **They reference variables, not cells.** `CHE = HF.1 + HF.2 + HF.3 + HF.4 + HF.nec` refers to
   classification categories, resolved for the current country and year, not to grid coordinates.
2. **They reference other formulas.** `CHE%GDP_SHA2011` depends on `CHE`, which itself depends on the
   `HF` categories. Evaluation therefore requires a dependency graph resolved in topological order,
   with cycle detection — not textual substitution.
3. **Each carries an explicit null-handling condition.** The indicator table in HLR8 attaches a
   condition to every formula: some require *all* components to be non-null, others *at least one*. A
   formula whose condition is not met must yield **blank, not zero** — a distinction that is visible
   in every published output and that matters analytically, because a zero asserts that expenditure
   was nil while a blank states that it is unknown.
4. **They must be overridable per country.** UC029 requires that a predefined formula can be
   customized for a specific country without altering it for any other, so the engine resolves the
   applicable definition per country at evaluation time.

**Engine design.** The engine is built as a tokenizer, a parser producing an abstract syntax tree, a
dependency graph over the referenced variables, and an evaluator that walks the graph in dependency
order. Cycles are detected and reported at the point the formula is saved rather than at the point it
is evaluated, so an invalid formula cannot be committed. Variable codes containing periods,
percentage signs, currency symbols and hyphens — `CHE%GDP_SHA2011`, `GGHE-D_pc_US$_SHA2011` — are
resolved against the known variable set rather than by inferring token boundaries from characters,
which is a common and silent source of error in naive implementations.

**Predefined formulas (UC029).** The predefined indicators listed in HLR8 are configured in the Setup
module with their expression, their null-handling condition, their unit of measure and their folder
grouping. Administrators can edit a predefined formula, and can create a country-specific override
that applies to one country only.

**Custom formulas (UC030).** Users can create their own formulas and save them for reuse, subject to
the same parsing, validation and cycle checking as predefined formulas.

**Transparency.** Because the engine holds an explicit dependency graph, the system can show a user
*why* a value is what it is: the expression, the resolved inputs, the condition that was applied, and
the chain of dependent formulas that will change if an input changes. For a system whose outputs are
published internationally, this auditability is a functional requirement in substance even where it
is not stated as one.

**Legacy formulas.** The engine's design is also what makes the legacy formula migration described in
§6 tractable, since converting an old-DMS expression into a new-DMS formula is fundamentally a
parsing and re-expression problem.

> **[SCREENSHOT 6 — Prototype: formula editor showing the parsed expression, its dependency graph and
> a live evaluation]**
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current understanding. Not a final design — subject to revision following requirements finalization with WHO stakeholders.*

### Reports and Analytics

**Requirements addressed:** HLR10, HLR21 · UC035–UC042

The Reports module (UC035) provides the Health Accounts team with the analytical outputs required for
internal review, quality assurance and publication preparation.

**Report builder (UC036, HLR10).** Administrators define reports through an interactive builder in
which the available fields — countries and their attributes, years, classifications and categories,
variables and indicators, metadata fields — are placed into row, column, filter and value areas to
form a multi-dimensional view. Values are aggregations of the observation measure, and subtotals can
be enabled on any grouping level. A live preview updates as the definition changes, so the report is
designed against real output rather than against an abstract specification. Saved reports become
available to all users.

In accordance with HLR10, the builder is available to administrators. **Regular users access
predefined reports, apply filters and export the results** — they do not define new shared reports.

**Custom and copied reports (UC037, UC038).** A regular user can create customized reports visible to
themselves only, and any user can copy an existing report as the starting point for a new one, which
is the fastest route to a variant of an established output.

**Report list and favourites (UC040).** Users can arrange reports into their own list, mark
favourites and order them, so that a working set of reports is immediately at hand.

**Data tracking reports (UC039).** The module includes data tracking reports covering what has been
received, what has changed, and what remains outstanding across the reporting round, supporting the
follow-up process configured under UC023.

**Multilanguage reports (UC041, HLR21).** Although the DMS interface is in English, reports can be
generated with variable labels in any of the six official WHO languages — English, French, Spanish,
Arabic, Chinese and Russian. Column headings, classification and indicator labels, totals and unit
strings are rendered in the selected language in both the on-screen and exported output. Field values
that are proper names — country names, currency names, report titles and free-text metadata — remain
as recorded, in line with the requirement's own scope. Argusoft notes that Arabic introduces a
right-to-left layout consideration for the tabular output, and this is addressed explicitly in design
rather than discovered at delivery.

**Export to Excel (UC042).** Reports are exported to Excel. Reports whose scope makes generation
long-running are executed as **background jobs**: the user continues working, and an in-app
notification is raised on completion carrying a link to the generated file, or on failure carrying
the reason. Job progress and history are visible in the module.

**Units, currency and scale.** Because Health Accounts values are expressed in national currency
units, in US dollars or as percentages, unit handling is treated as a correctness concern rather than
a formatting one. Conversion is applied per observation before aggregation, and the unit label
carries the country's currency rather than a generic label. A total whose contributions arrived in
more than one currency produces **no number**, because summing amounts in different currencies is
meaningless — a guard that a generic unit label would allow to pass silently.

> **[SCREENSHOT 7 — Prototype: report builder with the field areas and live preview, and a generated
> report]**
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current understanding. Not a final design — subject to revision following requirements finalization with WHO stakeholders.*

### Quality Checks

**Requirements addressed:** HLR15 · UC047–UC055

The Quality Checks module (UC047) is how the Health Accounts team establishes that a dataset is fit to
publish. It provides a library of rules, the means to run them across a chosen scope, and a report of
the findings.

**Rule library.** Rules are presented grouped by type, with a distinct group for user-customized
rules. Rules created by the development team during implementation, rules created by administrators
and rules created by individual users are **visually distinguishable from one another**, as UC053
requires, so the provenance and authority of a rule is apparent from the list.

**Predefined rules (UC053).** Argusoft will implement the predefined rule categories described in the
requirements, with the final list confirmed by the technical unit at project start and Annex 4 of the
Functional Requirements as the starting point:

- Year-on-year growth, in absolute and in relative terms.
- Growth between two versions of the data.
- New, disappeared or missing observations compared with previous reporting.
- Inconsistency between categories — for example, components that should reconcile to their total.
- Inconsistency between tables.
- Atypical entries, raised as an error or as a warning according to configuration.
- Outliers assessed across groups of countries.

**Configuration values (UC054).** The thresholds that determine whether a rule passes, fails or raises
a warning are **administrator-configurable**, not fixed in code, so that the team can tune sensitivity
as data and expectations change without a release.

**Custom rules (UC050).** A regular user can create a quality check rule available to themselves only,
building it by selecting variables, countries and years and defining calculations and conditions.
Administrators can see users' custom rules, so that a rule which proves broadly useful can be promoted
to a predefined rule.

**Administrator-defined predefined rules (UC049).** Administrators create rules available to all users
through the same rule-building interface.

**Country exclusions (UC048).** Rules apply to all countries by default. An administrator can exclude
one or more countries from a rule where the rule is not meaningful for them, and can reset the
exclusions so the rule applies universally again. Exclusions are visible on the rule, so an excluded
country is never silently unchecked.

**Running rules.** Rules are run against a single country or against a group of countries selected by
their attributes — region, income group, OECD membership and any other attribute flagged as groupable
under UC022. Year-end processing, when the full quality check process runs across all countries, is
executed as a background job with progress reporting, restart and retry, so that a long run is
observable and recoverable rather than opaque.

**Running from the workbook (UC052).** Rules can be triggered manually from a workbook against the
data currently in view, with failing cells **highlighted in place in the grid**. This closes the loop
between finding a problem and correcting it: the analyst does not have to carry a finding from a
report back into the data by hand.

**Reports (UC055).** Each run produces a quality check report presenting the findings by rule, by
country and by severity, with visualization of the results and the ability to download the report.
Findings link directly to the affected observation.

**Export and import of rule configuration (UC051).** Rule configurations can be exported and
re-imported, supporting review outside the system and the transfer of a configuration between
environments.

> **[SCREENSHOT 8 — Prototype: quality check rule list with origin-distinguished rules, and a
> findings report]**
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current understanding. Not a final design — subject to revision following requirements finalization with WHO stakeholders.*

### Data and Metadata Versioning

**Requirements addressed:** HLR12 · UC043, UC044

Versioning in the DMS is built on the data versioning available in xMart, as HLR12 directs, rather
than on a parallel audit structure in the DMS. Every committed change to an observation, a dataset or
a metadata field produces a version stamped with its author and the time of the change.

**Viewing and comparing versions (UC043, UC044).** Users with the corresponding rights can view up to
ten previous versions of an observation or variable and compare them, with differences in value and in
metadata presented side by side so that what changed, when and by whom is immediately legible.

**Restoration (UC044).** A user can select one of the previous versions and restore it as the current
value. Administrators can additionally restore a **full dataset as at a specific date**, which is the
recovery path for a bulk operation that produced an unintended result. Restoration is itself a
versioned change, so the history is never rewritten — restoring an earlier value adds a new version
recording that restoration rather than deleting the intervening ones.

**Comparison against a previous reporting round** feeds the quality check category concerned with
growth between two versions of the data, so versioning is not only a recovery mechanism but an input
to validation.

> **[SCREENSHOT 9 — Prototype: version comparison for an observation]**
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current understanding. Not a final design — subject to revision following requirements finalization with WHO stakeholders.*

### Notifications

**Requirements addressed:** HLR18 · UC023, UC042, UC058, UC059

The Notifications module (UC058) provides the in-app, event-driven notifications required by HLR18.

**Event catalogue.** Notifications are raised on defined system events — a country's data submission
received, a reporting due date approaching or passed, a background report or quality check job
completed or failed, a dataset moved to *Ready to publish*, a version restored, a configuration or
permission change applied. A predefined set is delivered with the system based on the list provided by
the technical unit at project start.

**Configuration (UC059).** Administrators can create and edit notifications, defining the triggering
event and the countries or groups of countries to which each user's notification applies. Because
country groups are the same groups configured under UC022, a subscription such as "all countries in
the African Region" is expressed once and remains correct as the group's membership changes.

**Preferences.** In accordance with HLR18, notifications are focused on user preferences such as
country or variable, so that a user receives what is relevant to their responsibilities rather than
every event in the system.

**Delivery.** Notifications are delivered in-app and highlighted on the dashboard, as UC059 describes.
Notifications carrying an artefact — a completed report, a quality check report — carry a working link
to it.

**Reporting follow-up (UC023).** The country reporting due dates configured in the Setup module raise
notifications as dates approach and pass, which is what turns the reporting follow-up configuration
into an active process rather than a static reference table.

> **[SCREENSHOT 10 — Prototype: notification inbox and subscription configuration]**
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current understanding. Not a final design — subject to revision following requirements finalization with WHO stakeholders.*

### Administration and Integration Monitoring

**Requirements addressed:** HLR13, HLR14, HLR17 · UC045, UC046, UC056, UC057

Alongside the functional modules, the DMS provides administrators with visibility into the health of
the system and its integration with xMart — the operational counterpart to the integration design
described in §4.

- **Synchronization status** per data source and per exchange direction: when data was last retrieved
  from xMart, when changes were last written back, what is pending and what has failed.
- **An API call log** recording requests to and from xMart with their outcome, duration and payload
  size, so that an integration problem can be diagnosed from evidence.
- **Error handling and retry**, with failed exchanges queued, retried according to policy, and
  escalated through notification when they exhaust retries.
- **Background job monitoring** covering quality check runs, report generation and bulk exports, with
  progress, restart and retry.
- **The Annex 3 data retrieval interface**, through which the DMS-side API described in §4.3 can be
  exercised and verified.
- **Audit log access**, presenting the record of data changes, configuration changes, permission
  changes and integration events in a searchable, filterable view.

> **[SCREENSHOT 11 — Prototype: integration monitoring with the API call log and synchronization
> status]**
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current understanding. Not a final design — subject to revision following requirements finalization with WHO stakeholders.*

---

## Legacy Data and Formula Migration

**Requirements addressed:** HLR19 · UC060, UC060.1

The legacy DMS holds the Health Accounts history that the new system must be able to consult, and
approximately 70,000 formulas held in its Microsoft SQL Server database. Argusoft will perform the
one-time migration of this content into the agreed xMart and DMS target structures.

**Approach.** Migration is executed as a controlled, repeatable and reconciled process rather than as
a single transfer:

1. **Discovery and profiling** of the legacy schema, its data quality and its formula syntax,
   producing a documented source-to-target mapping agreed with WHO.
2. **Extraction** of the latest version of each record and each formula, in line with the requirement
   that only the latest version is migrated.
3. **Transformation** into the target structure, including the mapping of legacy identifiers onto the
   classification and category codes in use in the new system.
4. **Loading** into xMart, with the legacy formulas stored as plain-text metadata fields so that they
   are available for inquiry from the new DMS against the observations to which they relate.
5. **Formula conversion**, translating legacy expressions into executable new-DMS formulas, as
   described below.
6. **Reconciliation and exception reporting**, producing record counts, control totals and a
   **failed-conversion exception report** naming each formula requiring individual attention and why,
   so that any remainder is a known and jointly managed list rather than a silent gap.
7. **WHO validation and sign-off** against the reconciliation evidence, followed by cutover.

**Trial runs.** The migration is executed at least twice in a non-production environment before the
production run, so that the reconciliation report — not the production cutover — is where problems are
found.

**Rehearsed rollback.** A documented rollback position is established before the production run.

### Formula migration and conversion

Argusoft will manage the migration of the legacy formulas from the old DMS into the new system.
All formulas are imported into xMart as plain-text metadata fields, so that each is available for
inquiry from the new DMS against the observations to which it relates, and they are then translated
into working formulas in the new DMS. The calculation engine described in §5.5 — which parses
expressions into an abstract syntax tree rather than treating them as text — is what makes this
translation systematic rather than manual, since converting a legacy expression is fundamentally a
matter of re-expressing a parsed structure in the new syntax.

The conversion is carried out in collaboration with the WHO Health Accounts team, whose domain
knowledge of the legacy formula population is what allows individual cases to be resolved
authoritatively, and it is validated by comparing each converted formula's computed result against
the legacy result for the same country and year.

---

## Non-Functional Design

### Performance and Scalability

UC057 and HLR17 describe volumes fluctuating from around twenty rows to a maximum of twenty-five
million, with each of approximately 196 countries submitting up to ten times a year, countries able to
resubmit their full time series since 2000, and a full quality check process across all countries at
year end.

The architecture answers this in four ways:

- **The large volumes are retrieval volumes, not display volumes.** A workbook is a bounded slice of
  data — one country against its variables and years — irrespective of how much data exists behind it.
  The design does not assume that a large result set is ever loaded into a browser.
- **Server-side paging and streaming.** Large extractions are paged, using the Annex 3 reference page
  size of 100,000 records, or streamed, so that memory consumption is bounded regardless of result
  size.
- **Background and asynchronous processing.** Year-end quality checks, complex report generation and
  bulk exports execute as background jobs with progress visibility, restart and retry, so that a large
  workload is observable and recoverable and does not occupy an interactive session.
- **Caching of reference data.** Configuration and reference data that changes rarely is cached, so
  routine interaction does not generate repeated calls to xMart.

The concurrent user population is modest — of the order of twenty internal users — so the design
priority is throughput on batch operations and responsiveness on interactive ones, rather than mass
concurrency. Representative performance scenarios and measurable thresholds will be agreed with WHO
during discovery and verified as described in the Quality Assurance section of this proposal.

### Security and Access Control

Security is described in full under *Approach — Security & Coding Standards* earlier in this proposal
and is not repeated here. In terms of the solution design specifically:

- Authentication is delegated entirely to WHO Entra ID; the DMS stores no credentials.
- Authorization is enforced at the service boundary, covering role permissions and country
  restrictions, so that it cannot be circumvented by the client.
- All transport is over HTTPS, and the Annex 3 API uses OAuth 2.0.
- Data is encrypted in transit and at rest using WHO-approved Azure services and configurations.
- Every data modification, configuration change, permission change and integration event is recorded
  in the audit log with user identity and timestamp.
- File uploads are validated and scanned using the WHO-provided security scan API.

### Accessibility

The application will be developed to meet the applicable WHO accessibility requirements, addressing
keyboard navigation, focus order, form labelling, colour contrast and assistive technology
compatibility. Accessibility is treated as a design constraint from the first wireframe rather than as
a remediation activity, because the two components most difficult to make accessible — the workbook
grid and the report builder — cannot be retrofitted cheaply. Both are designed with full keyboard
operability, and the workbook's use of colour to distinguish calculated from reported cells is
reinforced by typography rather than carried by colour alone.

### Multilanguage Reporting

In accordance with HLR21, the DMS interface is delivered in English, while reports can be generated
with variable labels in any of the six official WHO languages. Language resources are externalized
rather than embedded, so that a label correction or an additional language is a configuration change.
Labels are translated while codes, unit keys and stored filter values remain canonical, so that
translation cannot alter the behaviour of a calculation or a validation.

### Browser Support, Responsiveness and Availability

The application will support the browsers and viewport sizes agreed with WHO, verified through the
cross-browser and responsive testing described in the Quality Assurance section. The interface is
responsive across desktop and laptop viewport sizes; the workbook, being a dense data entry surface, is
designed for desktop use, which reflects how the Health Accounts team works.

Availability, backup and recovery objectives will be agreed with WHO during design and verified before
production readiness.

---

## Proposed Technology Stack

Argusoft takes a technology-agnostic approach to platform selection. Each technology has its own
strengths, and our objective is to select tools that best fit the solution's objectives, WHO's
existing enterprise environment, the capabilities of the xMart platform, and long-term
maintainability by WHO's own teams. The final stack will be confirmed with WHO during the solution
design phase and documented in the System Design Document, taking into account WHO's preferred
technologies, existing support arrangements and hosting environment.

The following stack is proposed as the recommended baseline:

| Layer | Proposed options | Rationale |
|---|---|---|
| **Front end** | React / Angular with TypeScript | Component-driven frameworks suited to a data-dense administrative application. TypeScript is recommended given the multi-dimensional data model and the formula abstract syntax tree, where static typing materially reduces defect rates. |
| **Data grid** | A virtualized, spreadsheet-capable grid component | The workbook requires range selection, keyboard navigation, multi-cell copy and paste and frozen panes. Selection will avoid restrictive licensing. |
| **Back end / API** | .NET (C#) / Java / Node.js | All support secure REST APIs, background processing and enterprise-grade integration. .NET aligns with WHO's existing Microsoft platform estate and with Argusoft's WHO delivery experience on ENAPHS, JEE Reporting and EWARS. |
| **DMS local database** | Microsoft SQL Server / PostgreSQL | Relational storage for operational data, with the maturity required for transactional integrity, indexing and audit retention. SQL Server aligns with the WHO Azure environment. |
| **Caching** | Redis / in-memory distributed cache | Caching of xMart reference data and session-scoped working state. |
| **Background processing** | A durable job framework with a persistent queue | Year-end quality checks, report generation and migration processing require restart, retry and progress reporting. |
| **Reporting and export** | Server-side spreadsheet generation libraries | Excel export with values as values and formulas as formulas, as UC032 and UC042 require. |
| **Visualization** | Established charting libraries | Dashboard and quality check visualizations. |
| **Data warehouse** | **WHO xMart** | Unchanged: the authoritative Health Accounts store, accessed through its secured API. |
| **Integration** | xMart API (OData), REST, OAuth 2.0, HTTPS, CSV/JSON | As specified in HLR14 and RFP Annex 3. |
| **Authentication** | WHO Entra ID (SSO, including guest accounts) | As specified in HLR4 and HLR5. |
| **Cloud platform** | Microsoft Azure (WHO-provided) | As specified in the Terms of Reference. |
| **DevOps** | Azure DevOps pipelines, Infrastructure as Code (Terraform / ARM / Bicep) | Required by Objective 3 of the Terms of Reference. |

Three selection principles apply throughout. **First, alignment with WHO's environment takes
precedence over Argusoft's preference** — a stack WHO's own teams can maintain after handover is
worth more than a marginally superior one they cannot. **Second, licensing is a selection criterion**:
components carrying commercial or restrictive licences are avoided where an equivalent
permissively-licensed option exists, so that WHO's ownership of the delivered source code is
unencumbered. **Third, the xMart platform is used wherever it can do the work**, in accordance with
HLR16 and UC056 and as set out in §4.4.

---

## Hosting and Deployment

**Environments.** In accordance with the Terms of Reference and as set out in the Work Plan, Argusoft
will establish and operate the **Development environment** using vendor-provided infrastructure, while
**WHO will provide and host the UAT and Production environments within WHO Azure**. Sprint
deliverables are deployed to UAT for WHO verification, and approved releases are promoted to
Production.

**Hardware and resource sizing.** As required by the Terms of Reference deliverables, Argusoft will
prepare a **Hardware Requirement Proposal** during the design phase, specifying the Azure resources
required for UAT and Production — compute, database, storage, caching, networking and monitoring
components — sized against the expected volumes, the year-end processing peak and the agreed
availability objectives.

**Infrastructure as Code and DevOps.** Cloud resources are added, removed and configured through
**Infrastructure as Code and DevOps pipelines**, as Objective 3 of the Terms of Reference requires,
so that environments are reproducible and every configuration change is version-controlled and
auditable. Deployment is automated through pipelines covering build, automated testing, security
scanning and release, with a documented rollback position for every release.

**Monitoring and support.** Argusoft will provide **24×7 automated monitoring** of server performance
and system accessibility, environment alerting, and **SSL certificate expiry monitoring with timely
renewal** to eliminate the risk of downtime from certificate expiry. Troubleshooting and configuration
adjustment will be performed as needed, and Argusoft will engage Microsoft on WHO's behalf for any
Azure subscription or infrastructure issue, obtaining resolution and root cause analysis. **Support
and Maintenance reports are submitted monthly**, recording changes and troubleshooting performed on the
UAT and Production environments.

**Backup and recovery.** Backup and restoration procedures are established against recovery objectives
agreed with WHO and tested before production readiness.

**Handover.** On completion, Argusoft hands over the complete source code, the database technical
description including relational schema, data types and table structures, the system architecture
documentation, the deployment and infrastructure definitions, user and administrator guides, and any
applicable third-party licence keys — so that WHO holds full ownership and the practical ability to
maintain and further develop the system.

---

## Notes for review — not part of the proposal text

**Delete this whole section before insertion into the .docx.** It is a working record, not proposal
content.

### Resolved — 11 August 2026

1. **Legacy migration scope.** Confirmed in scope: WHO clarification puts the migration inside the
   current engagement. §6 states plainly that Argusoft manages the migration — import into xMart as
   plain-text metadata, then translation into working DMS formulas — carried out in collaboration with
   the HA team and validated against legacy results. **No effort caveat**, per your correction of
   11 August: UC060 already places the HA team on the conversion where it proves significant
   (*"if this means a significant additional effort, HA team will do the conversion… based on some
   conversion scripts once the tool is implemented"*), so hedging on our side is unnecessary and reads
   as weakness. The earlier draft's profiling milestone and phased-fallback language has been removed.
2. **Sprint length.** Left as is — you are raising the 2–4 vs 2–3 week inconsistency separately. This
   section does not reference sprint length, so nothing here depends on the outcome.
3. **UC009 country restrictions.** Confirmed for the Pilot. §5.2 now states that Argusoft delivers it
   within the Pilot at no additional cost, with the reasoning: authorization is already enforced
   centrally, so adding a country dimension is a small increment now and an expensive retrofit later.
   This is the one place in the section where we claim to exceed the required Pilot scope.
4. **Development Timeline.** Left empty, out of scope for this pass.
5. **Prototype framing.** Strengthened as directed. The *Working prototype* subsection now states in
   bold that the prototype reflects Argusoft's current understanding only, that the screens are not
   the final design, and that it will be updated during requirements finalization based on stakeholder
   input and WHO approval. Every one of the eleven screenshot figures additionally carries the caption:
   *"Indicative prototype view illustrating the proposed design based on Argusoft's current
   understanding. Not a final design — subject to revision following requirements finalization with
   WHO stakeholders."*

### Still open

6. **Figures and screenshots are placeholders** pending Steps 3 and 4 — 3 diagrams, 11 screenshots.
