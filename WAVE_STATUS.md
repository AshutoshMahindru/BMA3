# Wave Status Tracker

> Machine-readable migration state. Updated after major merged milestones.
> Read by agents to know what is actually done, what is partially landed, and
> what still must be completed to satisfy the SpecOS wave gates.
> For artifact → code-file mapping, see `CODEGEN.md`.

## Status Semantics

- **DONE**: the target exists and the wave gate for that area is considered met
- **IN_PROGRESS**: meaningful merged work exists, but the wave gate is not met
- **GENERATED**: scaffold/codegen output exists, but it is not yet validated to the wave gate
- **PARTIAL**: only part of the target surface is live
- **NOT_STARTED**: no meaningful merged work yet

## Current Wave: 2 (First Slice) — IN PROGRESS

## Baseline Snapshot

Merged stabilization through commit `bd66c3a` means the repo is no longer at the
original Wave 1-only state:

- Canonical route modules are live in `api/src/routes/v1/` for `context`,
  `assumptions`, `financials`, `compute`, and a partial `analysis` bridge
- Core finance screens are already rewired to `web/lib/api-client.ts`
- `risk` and `simulations` are also rewired to canonical routes
- Local runtime is PostgreSQL-only by default with `npm run smoke:canonical`
- Remaining active legacy frontend boundary is primarily `dashboard/markets`
  plus `web/lib/api.ts` / `web/lib/use-api-data.ts`

This shortens the front of Waves 2-4, but it does **not** automatically satisfy
their acceptance gates.

## Wave Status

| Wave | Status | Risk | Gate | Current Reality |
|---|---|---|---|---|
| 1. Foundation | **DONE** | Low | `tsc --noEmit` passes both `api/` and `web/` | Delivered and merged |
| 2. First Slice | **IN_PROGRESS** | High | Golden fixture passes, P&L page shows live data | Routes and finance UI are live, but golden-fixture gate is not met |
| 3. Compute | **GENERATED** | Medium | Full 18-step DAG runs, both fixtures pass | Orchestrator and node files exist, but DAG acceptance is not met |
| 4. Rewire | **IN_PROGRESS** | Low | All pages live, no static fallback, no string IDs | Most finance/risk screens live; `markets` and assumptions refactor remain |
| 5. Harden | **PARTIAL** | Low | Full CI green, compliance blocking, `docker-compose up` runs full stack | Canonical smoke exists, but auth/logging/blocking compliance are not done |

## Verification Strategy

| Wave | Method |
|---|---|
| 1. Foundation | Static checks: `tsc --noEmit`, Zod parse against seed data |
| 2. First Slice | Golden fixture test: input → compute → output matches `test_fixtures.json`. Use blind-deposit verification for compute nodes. |
| 3. Compute | Extended golden fixture (both test cases). Balance sheet identity: Assets = Liabilities + Equity. |
| 4. Rewire | Page-level verification: every dashboard page renders from canonical APIs, `DataFreshness` shows live on all non-preview surfaces, and legacy fallback files can be deleted. |
| 5. Harden | Full CI pipeline green, canonical smoke green, compliance checker blocking with 0 errors / 0 warnings, and `docker-compose up` runs the intended stack. |

## File Generation Tracker

### Wave 1: Foundation (types + schemas + validation + API client)
| Target | Status | Generated From |
|---|---|---|
| `api/src/types/entities.ts` | **DONE** | `canonical_schema.json` — generated and present |
| `api/src/types/enums.ts` | **DONE** | `canonical_schema.json` enum types — generated and present |
| `api/src/types/api.ts` | **DONE** | `api_contracts.json` — generated and present |
| `api/src/schemas/*.ts` | **DONE** | `canonical_schema.json` — generated and present |
| `api/src/middleware/validate.ts` | **DONE** | Zod validation middleware — merged and used |
| `web/lib/api-client.ts` | **DONE** | `api_contracts.json` — generated and present |
| `web/lib/types/api.ts` | **DONE** | `api_contracts.json` — generated and present |
| `db/migrations/001-reconcile-with-specos.sql` | **DONE** | Schema reconciliation migration — present |

