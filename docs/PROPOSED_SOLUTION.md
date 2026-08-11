# Proposed Solution

> **Draft for review.** To be inserted under the existing empty *Proposed Solution* Heading 2 in
> `Technical Proposal_Argusoft India Ltd_WHO_Data_Management_System.docx`, between *Methodology*
> and *Proposed Work Plan*.
>
> Heading mapping: `##` is Heading 2, `###` is Heading 3, `####` is Heading 4.
> Figure and screenshot callouts are marked `[FIGURE n]` and `[SCREENSHOT n]`.
> Delete the *Notes for review* section at the foot before inserting.

---

## Proposed Solution

### Solution Overview

In response to the requirements set out in the Terms of Reference and the Functional Requirements,
we propose a centralized, web based Data Management System for Health Accounts, built upon WHO's
existing xMart data warehouse. The application will serve as the single working environment for the
WHO Health Accounts team and its colleagues in Regional and Country Offices, covering the full
working cycle for country health expenditure data: bringing data together, checking it, calculating
indicators, resolving quality issues, tracking what each country has reported, and preparing the
year's figures for publication. Users will sign in with their WHO account through Entra ID, and
external contributors will be supported as guest accounts under the same sign in path. A single API
layer will carry every exchange with xMart and with any other WHO system that needs to read from the
DMS, and the application will run on WHO Azure infrastructure sized for the year end peak.

One point shapes almost every design decision that follows. The Functional Requirements are explicit
that the main data warehouse for Health Accounts data stays in xMart, that the DMS calls the xMart
API whenever it needs to display or process data, and that processed results are returned to xMart
once they are complete. The same requirement then adds that the DMS is expected to have a local
database of its own. We have taken both halves of that literally. Country health expenditure data,
its metadata, the configuration behind it and its version history remain in xMart and are never
duplicated as a second authoritative copy. The DMS local database holds what belongs to the
application rather than to the warehouse: user accounts and permissions, quality check and report
definitions, saved user preferences, background job state, edit locks, notifications and the
application audit log. This division keeps one source of truth for the figures that eventually reach
the Global Health Expenditure Database and the Global Health Observatory, while giving the
application the transactional store it needs to stay responsive and to support several people working
at once.

The application will be built to perform well even when a request spans a large slice of the
warehouse. Expected volumes range from a few dozen rows to a stated maximum of twenty five million,
and a full quality check run at year end covers every country at once. To keep this comfortable we
will combine server side filtering and paging with caching of the reference data that changes rarely,
such as country and currency lists, classifications, crosses, metadata field definitions and formula
definitions. **Redis** is our recommended cache for this, with cache entries cleared automatically
when the corresponding value is edited in the Setup module. Long running work does not block the
screen: full quality check runs, complex report generation and bulk exports are handed to a durable
background job queue, and the user is told when the job finishes through an in app notification
carrying a link to the result. Within the browser we will apply virtualized rendering, lazy loading of
each module and prefetching of the data a user is most likely to open next, so that a workbook opens
quickly regardless of how much history sits behind it.

After a careful review of the scope of work, the Functional Requirements and the API specification,
we propose an n-tier architecture for this project. The most important characteristic of this
approach is the separation of the service and interface layers, which brings ease of maintenance and
ease of extension. The pattern allows the application to grow without compromising performance or
accuracy, and its service oriented design builds the application from loosely coupled, interoperable
services that communicate through formal contracts independent of the underlying platform and
programming language. The presentation tier itself is modelled on the MVC architecture.

The MVC pattern suits this project particularly well because the core business rules of Health
Accounts work are already documented in detail, which means they can be built, modified or extended
in the business layer without touching any other layer. The proposed solution also uses ORM
(Object-Relational Mapping) in the model so that the system stays database agnostic, and it places
every call to xMart behind a single integration component so that a change to an xMart contract,
authentication method or data structure is absorbed in one place rather than across the application.

**Working Prototype**

Rather than describe the proposed system in writing alone, we have built a working prototype of it and
made it available for evaluation at **https://whohadms.argusservices.in/**. It covers the application
shell, the Setup module, the Workbook with its calculation engine, Quality Checks, Reports, versioning,
the dashboard and the data retrieval interface, running against a representative Health Accounts
dataset. The screenshots throughout this section are taken from it.

We want to be clear about what the prototype represents. It sets out our proposed solution based on our
current understanding of the Terms of Reference, the Functional Requirements, the API specification and
the clarifications issued. It is not the delivered product, and the screens shown in this section are
not a final design. During the requirements finalization phase we will hold detailed workshops with the
WHO Health Accounts team, study the existing DMS and the way the team works with it today, and build a
precise understanding of the outcomes expected from the new system. The prototype will then be updated
to reflect that input, and the resulting design will be submitted for WHO's review and approval before
development begins, as set out in our work plan.

We built it ahead of the bid for a practical reason. Design approval is the first milestone of this
project, and a discussion about static wireframes is slower and less productive than a discussion about
something a reviewer can click through and react to. Every part of it, including the navigation, the
workbook layout, the report builder and the content of the dashboard, is a proposal open to revision,
and we expect it to change once the team has spent time with it.

**Functional Landscape**

> **[FIGURE 1 · `docs/assets/figure1-functional-landscape.png`]**
> Functional landscape of the proposed Health Accounts Data Management System.

**Architecture Diagram**

> **[FIGURE 2 · `docs/assets/figure2-solution-architecture.png`]**
> Solution architecture.

The application architecture will have the following layers.

#### Front-end (Presentation Layer/Tier)

The front-end, also known as the presentation layer, would handle the user interface and user
experience for the Health Accounts Data Management System. It would consist of technologies like
HTML, CSS and Javascript that can be rendered through a web browser on desktop and laptop devices.

The front-end tier in a single page application (SPA) typically follows Model-View-Controller (MVC)
architecture, which separates the concerns of the application into three distinct components: the
data (model), the user interface (view), and the logic that binds the two (controller).

The Model represents the data and the business logic of the application. It can retrieve data from
the server via an API or manage data entered by the user.

The View represents the user interface of the application. It is responsible for displaying the data
to the user and collecting input from the user.

The Controller is the component that sits between the Model and the View. It is responsible for
receiving user input, updating the Model based on that input, and updating the View to reflect any
changes in the data.

In a SPA, the front-end tier communicates with the server via APIs to retrieve and update data. This
allows the front-end to operate independently of the back-end, improving scalability and
maintainability of the application.

Such separation of concerns would allow for more modular and maintainable code and makes it easier to
update the user interface without impacting the rest of the application.

