# BMA3 Migration Plan — From Scaffolding to SpecOS-Driven

> **Current state:** Governance scaffolding in place (AGENTS.md, CODEGEN.md, submodule, CI hooks, compliance checker). Zero generated code. All 15 CODEGEN targets are MISSING.
>
> **Target state:** Every code file traces to a SpecOS artifact. Compliance checker passes. CI gate is blocking.

---

## Inventory: What Exists vs What's Needed

### Exists (keep/evolve)
| Asset | Lines | Quality | Action |
|---|---|---|---|
| `db/01-schema.sql` | 265 | 8/10 — professional DDL | Reconcile with SpecOS `ddl.sql` |
| `db/02-seed.sql` | ~120 | Good (UAE pizza concept) | Fix UUID formats, align scenario IDs |
| `api/src/routes/v1/*.ts` (20 files) | 1,283 | 3/10 — column mismatches | Discard, regenerate from SpecOS |
| `api/src/jobs/index.ts` | 196 | 3/10 — commented out, hardcoded | Discard, rebuild as compute nodes |
| `api/src/server.ts` | 85 | 5/10 — decent skeleton | Keep shell, add middleware |
| `web/app/dashboard/*.tsx` (22 pages) | 4,493 | 7/10 — polished UI | Keep shells, rewire data layer |
| `web/app/dashboard/layout.tsx` | 326 | 7/10 — good nav | Keep, update route config |
| `web/lib/api.ts` | 208 | 4/10 — manual fetch | Replace with generated client |
| `web/lib/use-api-data.ts` | 98 | Has fallback pattern | Replace with strict API-only hook |
| `web/lib/planning-context.tsx` | 121 | Hardcoded enums | Rewire to real API |

### Missing (to generate)
| Target | Source Artifact | Priority |
|---|---|---|
| `api/src/types/entities.ts` | `canonical_schema.json` | P0 |
| `api/src/types/enums.ts` | `canonical_schema.json` enum_types | P0 |
| `api/src/types/api.ts` | `api_contracts.json` | P0 |
| `api/src/schemas/*.ts` | `canonical_schema.json` | P0 |
| `api/src/middleware/validate.ts` | Zod integration | P0 |
| `api/src/middleware/tenant.ts` | JWT extraction | P1 |
| `api/src/middleware/auth.ts` | JWT verification | P2 |
| `api/src/routes/v1/*.ts` (rebuilt) | `api_contracts.json` | P0 |
| `api/src/compute/orchestrator.ts` | `computation_graph.json` | P1 |
| `api/src/compute/nodes/*.ts` (14 files) | `variable_registry.json` + `computation_graph.json` | P1 |
| `web/lib/api-client.ts` | `api_contracts.json` | P0 |
| `web/lib/types/*.ts` | `api_contracts.json` | P0 |
| `db/migrations/*.sql` | Diff of `01-schema.sql` vs SpecOS `ddl.sql` | P0 |
| `tests/integration/*.test.ts` | `test_fixtures.json` | P1 |
| `tests/api/*.test.ts` | `api_contracts.json` | P1 |

---

## Migration Waves

### Wave 1: Foundation (Types + Schema + Validation)
**Goal:** Generate the type system that everything else builds on.
**No runtime behavior changes.** Just new files.

| Step | What | Input | Output | Verification |
|---|---|---|---|---|
| 1.1 | Generate TypeScript entity interfaces | `canonical_schema.json` → 50 entities | `api/src/types/entities.ts` | `tsc --noEmit` passes |
| 1.2 | Generate TypeScript enum types | `canonical_schema.json` → enum_types | `api/src/types/enums.ts` | Enums match DDL CREATE TYPE |
| 1.3 | Generate Zod schemas (insert + update) | `canonical_schema.json` → fields/constraints | `api/src/schemas/*.ts` (one per entity) | Zod parse against seed data succeeds |
| 1.4 | Generate API request/response types | `api_contracts.json` → 128 endpoints | `api/src/types/api.ts` | `tsc --noEmit` passes |
| 1.5 | Generate frontend shared types | `api_contracts.json` → response shapes | `web/lib/types/*.ts` | `tsc --noEmit` passes |
| 1.6 | Generate typed API client | `api_contracts.json` → endpoints | `web/lib/api-client.ts` | Functions exist for all 128 endpoints |
| 1.7 | Create validation middleware | Zod schemas | `api/src/middleware/validate.ts` | Rejects invalid payloads with 400 |
| 1.8 | Schema reconciliation | Diff `01-schema.sql` vs SpecOS `ddl.sql` | `db/migrations/001-reconcile.sql` | Migration applies cleanly |