### Wave 2: First Vertical Slice (planning → compute → P&L)
| Target | Status | Generated From |
|---|---|---|
| `api/src/routes/v1/context.ts` | **DONE** | `api_contracts.json` context |
| `api/src/routes/v1/assumptions.ts` | **DONE** | `api_contracts.json` assumptions |
| `api/src/routes/v1/financials.ts` | **DONE** | `api_contracts.json` financials |
| `api/src/compute/orchestrator.ts` | **GENERATED** | `computation_graph.json` |
| `api/src/compute/nodes/planning-spine.ts` | **GENERATED** | node 1 |
| `api/src/compute/nodes/scope-bundle.ts` | **GENERATED** | node 2 |
| `api/src/compute/nodes/decisions.ts` | **GENERATED** | node 3 |
| `api/src/compute/nodes/assumption-packs.ts` | **GENERATED** | node 4 |
| `api/src/compute/nodes/demand-drivers.ts` | **GENERATED** | node 5 |
| `api/src/compute/nodes/revenue-stack.ts` | **GENERATED** | node 6 |
| `api/src/compute/nodes/contribution-stack.ts` | **GENERATED** | node 7 |
| `web/app/dashboard/pnl/page.tsx` (rewire) | **DONE** | `traceability.json` |
| `web/app/dashboard/executive/page.tsx` (rewire) | **DONE** | `traceability.json` |
| `web/lib/planning-context.tsx` (rewire) | **DONE** | Real API |
| `tests/integration/compute-pipeline.test.ts` | **GENERATED** | `test_fixtures.json` |

### Wave 3: Remaining Compute Nodes (8-14)
| Target | Status | Generated From |
|---|---|---|
| `api/src/compute/nodes/capex-opex.ts` | **GENERATED** | node 8 |
| `api/src/compute/nodes/working-capital.ts` | **GENERATED** | node 9 |
| `api/src/compute/nodes/burn-runway.ts` | **GENERATED** | node 10 |
| `api/src/compute/nodes/balance-sheet.ts` | **GENERATED** | node 11 |
| `api/src/compute/nodes/unit-economics.ts` | **GENERATED** | node 12 |
| `api/src/compute/nodes/sensitivity-risk.ts` | **GENERATED** | node 13 |
| `api/src/compute/nodes/confidence.ts` | **GENERATED** | node 14 |

### Wave 4: Full Rewire (all APIs + all pages)
| Target | Status | Generated From |
|---|---|---|
| `api/src/routes/v1/analysis.ts` | **DONE** | `api_contracts.json` — comparisons, explainability, sensitivity, risk, simulation, alerts, portfolio |
| `api/src/routes/v1/scope/*.ts` | **NOT_STARTED** | `api_contracts.json` scope |
| `api/src/routes/v1/decisions/*.ts` | **NOT_STARTED** | `api_contracts.json` decisions |
| `api/src/routes/v1/confidence/*.ts` | **DONE** | `api_contracts.json` confidence |
| `api/src/routes/v1/governance/*.ts` | **DONE** | `api_contracts.json` governance |
| Core finance screens rewired | **DONE** | `traceability.json` |
| `web/app/dashboard/confidence/page.tsx` | **DONE** | `traceability.json` + confidence routes |
| `web/app/dashboard/governance/page.tsx` | **DONE** | `traceability.json` + governance routes |
| `web/app/dashboard/versions/page.tsx` | **DONE** | `traceability.json` + governance routes |
| `web/app/dashboard/decisions/page.tsx` | **DONE** | `traceability.json` + governance routes |
| `web/app/dashboard/triggers/page.tsx` | **DONE** | `traceability.json` + analysis/confidence routes |
| `web/app/dashboard/explainability/page.tsx` | **DONE** | `traceability.json` + analysis routes |
| `web/app/dashboard/scenario/page.tsx` | **DONE** | `traceability.json` + analysis routes |
| `web/app/dashboard/portfolio/page.tsx` | **DONE** | `traceability.json` + analysis routes |
| `web/app/dashboard/attractiveness/page.tsx` | **DONE** | `traceability.json` + analysis routes |
| `web/app/dashboard/risk/page.tsx` | **DONE** | canonical `analysis/risk` — live only, no static fallback |
| `web/app/dashboard/simulations/page.tsx` | **DONE** | canonical `analysis/simulation-runs` — live only, no static fallback |
| `web/app/dashboard/assumptions/page.tsx` | **PARTIAL** | preview shell only |
| `web/app/dashboard/markets/page.tsx` | **NOT_STARTED** | still on legacy fallback path |
| Delete `/dashboard/simulations/` duplicate | **NOT_STARTED** | audit finding |
| Fix `03-risk-seed.sql` UUID format | **DONE** | merged |