For this application the presentation layer carries one requirement that deserves particular
attention. The Workbook is the main working module, and the Functional Requirements ask for a format
similar to Excel, where cells can be viewed and edited, formulas inserted, and copy, paste and undo
behave the way they do in a spreadsheet. Health Accounts analysts have worked this way for years, so
we treat the familiarity of that surface as a requirement rather than a preference. We recommend a
virtualized data grid such as **AG Grid Community** or **react-datasheet-grid**, both open source,
which provide range selection, keyboard navigation, multi cell copy and paste and frozen rows and
columns out of the box. Supporting libraries we recommend include **TanStack Table** for the list
grids in Setup, Users and Reports, **TanStack Query** for retrieval, caching and refetching of server
data, **dnd-kit** for the drag interactions in the report builder and the column reordering, and
**Apache ECharts** or **Chart.js** for the dashboard and quality check visualizations. Accessibility
is verified during development using **axe-core**.

#### API - Application Programming Interface Layer/Tier

The API acts as a standard channel for the application to interact with the Business Logic and Rules.
API generally encompasses the Business Logic layer too, which is responsible for implementing the
functionality required to support the business process.

The API Layer provides a reusable set of services that can be consumed by the front-end application.
If required, the APIs can be used to exchange data with other external systems in an
industry standard manner. The API layer also provides help in decoupling the front-end and back-end
layers of the application, allowing them to be developed and maintained independently. This means
changes to one layer will not affect the other, allowing for more flexibility and scalability.

In this solution the API layer carries the logic that makes the application a Health Accounts tool
rather than a general data editor. It holds the calculation engine that parses and evaluates
indicator formulas, the quality check engine, the rules that decide what a user may see and change,
the orchestration of every exchange with xMart, and the management of background jobs. It also
exposes the data retrieval API that xMart itself will call, described later in this section. Services
are designed to be stateless so that the tier can be scaled out to absorb the year end load, with
shared state held in the database or the cache rather than in server memory. API contracts are
documented with **OpenAPI** through **Swagger**, so that WHO holds a precise and current description
of every endpoint. For background job execution we recommend **Hangfire** or **Quartz**, which give
persistent queues, automatic retry and a monitoring dashboard without additional infrastructure.
Structured logging through **Serilog** and distributed tracing through **OpenTelemetry** make it
possible to follow a single user action across the layers when a problem needs diagnosing.

#### Data Access Layer

The data layer refers to the part of the application that deals with storing, retrieving and
manipulating data. It abstracts the underlying data storage mechanism and provides a consistent way
for the rest of the application to interact with the data. With abstraction, it automatically
provides portability, where it is easier to port the application to a different data storage
mechanism.

In the 3-tier architecture, the front-end tier is typically separate from the other two tiers
(business logic and data) to allow for flexibility in design and implementation and to make it easier
to update, maintain and modify components without impacting the other parts of the application. The
front-end, API and data tiers can be scaled independently, making it easier to handle increased user
traffic or changes in system requirements.

For the DMS this layer reaches two stores and one cache through the same internal interface. The
first is WHO xMart, accessed through its secured API, which holds the Health Accounts record. The
second is the DMS local database, which holds the operational data described in the Solution
Overview. The third is the cache. Because the business logic above this layer never knows which store
it is reading from, the boundary between xMart and the local database can be adjusted during the
design phase without reworking the application. The relational store can be
**Microsoft SQL Server**, **MySQL** or **PostgreSQL**, each of which gives the transactional integrity,
indexing and retention behaviour that the audit log and the job queue require. Schema changes are
managed as versioned migrations so that every environment can be rebuilt to a known state.

#### Important Modules

We have studied the Terms of Reference, the Functional Requirements, the API specification for data
exchange with xMart and the clarifications issued, and we have gone through the use cases in detail
to understand the working practices they describe. This section sets out the modules we propose to
build, and what each of them does. The modules follow the structure of the requirements closely so
that WHO can trace each part of the system back to the business need it answers, and so that the
phased delivery can be agreed module by module.

The proposal covers the complete functionality described in the requirements. Delivery is phased, as
the requirements themselves direct: the first release is the Pilot, containing the functionality
marked for Pilot priority, and the remaining functionality is added incrementally in the agreed
priority order once the Pilot is approved. Where a capability described below belongs to a later
phase, that is confirmed during the requirements finalization phase and reflected in the sprint plan.
One capability we have chosen to bring forward is country level access restriction for regular users.
It is not marked for the Pilot, but because access decisions are enforced centrally in the API layer
rather than screen by screen, adding a country dimension to a check that is already being made costs
very little now and would be an expensive change later. We therefore propose to include it in the
Pilot at no additional cost.

**Assumptions**

The following assumptions underpin the proposed solution. Each will be confirmed during project
initiation, and any change will be handled through the agreed change process.

- WHO will provide access to the xMart platform, including API credentials and the relevant mart
  structures, for the Development, UAT and Production environments.
- WHO will provide and host the UAT and Production environments within WHO Azure. Argusoft will
  provide and operate the Development environment.
- WHO will carry out the Entra ID application registration and will provision guest accounts for
  external users.
- The final list of predefined quality check rules and of notification events will be provided by the
  WHO technical unit at the beginning of the project, using the examples in the requirements as the
  starting point.
- WHO will provide access to the legacy DMS database, together with any available documentation, for
  the migration of legacy data and formulas.
- The recurring pipelines that bring country data into xMart from eDamis, HAPT, OneDrive and other
  sources are already in place and remain outside the scope of DMS development.
- The DMS user interface will be in English. Report output will be available with variable labels in
  the six official WHO languages.
- WHO will provide the security scan API used to check uploaded files.
- The system will support approximately twenty concurrent internal users and data for approximately
  196 countries, with data volumes for a single request ranging from a few dozen rows to the stated
  maximum of twenty five million.
- WHO will provide representative test data and will take part in User Acceptance Testing.

Based on our understanding we propose the following modules.

**Home Dashboard**

- Reporting Round Overview
- Publication Readiness
- Quality Findings Summary
- Data Completeness
- Recent Activity and Notifications

**Users and Role Management**

- User Access and Sign In
- Role Assignment
- Role Permission Configuration
- Country Level Access Restriction
- User Status Management

**Setup and Configuration**

- Configuration Import from xMart
- Countries and Groups of Countries
- Currencies
- Classifications and Categories
- Crosses
- Observation Metadata Fields
- Formulas
- Country Reporting Follow Up
- Data Publishing Status
- Component Export and Import

**Workbook Management**

- Workbook Selection and Filters
- Data Viewing and Editing
- Copy, Paste and Undo
- Observation Metadata
- Series Estimation Tools
- Concurrency and Locking
- Workbook Export

**Formula Management and Calculation Engine**

- Predefined Indicator Formulas
- Custom and Country Specific Formulas
- Dependency Resolution and Validation
- Legacy Formula Access