**Gate:** `tsc --noEmit` passes in both `api/` and `web/`. Schema migration applies to fresh DB. Compliance checker shows 0 failures on checks 1-3.

**Estimated effort:** 1-2 sessions

---

### Wave 2: First Vertical Slice (Planning → P&L)
**Goal:** One complete end-to-end path working with real data. The "proof it works" wave.

**Slice:** Company + Scenario + Assumptions → Compute → P&L display

| Step | What | Input | Output | Verification |
|---|---|---|---|---|
| 2.1 | Rebuild context API routes (companies, scenarios, versions, calendars, periods) | `api_contracts.json` context stage | `api/src/routes/v1/context/*.ts` | curl returns real DB data |
| 2.2 | Rebuild assumption API routes (sets, demand-drivers, price-plans) | `api_contracts.json` assumptions stage | `api/src/routes/v1/assumptions/*.ts` | curl returns real DB data |
| 2.3 | Build compute orchestrator | `computation_graph.json` execution_plan | `api/src/compute/orchestrator.ts` | Orchestrator runs 18 steps in order |
| 2.4 | Build compute nodes 1-7 (planning spine → revenue → CM waterfall) | `variable_registry.json` + `computation_graph.json` | `api/src/compute/nodes/` (7 files) | Golden fixture test passes |
| 2.5 | Rebuild financial API routes (P&L, executive summary) | `api_contracts.json` financials stage | `api/src/routes/v1/financials/*.ts` | curl returns computed P&L |
| 2.6 | Enable BullMQ worker | orchestrator + nodes | `api/src/server.ts` (uncomment + rewire) | POST /compute/runs triggers real computation |
| 2.7 | Rewire P&L page | `traceability.json` P&L screen binding | `web/app/dashboard/pnl/page.tsx` | Page shows live computed data |
| 2.8 | Rewire Executive page | `traceability.json` Executive screen binding | `web/app/dashboard/executive/page.tsx` | Page shows live computed data |
| 2.9 | Fix PlanningContext | Real API for company/scenario/period | `web/lib/planning-context.tsx` | UUID scenario IDs, real data |
| 2.10 | Remove use-api-data fallback pattern | Direct API calls | `web/lib/use-api-data.ts` | Delete or rewrite without silent fallback |
| 2.11 | Golden fixture integration test | `test_fixtures.json` | `tests/integration/compute-pipeline.test.ts` | Input → compute → output matches fixture |

**Gate:** Start server. Select scenario. Run compute. P&L page shows live numbers that match the golden fixture trace. DataFreshness badge shows "Live". Compliance checks 4-6 pass.

**Estimated effort:** 3-5 sessions (highest risk — the compute engine)

---

### Wave 3: Remaining Compute Nodes
**Goal:** Complete the computation DAG (nodes 8-14).

| Step | What | Node | Output |
|---|---|---|---|
| 3.1 | Capex/Opex → EBITDA → EBIT → Net Income | `node_capex_opex` | `api/src/compute/nodes/capex-opex.ts` |
| 3.2 | Working capital movement | `node_working_capital` | `api/src/compute/nodes/working-capital.ts` |
| 3.3 | Cash flow → Burn → Runway | `node_burn_runway` | `api/src/compute/nodes/burn-runway.ts` |
| 3.4 | Balance sheet | `node_balance_sheet` | `api/src/compute/nodes/balance-sheet.ts` |
| 3.5 | Unit economics + breakeven + returns | `node_unit_economics` | `api/src/compute/nodes/unit-economics.ts` |
| 3.6 | Sensitivity + Monte Carlo (real) | `node_sensitivity_risk` | `api/src/compute/nodes/sensitivity-risk.ts` |
| 3.7 | Confidence + DQI | `node_confidence` | `api/src/compute/nodes/confidence.ts` |

