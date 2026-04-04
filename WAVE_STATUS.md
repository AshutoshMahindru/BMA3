# Wave Status Tracker

> Machine-readable migration state. Updated after every session.
> Read by agents to know what's done, what's in progress, and what's next.
> For artifact → code-file mapping, see `CODEGEN.md`.

## Current Wave: 0 (Pre-Migration)

## Wave Status

| Wave | Status | Sessions | Risk | Gate | Compliance |
|---|---|---|---|---|---|
| 1. Foundation | NOT_STARTED | 1-2 | Low | `tsc --noEmit` passes, schemas validate against seed | 3/9 → 5/9 |
| 2. First Slice | NOT_STARTED | 3-5 | **High** | Golden fixture passes, P&L page shows live data | → 7/9 |
| 3. Compute | NOT_STARTED | 2-3 | Medium | Full 18-step DAG runs, both fixtures pass | → 8/9 |
| 4. Rewire | NOT_STARTED | 2-3 | Low | All pages live, no static fallback, no string IDs | → 9/9 |
| 5. Harden | NOT_STARTED | 2-3 | Low | Full CI green, compliance blocking, docker-compose up works | 9/9 → blocking |

## Verification Strategy

| Wave | Method |
|---|---|
| 1. Foundation | Static checks: `tsc --noEmit`, Zod parse against seed data |
| 2. First Slice | Golden fixture test: input → compute → output matches `test_fixtures.json`. Use blind-deposit verification for compute nodes. |
| 3. Compute | Extended golden fixture (both test cases). Balance sheet identity: Assets = Liabilities + Equity. |
| 4. Rewire | Playwright screenshots: every page renders live data, DataFreshness shows "Live". |
| 5. Harden | Full CI pipeline green. `docker-compose up` runs the full stack. Compliance checker: 0 errors, 0 warnings. |

## File Generation Tracker

### Wave 1: Foundation (types + schemas + validation + API client)
| Target | Status | Generated From |
|---|---|---|
| `api/src/types/entities.ts` | NOT_STARTED | `canonical_schema.json` |
| `api/src/types/enums.ts` | NOT_STARTED | `canonical_schema.json` enum_types |
| `api/src/types/api.ts` | NOT_STARTED | `api_contracts.json` |
| `api/src/schemas/*.ts` | NOT_STARTED | `canonical_schema.json` |
| `api/src/middleware/validate.ts` | NOT_STARTED | Zod integration |
| `web/lib/api-client.ts` | NOT_STARTED | `api_contracts.json` |
| `web/lib/types/*.ts` | NOT_STARTED | `api_contracts.json` |
| `db/migrations/001-reconcile.sql` | NOT_STARTED | Diff 01-schema.sql vs ddl.sql |

### Wave 2: First Vertical Slice (planning → compute → P&L)
| Target | Status | Generated From |
|---|---|---|
| `api/src/routes/v1/context/*.ts` | NOT_STARTED | `api_contracts.json` context |
| `api/src/routes/v1/assumptions/*.ts` | NOT_STARTED | `api_contracts.json` assumptions |
| `api/src/routes/v1/financials/*.ts` | NOT_STARTED | `api_contracts.json` financials |
| `api/src/compute/orchestrator.ts` | NOT_STARTED | `computation_graph.json` |
| `api/src/compute/nodes/planning-spine.ts` | NOT_STARTED | node 1 |
| `api/src/compute/nodes/scope-bundle.ts` | NOT_STARTED | node 2 |
| `api/src/compute/nodes/decisions.ts` | NOT_STARTED | node 3 |
| `api/src/compute/nodes/assumption-packs.ts` | NOT_STARTED | node 4 |
| `api/src/compute/nodes/demand-drivers.ts` | NOT_STARTED | node 5 |
| `api/src/compute/nodes/revenue-stack.ts` | NOT_STARTED | node 6 |
| `api/src/compute/nodes/contribution-stack.ts` | NOT_STARTED | node 7 |
| `web/app/dashboard/pnl/page.tsx` (rewire) | NOT_STARTED | `traceability.json` |
| `web/app/dashboard/executive/page.tsx` (rewire) | NOT_STARTED | `traceability.json` |
| `web/lib/planning-context.tsx` (rewire) | NOT_STARTED | Real API |
| `tests/integration/compute-pipeline.test.ts` | NOT_STARTED | `test_fixtures.json` |

### Wave 3: Remaining Compute Nodes (8-14)
| Target | Status | Generated From |
|---|---|---|
| `api/src/compute/nodes/capex-opex.ts` | NOT_STARTED | node 8 |
| `api/src/compute/nodes/working-capital.ts` | NOT_STARTED | node 9 |
| `api/src/compute/nodes/burn-runway.ts` | NOT_STARTED | node 10 |
| `api/src/compute/nodes/balance-sheet.ts` | NOT_STARTED | node 11 |
| `api/src/compute/nodes/unit-economics.ts` | NOT_STARTED | node 12 |
| `api/src/compute/nodes/sensitivity-risk.ts` | NOT_STARTED | node 13 |
| `api/src/compute/nodes/confidence.ts` | NOT_STARTED | node 14 |

### Wave 4: Full Rewire (all APIs + all pages)
| Target | Status | Generated From |
|---|---|---|
| Remaining API routes (scope, decisions, analysis, confidence, governance) | NOT_STARTED | `api_contracts.json` |
| Remaining 20 dashboard pages rewired | NOT_STARTED | `traceability.json` |
| Delete `/dashboard/simulations/` duplicate | NOT_STARTED | Audit finding |
| Fix `03-risk-seed.sql` UUID format | NOT_STARTED | Audit finding |

### Wave 5: Harden (auth, logging, tests, CI gate)
| Target | Status | Generated From |
|---|---|---|
| `api/src/middleware/auth.ts` | NOT_STARTED | JWT |
| `api/src/middleware/tenant.ts` | NOT_STARTED | JWT claims |
| Structured logging (pino) | NOT_STARTED | Replace console.* |
| Complete docker-compose | NOT_STARTED | Add api + web services |
| `db/migrations/` tooling | NOT_STARTED | node-pg-migrate |
| `tests/api/contracts.test.ts` | NOT_STARTED | `api_contracts.json` |
| `tests/e2e/dashboard.test.ts` | NOT_STARTED | Playwright |
| Flip compliance to blocking CI | NOT_STARTED | Remove continue-on-error |

## Session Log

| Session | Date | Wave | What Was Done | Compliance After |
|---|---|---|---|---|
| 0 | 2026-04-04 | setup | Scaffolding: submodule, AGENTS.md, CODEGEN.md, compliance checker | 3 pass, 7 warn, 16 fail |