**Quality Checks**

- Rule Library
- Rule Builder
- Threshold Configuration
- Country Exclusions
- Rule Execution
- Quality Check Reports
- Rule Export and Import

**Reports and Analytics**

- Report Builder
- Predefined and Custom Reports
- Data Tracking Reports
- Multilanguage Report Output
- Export and Background Generation
- Report List and Favourites

**Data and Metadata Versioning**

- Version History
- Version Comparison
- Version and Dataset Restoration

**Notifications**

- Event Catalogue
- Notification Configuration
- Subscriptions and Preferences
- In App Delivery

**Integration with WHO xMart**

- Data Retrieval from xMart
- Data and Metadata Write Back
- Data Retrieval API for xMart
- Integration Monitoring and Error Handling

**Legacy Data and Formula Migration**

- Source Profiling and Mapping
- Migration Execution
- Reconciliation and Validation

**Additional Features**

- Multilanguage Report Labels
- Accessibility
- Browser Support and Responsive Layout
- Audit Trail

**Security Features**

- Authentication and Single Sign On
- Authorization and Data Scoping
- Encryption in Transit and at Rest
- File Upload Validation and Malware Scanning
- Secure Coding Practices

#### Home Dashboard

The dashboard is the first screen a user sees after signing in, and we have designed it to answer the
questions a Health Accounts analyst actually asks at the start of a working session rather than to
present statistics for their own sake. Every element on it is a link into the record it describes, so
the dashboard works as a queue of things to do rather than a summary to read and leave.

The **Reporting Round** panel shows where the current cycle stands: which countries have submitted,
which are still outstanding, and which are approaching or past their due date. It draws on the
reporting schedule and focal point details held in the Setup module, and it is the panel the team will
use most often between submissions. Beside it, **Publication Readiness** shows how many countries sit
at **Not publish** and how many have moved to **Ready to publish**, which gives an immediate sense of
how much of the round is finished. **Quality Findings** summarises the outcome of recent quality check
runs by severity, with a link straight to the affected country and observation. **Data Completeness**
presents coverage across countries and years as a heat map so that gaps stand out visually and can be
turned into follow up. **Recent Activity** lists submissions received, changes made and the user's
outstanding notifications.

Content on the dashboard is filtered by the signed in user's role and country scope, so a Regional
Office colleague sees their own countries and an administrator sees the whole picture. The
requirements also describe separate dashboards for administrators and regular users as a later
addition. Our proposal delivers a common dashboard first, filtered by permission, and then adds the
role specific layouts in the agreed phase, with the administrator view gaining operational content
such as integration health, background job status and recent configuration changes.

> **[SCREENSHOT 1 · `docs/assets/screenshots/01-home-dashboard.png`]**
> Home dashboard: reporting round, publication readiness, quality findings and data completeness.
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current
> understanding. Not a final design, subject to revision following requirements finalization
> with WHO stakeholders.*

#### Users and Role Management

This module gives administrators one place to control who can use the DMS and what they can do inside
it. Sign in is handled entirely by WHO Single Sign On through Entra ID, so the application never
stores or manages a password. Both WHO internal staff and external contributors are supported, the
latter as guest accounts in Entra ID, and both follow the same sign in path and the same permission
rules. On the client side we recommend **MSAL** for the authentication flow, with the server
validating tokens through standard **OpenID Connect** middleware.

An administrator grants access from the **Users** list by entering a colleague's WHO account or guest
email address and choosing a role. The identity itself is established by Entra ID at first sign in,
so the DMS record carries the authorization rather than the credential. The system provides the two
roles the requirements define, Administrator and Regular user, and an administrator holds every
capability a regular user holds in addition to the administrative ones, so there is no function that
a regular user can reach and an administrator cannot.

Permissions are configuration rather than code. On the **Role Permissions** screen an administrator
sets, for each module, the level that applies to regular users, choosing from the levels the
requirements define: no access, view, view and export, edit selected countries, edit all, and full
administrative control. Only the levels that carry meaning for a given module are offered, so
"edit selected countries" is available on the Workbook but not on Users. Regular users keep view and
export rights on the modules they cannot edit, which means the configuration can never produce a user
who is unable to see the data they are responsible for. A **Capability Preview** panel beside the
matrix shows in plain language what a regular user will and will not be able to do once the change is
saved, which removes most of the guesswork from permission changes. Changes take effect immediately
and are written to the audit log.

Access for a regular user can also be restricted to a defined list of countries, so that a Regional or
Country Office colleague works only within their own countries. The restriction is applied in the API
layer, which means it governs every module consistently, including the Workbook, reports, quality
checks and every export, rather than being applied screen by screen where one path could be missed.

Where someone leaves a post or changes responsibilities, their access is withdrawn using
**Disable user** and can be restored later with **Enable user**, keeping all of their history and
authorship intact. The system will not allow the last remaining enabled administrator to be disabled
or moved to the Regular user role, so the platform cannot be left with nobody able to administer it.
In line with the requirements, DMS users are never deleted. User records are referenced by observation
authorship, version histories, rule and report ownership and audit entries, and removing a user would
break the traceability those references provide. There is therefore no delete action anywhere in the
module, and withdrawal of access is always achieved by disabling the account.

> **[SCREENSHOT 2 · `docs/assets/screenshots/02-users.png`]**
> Users list with inline role and status controls.
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current
> understanding. Not a final design, subject to revision following requirements finalization
> with WHO stakeholders.*

#### Setup and Configuration

The Setup module is where the Health Accounts team defines the vocabulary the rest of the system uses.
Each configurable component sits on its own tab within a consistent list and editor pattern, so the
interaction a user learns on one component applies to all of them. Every tab is addressable by its own
URL, which means a colleague can be sent straight to the right screen.

Configuration begins by importing the reference data already held in the warehouse, so the DMS starts
aligned with xMart rather than from an empty state. Later changes made in the DMS are written back to
xMart. The module manages **Countries** and their attributes, **Currencies**, **Classifications and
Categories**, **Crosses**, **Observation Metadata Fields** and **Formulas**, with values created,
edited and, where the requirements allow, disabled and enabled through the interface.

Several behaviours in this module are worth describing specifically. Columns in any component list can
be reordered by dragging the column headers, and the chosen order is remembered for that user across
sessions, which matters because different colleagues work with different attributes. Deleting a value
is permitted only where that value has never been used in any record, as the requirements state, so
before removing anything the system checks usage and, where the value is in use, reports where it is
used instead of simply refusing. Administrators can define new attributes for existing components and
edit component details, so the metadata model can be extended without a code change. Component values
and their attributes can be exported to a spreadsheet and imported again, which makes bulk maintenance
and offline review practical. For the spreadsheet handling in this module and elsewhere we recommend
**ClosedXML** or **EPPlus** on the server and **SheetJS** in the browser, with **CsvHelper** for CSV
work.