### Wave 5: Harden (auth, logging, tests, CI gate)
| Target | Status | Generated From |
|---|---|---|
| `api/src/middleware/auth.ts` | **NOT_STARTED** | JWT |
| `api/src/middleware/tenant.ts` | **NOT_STARTED** | JWT claims |
| Structured logging (pino) | **NOT_STARTED** | Replace console.* |
| Canonical smoke script + CI job | **DONE** | execution baseline |
| Complete docker-compose | **PARTIAL** | Postgres only; full stack services not added |
| `db/migrations/` tooling | **NOT_STARTED** | node-pg-migrate |
| `tests/api/contracts.test.ts` | **NOT_STARTED** | `api_contracts.json` |
| `tests/e2e/dashboard.test.ts` | **NOT_STARTED** | Playwright |
| Flip compliance to blocking CI | **NOT_STARTED** | Remove continue-on-error |

## Remaining Legacy Surface

These are the main files that still block a full Wave 4 completion:

- `web/app/dashboard/markets/page.tsx`
- `web/lib/api.ts`
- `web/lib/use-api-data.ts`
- preview-only assumptions workspace in `web/app/dashboard/assumptions/page.tsx`

## Compliance Snapshot

Last verified during Phase 5 execution:

- `python3 scripts/spec-compliance.py`
- Result: **COMPLIANT**
- Summary: 6 pass, 8 warnings, 0 failures

Warnings still include:

- temporary stub files in `web/lib/data/`
- `console.*` usage in production runtime / compute code
- outdated BullMQ-specific compliance heuristic

## Session Log

| Session | Date | Wave | What Was Done | Compliance After |
|---|---|---|---|---|
| 0 | 2026-04-04 | setup | Scaffolding: submodule, AGENTS.md, CODEGEN.md, compliance checker | 3 pass, 7 warn, 16 fail |
| 1 | 2026-04-04 | Wave 1 | Generated: entity interfaces, enums, Zod schema files, API types, typed API client, validation middleware, schema reconciliation migration | foundation delivered |
| 2 | 2026-04-04 | stabilization | Runtime alignment: fixed schema/seed drift, canonical context/assumptions/financials/compute routes live, seeded finance outputs, core finance screens rewired, canonical smoke path added | execution-green core slice |
| 3 | 2026-04-04 | stabilization | Retired BullMQ/Redis runtime path, added canonical analysis bridge, rewired risk and simulations, pruned legacy helpers | compliant, 0 failures |
| 4 | 2026-04-04 | status rebase | Rebased wave tracker to merged baseline through `bd66c3a`; marked generated vs live vs remaining work accurately | compliant, 0 failures |
| 5 | 2026-04-04 | Wave 4 | Executed SpecOS Phase 5 interpretation/trust slice: mounted analysis/confidence/governance routes, rewired confidence/governance/versions/decisions/triggers/explainability/scenario/portfolio/attractiveness, removed risk/simulation fallback behavior, and verified `api` + `web` production builds | compliant, 0 failures |
