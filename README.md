# WHO Health Accounts DMS — Prototype

Front-end-only React prototype of a Health Accounts Data Management System, built as part of
the technical proposal for **RFP PFD-2026-001** (WHO HQ / HSD / PFD / Performance, Planning
and Economics).

Its purpose is to demonstrate the RFP's **Pilot scope** — 41 of 64 use cases — as a
clickable, data-driven simulation. There is no backend: xMart is mocked behind a single
client interface, and seeded data is derived deterministically so every run is identical.

## Start here

**→ [HANDOVER.md](HANDOVER.md)** — current state, how to run it, what to build next.

| Document | Purpose |
|---|---|
| [HANDOVER.md](HANDOVER.md) | Where the work stands and what to pick up |
| [CLAUDE.md](CLAUDE.md) | The durable rules — read before writing code |
| [PROTOTYPE_PLAN.md](PROTOTYPE_PLAN.md) | Requirements analysis, tech-stack rationale, 8-phase roadmap, demo script |
| [DEPENDENCIES.md](DEPENDENCIES.md) | Every package, its version, and why that version |

## Quick start

```bash
cd dms-prototype
npm ci
npm run dev          # http://localhost:5173
```

Sign in with either demo identity; the header role switcher toggles Administrator / Regular
user to demonstrate the permission model.

```bash
npx tsc -b           # typecheck
npm test             # 46 unit tests
npm run build        # production build
```

## Layout

```
Prototype/
├── Requirements/        RFP source documents (.docx) — READ-ONLY
├── Reference/           WHO JEE Reporting design pack — READ-ONLY, source of all design tokens
└── dms-prototype/       The application
    ├── src/domain/      Pure logic: types, formula engine, QC rules. No React, no stores.
    ├── src/data/        Seeds, generators, and the mock xMart client
    ├── src/modules/     One folder per RFP module
    ├── src/components/  Layout, shared grids and pickers, shadcn/ui primitives
    └── scripts/         Browser verification harnesses (npm run verify:*)
```

## Status

Phases 0–2 of 8 complete: app shell with light/dark theming, domain model with a mock xMart
client, and the Setup module (all 7 component tabs). Phase 3 — the formula engine — is next.

Full status and the use-case coverage matrix are in [HANDOVER.md](HANDOVER.md) §2.