Country attributes can be flagged as available for grouping and filtering, which is what turns an
attribute such as WHO region, World Bank income group or OECD membership into a selectable
**Group of countries**. Because groups are defined once here, they appear everywhere a country
selection is offered, including quality check scope, report filters and workbook selection, and they
stay correct as membership changes.

The module also records the reporting schedule for each country, including due dates and focal point
details, which is what drives the dashboard's reporting round view and the due date reminders
described under Notifications. Each country and year carries a publishing status of **Not publish** or
**Ready to publish**, which can be set on a single record or applied in bulk to a selection, so an
entire round can be moved to publication readiness in one action.

Crosses deserve a note because they are easy to model incorrectly. A cross is not a separate kind of
record. It is an observation that carries values in more than one classification dimension at the same
time, which is exactly how the long format observation table in xMart represents it. Modelling crosses
this way keeps the Workbook, the Crosses tab and the warehouse structure consistent with one another.
Predefined crosses are configured centrally, and users can define additional custom crosses for their
own analysis. Metadata files already held in xMart are reachable from the DMS in the context of the
observation or country they relate to, so supporting documentation does not require leaving the
application.

> **[SCREENSHOT 3 · `docs/assets/screenshots/03-setup.png`]**
> Setup module showing the component tabs and a component list.
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current
> understanding. Not a final design, subject to revision following requirements finalization
> with WHO stakeholders.*

#### Workbook Management

The Workbook is the main working module of the DMS and the screen on which the Health Accounts team
will spend most of its time. The requirements describe it clearly: a format similar to Excel, in which
the values available for a country and year can be viewed and edited, formulas inserted, and copy,
paste and undo used as they would be in a spreadsheet, with the metadata behind each observation
reachable from the same place.

A workbook is a two dimensional view of a three dimensional dataset, formed by fixing one axis and
displaying the other two. A **Country Workbook** shows one country against many variables and many
years. A **Variable Workbook** shows one variable across many countries and many years. A
**Year Workbook** shows one year across many countries and many variables. The user chooses the type
and the scope, and the selection is reflected in the address of the page so that a particular view can
be bookmarked, returned to or shared with a colleague.

Years run across the top and variables down the side, following the convention the team already uses,
with a scale and currency selector above the grid so that figures can be read in the units the analyst
is thinking in. Reported values and calculated indicators are visually distinct: as the requirements
specify, formula cells are shown in a different colour and in italic, so a calculated figure is never
mistaken for one a country reported. The year header row, the variable label column and the corner
cell are all **frozen**, which means the context of a cell stays visible however far the user scrolls.
Scrolling itself is continuous and virtualized rather than paged, because paging a data entry surface
breaks range selection and makes copying a block of years across impossible.

Editing happens in place and follows spreadsheet conventions, so typing replaces, Enter and Tab commit
and move on, and Escape abandons the edit. Formulas can be typed directly into a cell and are
evaluated straight away, with every dependent indicator recalculating as soon as an input changes, so
the effect of a correction is visible immediately rather than after a refresh. Copying and pasting
works within a workbook and across workbooks, and the paste action distinguishes between pasting
**Values**, **Formulas** and **Metadata**, because in Health Accounts work those are three different
intentions. A multi level **Undo** and **Redo** stack covers edits, pastes, fills and bulk operations,
so a mistaken paste over a block of data is recoverable.

Filtering is available on any displayed element. Rather than a permanent row of dropdown boxes, active
filters appear as removable chips above the grid with an **Add filter** control beside them, so the
current filter set can be read at a glance and any one filter reopened or removed in a single action.
The filter state travels in the page address, which makes a filtered view shareable.

Metadata is reached from the grid itself. Cells that carry metadata are marked, and opening one opens
a panel **beside** the grid rather than over it. The grid stays loaded and the cell selection is
preserved, so reading a comment or checking a source does not cost the analyst their place in the
data. This is a deliberate departure from the legacy tool, where metadata lived on a separate sheet.
Editing metadata is subject to the same permissions, versioning and write back as editing a value.
Users can also choose which metadata fields are displayed and in what order, and that preference is
remembered.

The module provides the estimation tools the requirements ask for. **Fill gaps** completes missing
points between two existing values in a series, and **Extrapolate** extends a series backwards or
forwards, with the method chosen by the user. Observations produced this way are marked with the
appropriate estimation method and data type so their origin stays visible in exports and reports
afterwards. Alongside these, the workbook supports the calculation of standard indicators for all
countries, simple statistical values such as average, minimum and maximum across a selected group of
countries, and country specific formulas for estimation, which are saved for reuse.

Because the requirements are explicit that only one user may edit the same observations at a time, the
workbook applies a lock when editing begins. Other users keep read only access and are shown who holds
the lock and since when, rather than simply being refused. Locks are released on save, or after a
configurable interval once a session ends, and an administrator can release a lock that has been left
open. Workbook data can be exported to Excel with values exported as values and formulas exported as
formulas, so an exported workbook remains a working document. Quality check rules can also be run
directly from the workbook against the data in view, with failing cells highlighted where they sit.

> **[SCREENSHOT 4 · `docs/assets/screenshots/04b-workbook-metadata.png`]**
> Workbook with frozen headers, filter chips, calculated rows shown distinctly, and the metadata panel open beside the grid.
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current
> understanding. Not a final design, subject to revision following requirements finalization
> with WHO stakeholders.*

#### Formula Management and Calculation Engine

The calculation engine is the technical heart of the DMS. The indicators it produces are published
through the Global Health Expenditure Database and the Global Health Observatory, so correctness here
is not a quality attribute of the component, it is the whole point of it. We treat the engine as a
distinct piece of engineering rather than a feature of the Workbook, and we build it rather than adapt
a spreadsheet engine, for four reasons that come directly from the requirements.

First, Health Accounts formulas refer to variables, not to cells. An expression such as
`CHE = HF.1 + HF.2 + HF.3 + HF.4 + HF.nec` names classification categories that are resolved for the
current country and year. Second, formulas refer to other formulas. `CHE%GDP` depends on `CHE`, which
in turn depends on the HF categories, so evaluation needs a dependency graph resolved in the right
order with cycles detected, not text substitution. Third, every formula carries its own condition for
handling missing values. The indicator table in the requirements attaches a condition to each one:
some require all components to be present, others at least one. When a condition is not met the result
must be blank and not zero, because a zero asserts that expenditure was nil while a blank says it is
unknown, and that difference is visible in every published figure. Fourth, a predefined formula must be
adjustable for one country without changing it for any other, so the engine resolves the applicable
definition per country at the point of evaluation.

