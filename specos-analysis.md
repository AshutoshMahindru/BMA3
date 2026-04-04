# Repo vs SpecOS Analysis
> Updated: 5 April 2026

## What Changed Since 4 April

| Item | Before | Now |
|---|---|---|
| `/api/v1/reference` router | Missing | **Implemented** — `reference.ts`, all 8 endpoints live and registered |
| Test count | 117 | **118** (+1 contract test for reference routes) |
| Compliant code routes | 107 | **110** |

---

## Overall Health

| Check | Result |
|---|---|
| `spec-compliance.py` | **COMPLIANT** — 9/9, 0 warnings, 0 failures |
| `specos/validate_specos.py` | **PASS** — 0 errors, 0 warnings |
| Test suite | **118/118 passing** |
| Wave status | Wave 5 **PARTIAL** (3 items remain) |

---

## API Coverage: 4 Endpoints Still Missing

**Spec: 128 — Implemented: 124 — Gap: 4**

| Router file | Implemented | Spec | Gap |
|---|---|---|---|
| `context.ts` | 17 | 17 | 0 |
| `assumptions.ts` | 17 | 17 | 0 |
| `financials.ts` | 7 | 7 | 0 |
| `compute.ts` | 11 | 11 | 0 |
| `analysis.ts` | 9 | 9 | 0 |
| `scope.ts` | 13 | 13 | 0 |
| `decisions.ts` | 17 | 17 | 0 |
| `confidence.ts` | 13 | 13 | 0 |
| `governance.ts` | 12 | 12 | 0 |
| `reference.ts` | 8 | 8 | 0 ✅ new |
| `ai.ts` | 0 | 4 | **−4** (not created) |

### Gap — `/api/v1/ai` router (4 missing, entire router absent)

No `ai.ts` file exists and nothing is registered in `server.ts`.

| Method | Spec path |
|---|---|
| `POST` | `/api/v1/ai/edit-suggestions` |
| `POST` | `/api/v1/ai/analyze` |
| `POST` | `/api/v1/ai/explain` |
| `POST` | `/api/v1/ai/research-draft` |

---

## Frontend: 21 dashboard pages plus root landing page

Several earlier “mismatches” are now explicit canonical `dashboard_path` mappings in SpecOS, so they should be treated as aligned rather than drift.

### Canonical dashboard remaps (not mismatches)

| Spec screen | Canonical dashboard path | Actual page |
|---|---|---|
| Home / Global Planning Overview | `/dashboard` | `web/app/dashboard/page.tsx` |
| Confidence Tracker | `/dashboard/confidence` | `web/app/dashboard/confidence/page.tsx` |
| Driver Explainability | `/dashboard/explainability` | `web/app/dashboard/explainability/page.tsx` |
| Market Attractiveness Scoring | `/dashboard/attractiveness` | `web/app/dashboard/attractiveness/page.tsx` |
| Portfolio Optimization | `/dashboard/portfolio` | `web/app/dashboard/portfolio/page.tsx` |
| Risk Dashboard | `/dashboard/risk` | `web/app/dashboard/risk/page.tsx` |
| Triggers & Alerts | `/dashboard/triggers` | `web/app/dashboard/triggers/page.tsx` |
| Decision Memory | `/dashboard/decisions` | `web/app/dashboard/decisions/page.tsx` |
| Plan Version Manager | `/dashboard/versions` | `web/app/dashboard/versions/page.tsx` |
| Planning Governance Dashboard | `/dashboard/governance` | `web/app/dashboard/governance/page.tsx` |

### Remaining slug divergences — page exists, slug differs from canonical route

| Canonical slug | Actual dir | Note |
|---|---|---|
| `cash-flow` | `cashflow/` | hyphen dropped |
| `capital-strategy` | `capital/` | truncated |
| `simulation` | `simulations/` | pluralized |

### Remaining frontend gaps

| Gap type | Surface |
|---|---|
| Consolidated into one tabbed page | Demand / Cost / Funding / Working Capital assumptions live inside `assumptions/page.tsx` |
| Missing routed page | Scenario Comparison Console |
| Missing routed page | Scope Dimension Editors |
| Missing routed page | Scope Review Surface |
| Missing routed page | Compute Center |
| Missing routed page | Scenario Wizard |
| Missing overlay pattern | AI SME overlays (2) |

---

## Computation Graph — Implemented and Exercised

| Area | Spec | Implemented |
|---|---|---|
| Compute nodes | 14 | 14 |
| Execution steps | 18 | 18 |
| Variables | 73 | 73 |
| Metrics | 35 | 35 |

The real orchestrator runs in the integration suite, but the current golden harness directly seeds **34** canonical assumption bindings rather than asserting one-by-one coverage for all **73** variables or all **35** metrics.

---

## Database — Fully Covered

- All **50 entities** from `canonical_schema.json` present in DDL.
- 4 migrations landed: `001` schema reconciliation → `002` unique constraints → `003` decision rationale upserts → `004` canonical-alias backfill.

---

## Wave 5 Remaining Items

| Item | Status |
|---|---|
| `db/migrations/` tooling (node-pg-migrate) | **NOT_STARTED** |
| `tests/e2e/dashboard.test.ts` (Playwright) | **NOT_STARTED** |
| Full `docker-compose` stack (Redis, worker) | **PARTIAL** — Postgres only |

---

## Prioritised Gap List

| # | Gap | Effort |
|---|---|---|
| 1 | Create `api/src/routes/v1/ai.ts` + register in `server.ts` | Medium — only fully absent API router group remains |
| 2 | `dashboard/analysis/compare/` page | Medium |
| 3 | `dashboard/scope/formats/` + `scope/review/` pages | Medium |
| 4 | `dashboard/compute/center/` page | Low |
| 5 | Scenario Wizard (`wizard/scenario/start/`) | High — multi-step flow |
| 6 | Migration tooling (node-pg-migrate) | Low |
| 7 | Playwright E2E suite | High |
| 8 | Full docker-compose (Redis, worker) | Medium |