**Gate:** Full 18-step computation runs end-to-end. Golden fixture passes on both test cases (loss month + profit month). No hardcoded constants remain.

**Estimated effort:** 2-3 sessions (use blind-deposit verification for formulas)

---

### Wave 4: Remaining API + Frontend Rewiring
**Goal:** All 128 endpoints live. All 22 pages on real data.

| Step | What | Scope |
|---|---|---|
| 4.1 | Rebuild remaining API routes | Scope, decisions, analysis, confidence, governance, AI overlay | 
| 4.2 | Rewire remaining dashboard pages | Balance sheet, cash flow, risk, simulation, confidence, governance, etc. |
| 4.3 | Delete orphaned simulation page | `/dashboard/simulations/` (duplicate) |
| 4.4 | Fix seed data | Correct UUID formats in `03-risk-seed.sql` |

**Gate:** Every page fetches from API. No `sc_base_001` string IDs anywhere. No static fallback data. Compliance check 5 passes.

**Estimated effort:** 2-3 sessions

---

### Wave 5: Infrastructure + Hardening
**Goal:** Production-ready.

| Step | What |
|---|---|
| 5.1 | JWT auth middleware (`api/src/middleware/auth.ts`) |
| 5.2 | Tenant extraction from JWT (`api/src/middleware/tenant.ts`) |
| 5.3 | Structured logging (pino) — replace all console.* |
| 5.4 | Complete docker-compose (add api + web services) |
| 5.5 | Database migration tooling (node-pg-migrate) |
| 5.6 | API contract tests (`tests/api/contracts.test.ts`) |
| 5.7 | Playwright E2E tests (`tests/e2e/dashboard.test.ts`) |
| 5.8 | Flip compliance checker to blocking in CI |

**Gate:** Full CI green. Compliance checker: 0 failures, 0 warnings. `docker-compose up` runs the full stack.

**Estimated effort:** 2-3 sessions

---

## Summary

| Wave | Scope | Sessions | Risk | What Changes |
|---|---|---|---|---|
| 1. Foundation | Types + schemas + validation + API client | 1-2 | Low | New files only, no behavior changes |
| 2. First Slice | Planning → Compute → P&L end-to-end | 3-5 | **High** | Compute engine built, 2 pages go live |
| 3. Compute | Remaining 7 nodes | 2-3 | Medium | Full financial model operational |
| 4. Rewire | All APIs + all pages | 2-3 | Low | Bulk rewiring, pattern established in Wave 2 |
| 5. Harden | Auth, logging, tests, CI gate | 2-3 | Low | Non-functional requirements |

**Total: 10-16 sessions**

---

## Compliance Checker Milestones

| After Wave | Expected Compliance |
|---|---|
| Current (pre-migration) | 3 pass, 7 warn, 16 fail |
| Wave 1 | 5 pass, 5 warn, 6 fail (types exist, schemas exist) |
| Wave 2 | 7 pass, 3 warn, 2 fail (compute works, P&L live) |
| Wave 3 | 8 pass, 2 warn, 0 fail (all compute, no hardcoded constants) |
| Wave 4 | 9 pass, 1 warn, 0 fail (all pages live) |
| Wave 5 | 9 pass, 0 warn, 0 fail → **flip to blocking** |

---

## Verification Strategy Per Wave

**Wave 1 (Foundation):** Static checks only — `tsc --noEmit`, Zod schema validation against seed data.

**Wave 2 (First Slice):** Golden fixture test — the numbers either match or they don't. Use blind-deposit verification for the compute nodes (two independent implementations, arbiter resolves against SpecOS formulas).

**Wave 3 (Compute):** Extend golden fixture to cover both test cases in `test_fixtures.json`. Balance sheet identity check (Assets = Liabilities + Equity).

**Wave 4 (Rewire):** Playwright screenshots — every page renders with real data, DataFreshness shows "Live".

**Wave 5 (Harden):** Full CI pipeline: SpecOS validation → spec compliance → lint → type check → build → tests. All green = blocking gate.