The engine is built as a tokenizer, a parser producing a syntax tree, a dependency graph over the
referenced variables, and an evaluator that walks that graph in dependency order. Cycles are caught
when a formula is saved rather than when it is run, so an invalid formula cannot be committed in the
first place. Variable codes in this domain contain full stops, percent signs, currency symbols and
hyphens, as in `CHE%GDP_SHA2011` and `GGHE-D_pc_US$_SHA2011`, so references are resolved against the
known set of variables rather than by guessing where a token ends, which is a common and quiet source
of error. For the grammar we recommend **ANTLR** where a formally specified grammar is preferred, or a
hand written recursive descent parser where a small and fully owned implementation is more
appropriate. We would avoid general purpose expression libraries for the core engine, since none of
them carry per country overrides or the null handling conditions this domain requires.

Administrators manage the predefined indicators on the **Formulas** tab in Setup, each with its
expression, its condition for missing values, its unit of measure and its folder grouping. A predefined
formula can be edited, and a **Country Override** can be created that applies to one country alone.
Regular users can write their own formulas and save them for reuse, and these pass through exactly the
same parsing, validation and cycle checking.

Because the engine holds an explicit dependency graph, the application can show a user why a figure is
what it is. A **Formula Inspector** panel presents the expression, the inputs it resolved to, the
condition that was applied, and the chain of other indicators that will change if an input changes.
For a system whose outputs are published internationally, being able to explain a number is as
important as calculating it.

> **[SCREENSHOT 5 · `docs/assets/screenshots/05-formulas.png`]**
> Formula management with the predefined indicator formulas and their conditions.
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current
> understanding. Not a final design, subject to revision following requirements finalization
> with WHO stakeholders.*

#### Quality Checks

The Quality Checks module is how the team satisfies itself that a dataset is fit to publish. It holds a
library of rules, the means to run them over a chosen scope, and a report of what they found.

Rules are grouped by type, with a separate group for a user's own customized rules. Rules created by
the development team during implementation, rules created by administrators and rules created by
individual users are visually distinct from one another, as the requirements ask, so the standing of a
rule is clear from the list rather than having to be looked up.

We will implement the predefined rule categories the requirements describe, with the final list
confirmed by the technical unit at project start and the examples in the requirements as the starting
point. These cover year on year growth in absolute and relative terms, growth between two versions of
the data, observations that are new, that have disappeared or that are missing compared with previous
reporting, inconsistency between categories where components should reconcile to their total,
inconsistency between tables, atypical entries raised either as an error or as a warning, and outliers
assessed across groups of countries.

The thresholds that decide whether a rule passes, fails or raises a warning are set by administrators
on a **Thresholds** screen rather than fixed in code, so the team can tune sensitivity as the data and
their expectations change, without waiting for a release. Rules apply to every country by default, and
an administrator can exclude specific countries where a rule is not meaningful for them, then
**Reset exclusions** to make the rule universal again. Exclusions are shown on the rule itself, so an
excluded country is never quietly left unchecked.

A rule is run against a single country or against a group of countries chosen by attribute, using the
same groups configured in Setup. The full year end run across all countries executes as a background
job with visible progress, restart and retry, so a long run can be watched and recovered rather than
simply waited on. Rules can also be triggered from a workbook against the data currently in view, with
failing cells highlighted in place, which closes the gap between finding a problem and fixing it: the
analyst does not have to carry a finding from a report back into the data by hand.

Each run produces a report presenting findings by rule, by country and by severity, with charts
alongside the tabular detail and a download in Excel or CSV. Every finding links directly to the
observation that produced it. Rule configurations can be exported and imported, which supports review
outside the system and moving a configuration between environments.

> **[SCREENSHOT 6 · `docs/assets/screenshots/06-quality-checks.png`]**
> Quality check rule library, with rule origin visually distinguished.
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current
> understanding. Not a final design, subject to revision following requirements finalization
> with WHO stakeholders.*

#### Reports and Analytics

The Reports module produces the outputs the team needs for internal review, quality assurance and
preparing the year's publication.

Administrators define reports in an interactive builder. Available fields, including countries and
their attributes, years, classifications and categories, variables and indicators, and metadata
fields, are dragged into **Rows**, **Columns**, **Filters** and **Values** areas to form a
multi dimensional view. The Values area takes the aggregations of the observation measure, and
subtotals can be switched on at any grouping level. A live preview updates as the definition changes,
so a report is designed against real output rather than against an abstract specification. Saved
reports become available to everyone. In line with the requirements the builder is an administrator
function: regular users open predefined reports, apply filters and export the results.

A regular user can also create customized reports that are visible only to themselves, and any user
can copy an existing report as the basis for a new one, which is usually the quickest route to a
variant of an established output. Users arrange reports into their own list, mark **Favourites** and
set the order, so a working set is always at hand.

The module includes data tracking reports covering what has been received, what has changed and what
is still outstanding across the reporting round, which supports the follow up process configured in
Setup.

Although the interface itself is in English, reports can be generated with variable labels in any of
the six official WHO languages: English, French, Spanish, Arabic, Chinese and Russian. Column
headings, classification and indicator labels, totals and unit strings all appear in the chosen
language, on screen and in the exported file. Field values that are proper names, such as country and
currency names, report titles and free text metadata, stay as recorded, which is the carve out the
requirement itself makes. We use **i18next** for the language resources, kept outside the code so that
a label correction or an additional language is a configuration change. One point we flag openly:
Arabic introduces a right to left consideration for tabular output, and we address the layout of
mirrored tables during design rather than discovering it at delivery.

Reports export to Excel. Where the scope of a report makes generation slow, it runs as a background job
so the user can carry on working, and an in app notification arrives on completion with a link to the
file, or on failure with the reason. Job progress and history are visible in the module.

Unit handling in this module is treated as a matter of correctness rather than formatting. Health
Accounts values are expressed in national currency units, in US dollars or as percentages, so
conversion is applied to each observation before aggregation, and the unit label carries the country's
own currency rather than a generic one. Where the contributions to a total arrived in more than one
currency, the report produces no figure at all, because adding pesos to yen is meaningless and an
anonymous unit label would let exactly that mistake through looking perfectly correct.

> **[SCREENSHOT 7 · `docs/assets/screenshots/07-report-builder.png`]**
> Report builder with the field areas and live preview.
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current
> understanding. Not a final design, subject to revision following requirements finalization
> with WHO stakeholders.*

#### Data and Metadata Versioning

Versioning is built on the data versioning available in xMart, as the requirements direct, rather than
on a parallel history kept in the DMS. Every committed change to an observation, a dataset or a
metadata field produces a version carrying its author and the time it was made.

Users with the appropriate rights can view up to ten previous versions of an observation or variable
and compare them, with differences in value and in metadata shown side by side so that what changed,
when and by whom is legible at a glance. From the same screen a previous version can be selected and
restored as the current value. Administrators can additionally restore a full dataset as at a specific
date, which is the recovery path when a bulk operation has produced an unintended result.

Restoration is itself recorded as a version, so history is never rewritten. Restoring an earlier value
adds a new entry describing that restoration rather than removing the entries in between, which keeps
the record complete for audit purposes. Version comparison also feeds the quality check category
concerned with growth between two versions of the data, so versioning serves validation as well as
recovery.

> **[SCREENSHOT 8 · `docs/assets/screenshots/08-version-history.png`]**
> Version history for a single observation, with restore.
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current
> understanding. Not a final design, subject to revision following requirements finalization
> with WHO stakeholders.*

#### Notifications

The Notifications module provides the event driven, in application notifications the requirements
describe.

Notifications are raised on defined events: a country's submission arriving, a reporting due date
approaching or passing, a background report or quality check finishing or failing, a dataset moving to
**Ready to publish**, a version being restored, or a configuration or permission change being applied.
A predefined set is delivered with the system, based on the list the technical unit provides at project
start.

Administrators create and edit notifications, setting the event that triggers each one and the
countries or groups of countries it applies to for each user. Because the groups are the same ones
configured in Setup, a subscription such as "all countries in the African Region" is expressed once
and stays correct as the membership of that group changes. Users control what reaches them through
**Notification Preferences**, choosing the countries and variables they care about, so that colleagues
receive what is relevant to their responsibilities rather than every event in the system.

Notifications are delivered in the application and highlighted on the dashboard, with an unread count
in the header. Where a notification refers to something the user can open, such as a completed report
or a quality check result, it carries a working link to it. The reporting due dates configured in Setup
raise reminders as dates approach and pass, which is what turns the follow up configuration into an
active process rather than a reference table someone has to remember to consult.

> **[SCREENSHOT 9 · `docs/assets/screenshots/09-notifications.png`]**
> Notifications module: event catalogue and subscriptions.
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current
> understanding. Not a final design, subject to revision following requirements finalization
> with WHO stakeholders.*

#### Integration with WHO xMart

Integration with xMart is not a feature at the edge of this system. It is the mechanism by which the
system holds its data, and the requirements define the exchange in both directions.

> **[FIGURE 3 · `docs/assets/figure3-xmart-integration.png`]**
> DMS and xMart integration model.

Whenever the DMS needs to display or process Health Accounts information it retrieves that information
from xMart through the secured xMart API. This covers observations for the Workbook, the configuration
behind the Setup module, the data underlying reports and quality checks, and version information.
Retrieval is designed to ask only for what the screen needs, filtered by country, year range and the
variables in scope, so that opening a workbook fetches one bounded slice rather than a country's entire
history. Where a request genuinely spans a large volume, such as a year end quality check or a
multi country report, retrieval is paged and processed incrementally in the background. Throughout,
the distinction the requirements draw is preserved: values arrive as values and formulas arrive as
formulas, so a calculated cell reaches the DMS as an expression to evaluate rather than as a fixed
number.

Changes made in the DMS are returned to xMart so that the warehouse stays authoritative. This covers
observation values and metadata edited in the Workbook, and changes made in Setup to countries,
currencies, classifications, categories, crosses, metadata fields and formulas. Each write back carries
the identity of the user who made the change, as the requirements specify, and again keeps values as
values and formulas as formulas.

The requirements leave the trigger for write back to be agreed at the start of the project, offering a
save action or simply leaving a screen as the possibilities. Our recommendation is an explicit
**Save**, with a clearly marked unsaved changes state on the screen. It gives the analyst a defined
point at which work is committed, it makes a concurrent editing conflict detectable at a known moment,
and it produces a version history whose entries correspond to deliberate decisions rather than to
incidental navigation. We will confirm this with WHO during design. From the user's point of view a
save either succeeds completely or reports a failure naming the observations affected, and a failed
transmission is queued for retry with the outcome visible to the user and to administrators.

Alongside consuming the xMart API, the DMS exposes a data retrieval API that xMart calls to extract DMS
data. We will implement this to the specification in the API requirements: HTTP GET requests, CSV as
the default output with JSON available as well, filtering on country code and on a single year or year
range, the DMS internal identifier returned on every row, server side paging designed around the
reference page size of one hundred thousand records, a UTC LastModified value that can be filtered by
range and that reflects inserts, updates and deletes alike, retrieval of soft deleted records through
an IsDeleted filter, the ability to return all data unfiltered, streamed responses for large
extractions, OAuth 2.0 authentication and HTTPS only transport.

Two of those items are treated as first class design requirements rather than reporting conveniences,
because xMart cannot perform reliable incremental extraction without them. Every path in the
application that modifies data updates the LastModified value, and deletion is implemented as a change
of state rather than a physical removal, so a record that disappears from the DMS can still be
identified as deleted by a caller that asks for it.

For administrators the module also provides operational visibility. **Sync Status** shows, per source
and per direction, when data was last retrieved, when changes were last written back, what is pending
and what has failed. An **API Call Log** records requests to and from xMart with their outcome,
duration and payload size, so an integration problem can be diagnosed from evidence rather than
reconstructed. Failed exchanges are queued, retried according to policy and escalated by notification
when retries are exhausted. Background jobs covering quality check runs, report generation and bulk
exports are monitored from the same place.

Finally, the requirements ask that functionality be implemented within the xMart platform itself
wherever doing so saves effort and cost, and state that WHO will give credit to solutions that use
xMart technology even partially. We have taken this into account in shaping the architecture. We
propose to use xMart for the storage and data model of observations, metadata and configuration, rather
than replicating that structure in the DMS; for native data versioning, on which the version history
and restore functions are built; for format validation and transformation on ingestion, which the
process map already places in xMart; for views and derived structures where a view is cheaper and
faster than an equivalent query assembled in the application; for holding the legacy formulas imported
from the old system as metadata; and for onboarding and updating model definitions through the xMart
Model Uploader, a capability our team has already used in production on the WHO Emergency Public
Dashboard. The interactive and rule driven functionality, meaning the Workbook, the calculation engine,
the quality check engine, the report builder, user and permission management, notifications, job
orchestration and the retrieval API, is implemented in the DMS, where that kind of logic belongs. Our
existing familiarity with the xMart OData API and the Model Uploader means this assessment can be
confirmed and refined quickly during discovery rather than being settled after development has started.

> **[SCREENSHOT 10 · `docs/assets/screenshots/10-integration.png`]**
> xMart integration: synchronisation status and the API call log.
>
> *Indicative prototype view illustrating the proposed design based on Argusoft's current
> understanding. Not a final design, subject to revision following requirements finalization
> with WHO stakeholders.*

#### Legacy Data and Formula Migration

The legacy DMS holds the Health Accounts history the new system needs to be able to consult, together
with approximately seventy thousand formulas in its Microsoft SQL Server database. Argusoft will manage
the migration of this content into the agreed xMart and DMS target structures as a controlled and
reconciled process rather than a single transfer.

We begin by profiling the legacy schema, its data quality and its formula syntax, and producing a
source to target mapping agreed with WHO. Extraction takes the latest version of each record and each
formula, in line with the requirement that only the latest version is migrated. Transformation maps
legacy identifiers onto the classification and category codes in use in the new system. Loading places
the data in xMart, with the legacy formulas stored as plain text metadata fields so that each is
available for inquiry from the new DMS against the observations it relates to.

The formulas are then translated into working formulas in the new DMS. The calculation engine described
earlier is what makes this systematic rather than manual: because it parses an expression into a syntax
tree instead of treating it as text, converting a legacy formula is a matter of re-expressing a parsed
structure in the new syntax. The conversion is carried out together with the WHO Health Accounts team,
whose knowledge of the legacy formula population is what allows individual cases to be settled
authoritatively, and each converted formula is validated by comparing its computed result against the
legacy result for the same country and year.

Reconciliation produces record counts, control totals and an exception report naming any formula that
needs individual attention and why, so that anything outstanding is a known and jointly managed list
rather than a silent gap. The migration is run at least twice in a non production environment before
the production run, so that the reconciliation report rather than the cutover is where problems come to
light, and a documented rollback position is established before the production run begins. WHO signs
off against the reconciliation evidence before cutover.

#### Additional Features

Report output is available with variable labels in the six official WHO languages, as described under
Reports and Analytics. Language resources are held outside the application code using **i18next**, so
adding a language or correcting a label does not require a code change. Labels are translated while
codes, unit keys and stored filter values stay canonical, which matters because a translated unit key
would stop the currency checks in the reporting engine comparing like with like.

The application will be developed to meet the applicable WHO accessibility requirements, covering
keyboard navigation, focus order, form labelling, colour contrast and compatibility with assistive
technology. We treat this as a design constraint from the first wireframe rather than as remediation at
the end, because the two components hardest to make accessible, the workbook grid and the report
builder, cannot be retrofitted cheaply. Both are designed for full keyboard operation, and the workbook
reinforces its use of colour with typography so that the distinction between reported and calculated
cells does not depend on colour alone. Accessibility checks run automatically in the build using
**axe-core**, alongside manual testing with a screen reader.

The application supports the browsers and viewport sizes agreed with WHO, verified by cross browser
testing with **Playwright**. Layouts are responsive across desktop and laptop sizes. The Workbook, being
a dense data entry surface, is designed for desktop use, which reflects how the team actually works.

Every data change, configuration change, permission change, quality check run, report generation and
integration event is written to an audit trail carrying the user's identity, a timestamp and a
description of the action. Administrators reach it through a searchable and filterable
**Audit Log** view. Logs are structured using **Serilog** and can be shipped to a central platform
such as the **ELK stack** or Azure Monitor for retention and analysis.

#### Security Features

Security is described in detail under *Approach* earlier in this proposal, and the points below cover
how it appears in the design of the solution itself.

Authentication is delegated entirely to WHO Entra ID, so the application holds no passwords and
inherits WHO's own account policies, including multi factor authentication. Authorization is enforced
in the API layer, covering role permissions and country restrictions together, which means it cannot be
bypassed by manipulating the client. All traffic runs over HTTPS, and the data retrieval API that xMart
calls is protected with OAuth 2.0.

Data is encrypted in transit and at rest using WHO approved Azure services and configurations, with
keys held in **Azure Key Vault** and separated from the application. Uploaded files are validated for
type and size and scanned for malware using the security scan API WHO provides, and a file that fails
either check is rejected before it reaches storage.

The application is built following OWASP secure coding practices, with input validation, output
encoding, parameterised queries and secure session handling applied throughout, and least privilege
applied to every service account. Our development process includes static application security testing,
software composition analysis and dependency scanning, secret scanning, and dynamic application
security testing before release. Open source tooling we use for this includes **OWASP ZAP** for dynamic
scanning, **OWASP Dependency-Check** or **Trivy** for dependency and container analysis, and
**Gitleaks** for secret detection, alongside the commercial tooling in our standard pipeline.

### Proposed Technology Stack

At Argusoft we take a technology agnostic approach when selecting tools and platforms. Each technology
has its own strengths, and our aim is to choose the ones that best fit the objectives of the solution,
WHO's existing enterprise environment, the capabilities of the xMart platform, and the ability of WHO's
own teams to maintain the system after handover. The final stack will be confirmed with WHO during the
solution design phase and recorded in the System Design Document.

Below is the recommended technology stack for this project.

**Frontend Framework**

React with TypeScript, or Angular. A component driven framework suited to a data dense administrative
application. TypeScript is recommended because the multi dimensional data model and the formula syntax
tree benefit considerably from static typing, which catches a class of error that would otherwise
surface as a wrong number.

**Data Grid and UI Libraries**

AG Grid Community or react-datasheet-grid for the Workbook, providing range selection, keyboard
navigation, copy and paste and frozen panes. TanStack Table for list grids, TanStack Query for server
state, dnd-kit for drag interactions, and Apache ECharts or Chart.js for visualization. All are open
source with permissive licensing.

**Backend Technologies**

.NET (C#), Python, Java or Node.js. All four support secure REST APIs, robust background processing
and enterprise integration, and all four have mature libraries for the work this system does, including
spreadsheet generation, scheduled jobs and OData consumption. .NET aligns with WHO's existing Microsoft
platform estate and with our own delivery experience on WHO applications including ENAPHS, JEE Reporting
and EWARS, so it is the option we would put forward first. Final selection will depend on the hosting
environment and WHO's preference for long term maintenance, and we are equally comfortable delivering
in any of the four.

**Database Engine**

Microsoft SQL Server, MySQL or PostgreSQL for the DMS local database. All three are mature relational
engines with the indexing, transactional integrity and retention behaviour required for operational
data, the audit log and the job queue. SQL Server aligns naturally with the WHO Azure environment and
with the Microsoft platform experience WHO already holds in house, which is why we list it first.

**Data Warehouse**

WHO xMart, unchanged, as the authoritative store for Health Accounts data, accessed through its
secured API.

**Caching and Background Processing**

Redis for distributed caching of reference data. Hangfire or Quartz for durable background jobs, giving
persistent queues, retry and progress monitoring for year end quality checks, report generation and
migration processing.

**Reporting and Export**

ClosedXML or EPPlus for server side Excel generation, SheetJS for browser side export, and CsvHelper
for CSV handling. These support the requirement that values are exported as values and formulas as
formulas.

**Integration and Security**

xMart API over OData, REST with OpenAPI documentation through Swagger, OAuth 2.0 and HTTPS, WHO Entra ID
for single sign on including guest accounts, and Azure Key Vault for secret management. Serilog and
OpenTelemetry for logging and tracing.

**Localization and Accessibility**

i18next for report label resources in the six official WHO languages, and axe-core for automated
accessibility verification.

**Testing**

xUnit, JUnit or Jest for unit testing, Playwright for end to end and cross browser testing, and k6 for
performance testing.

**Platform**

Microsoft Azure, provided by WHO, on Linux or Windows hosting as agreed, with Azure DevOps pipelines and
Infrastructure as Code through Terraform or Bicep.

Three principles guide these choices. Alignment with WHO's environment takes precedence over our own
preference, because a stack WHO's teams can maintain after handover is worth more than a marginally
superior one they cannot. Licensing is a selection criterion, so components carrying commercial or
restrictive licences are avoided where a permissively licensed equivalent exists, keeping WHO's
ownership of the delivered source code unencumbered. And the xMart platform is used wherever it can do
the work, in line with the requirement to develop within xMart where that saves effort and cost.

### Hosting

Argusoft will establish and operate the **Development** environment using vendor provided
infrastructure. WHO will provide and host the **UAT** and **Production** environments within WHO Azure.
Sprint deliverables are deployed to UAT for verification by WHO experts, and approved releases are then
promoted to Production, with any defect found during a sprint fixed within that sprint or the next.

As required by the Terms of Reference, we will prepare a **Hardware Requirement Proposal** during the
design phase specifying the Azure resources needed for UAT and Production, covering compute, database,
storage, caching, networking and monitoring components, sized against the expected data volumes, the
year end processing peak and the agreed availability objectives.

Cloud resources are added, removed and configured through Infrastructure as Code and DevOps pipelines,
so that environments are reproducible and every configuration change is version controlled and
auditable. Deployment is automated through pipelines covering build, automated testing, security
scanning and release, with a documented rollback position for every release.

We will provide 24x7 automated monitoring of server performance and system accessibility, together with
environment alerting and SSL certificate expiry monitoring with timely renewal, so that a lapsed
certificate never becomes a cause of downtime. Troubleshooting and configuration adjustments are carried
out as needed, and we will contact Microsoft on WHO's behalf for any Azure subscription or
infrastructure issue and obtain resolution and root cause analysis. Support and Maintenance reports are
submitted monthly, recording the changes and troubleshooting performed on the UAT and Production
environments.

Backup and restoration procedures are established against recovery objectives agreed with WHO and
tested before production readiness.

On completion we hand over the complete source code, the database technical description including
relational schema, data types and table structures, the system architecture documentation, the
deployment and infrastructure definitions, the user and administrator guides, and any applicable third
party licence keys, so that WHO holds full ownership and the practical ability to maintain and extend
the system.

---

## Notes for review — not part of the proposal text

**Delete this section before inserting into the .docx.**

### What changed in this revision

- **Structure now follows the reference proposal.** *Proposed Solution* → *Solution Overview* →
  *Front-end*, *API*, *Data Access Layer*, *Important Modules*, then one subsection per module, then
  *Proposed Technology Stack* and *Hosting*.
- **The three layer sections reuse the reference proposal's wording**, adjusted for this project. The
  reference text had "three distinct components - the data (model)"; the dash became a colon.
- **All use case and requirement numbers removed** from the prose. Requirements are now referred to in
  words, which also reads more naturally.
- **No dashes used anywhere in the text.** House style follows the reference proposal, which writes
  "role based", "web based", "single page" without hyphens. Hyphens remain only where the reference
  itself keeps them (n-tier, Front-end, Model-View-Controller, Object-Relational Mapping) and in
  product names.
- **Named open source libraries throughout**, matching how the reference proposal names ClosedXML,
  Chart.js and i18next inside its module descriptions. The stack section stays technology agnostic and
  offers options, as the reference does.
- **UI elements and feature names in bold**: **Add filter**, **Ready to publish**, **Fill gaps**,
  **Extrapolate**, **Save**, **Undo**, **Country Override**, **Formula Inspector**, **Sync Status**,
  **API Call Log**, **Audit Log**, and others.
- **Assumptions added** under *Important Modules*, as requested.

### Decisions taken

- **Working Prototype paragraph added** at the end of *Solution Overview*, before the Functional
  Landscape figure. It names the hosted URL and states plainly that the prototype reflects our current
  understanding, is not the delivered product, and will be updated during requirements finalization
  based on stakeholder input and WHO approval.
- **Figures keep their use case and requirement labels for now.** Note that this leaves the figures
  carrying references the prose no longer uses. Regenerating them without those labels is a small
  change whenever you want it.
- **Proposed Technology Stack and Hosting stay as Heading 3** under *Proposed Solution*, rather than
  being promoted to Heading 2 as in the reference proposal.
- **Ten screenshots**, one per module that has a screen in the prototype. The Annex 3 retrieval API
  view is covered inside the Integration screenshot.

### Figures and screenshots

All captured. Figures are in `docs/assets/`, screenshots in `docs/assets/screenshots/`, taken from
the hosted prototype in light theme at 3200x2000 pixels, signed in as DMS Administrator. Re-run with
`node docs/diagrams/capture-screenshots.mjs`.

Ten are placed in the text. Five more were captured and are available if you would rather use them,
or want a second image in a section:

| Spare | Shows |
|---|---|
| `02b-role-permissions.png` | The role permission matrix with the capability preview |
| `04-workbook.png` | The workbook without the metadata panel, so the grid is wider |
| `06b-quality-report.png` | A quality check findings report rather than the rule list |
| `07b-reports-list.png` | The reports list with favourites, instead of the builder |
| `10b-retrieval-api.png` | The data retrieval API screen with a generated request and CSV output |

### Still open

1. **The prototype prints use case codes on screen in a few places.** The version history dialog in
   `08-version-history.png` reads "up to 10 prior versions (UC044)". Since the prose no longer carries
   use case numbers, a reader may notice the inconsistency. Three options: leave it, crop the caption
   line out of that screenshot, or remove the codes from the prototype UI and recapture. Recapturing
   is about fifteen minutes of work.
2. **Development Timeline** remains empty, as agreed.
