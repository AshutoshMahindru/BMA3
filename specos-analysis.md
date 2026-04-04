# Repo vs SpecOS Analysis
> Updated: 5 April 2026

## What Changed Since 4 April

| Item | Before | Now |
|---|---|---|
| `/api/v1/reference` router | Missing | **Implemented** — `reference.ts`, all 8 endpoints live and registered |
| `/api/v1/ai` router | Missing | **Implemented** — `ai.ts`, all 4 advisory endpoints live and registered |
| Test count | 117 | **123** (+6 contract/integration tests on top of earlier route coverage) |
| Playwright dashboard smoke | **3/3** | **7/7** (scenario compare, scope editors, scope review, compute center, executive AI SME, P&L AI SME, wizard) |
| AI SME overlays | Missing | **Implemented** — advisory overlays live in `executive/page.tsx` and `pnl/page.tsx` |
| Compliant code routes | 107 | **114** |

---

## Overall Health

| Check | Result |
|---|---|
| `spec-compliance.py` | **COMPLIANT** — 9/9, 0 warnings, 0 failures |
| `specos/validate_specos.py` | **PASS** — 0 errors, 0 warnings |
| Jest suite | **123/123 passing** |
| Playwright E2E | **7/7 passing** |
| Wave status | Wave 5 **DONE** — compose-hosted runtime verified |

---

## API Coverage: Route Surface Fully Closed

**Spec: 128 — Implemented: 128 — Gap: 0**

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
| `ai.ts` | 4 | 4 | 0 ✅ new |

Route-count and core route behavior are now aligned across the assumptions surface: sets, packs, pack apply, family reads/writes, and overrides all persist against the canonical assumption-pack tables in [api/src/routes/v1/assumptions.ts](/Users/ashutoshmahindru/.codex/worktrees/d206/BME/api/src/routes/v1/assumptions.ts).

---

## Frontend: 26 dashboard pages plus root landing page

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

### Canonical route aliases live for slug-drift surfaces

| Canonical slug | Actual dir | Note |
|---|---|---|
| `cash-flow` | `cashflow/` | Canonical path resolves via `web/next.config.mjs` rewrite |
| `capital-strategy` | `capital/` | Canonical path resolves via `web/next.config.mjs` rewrite |
| `simulation` | `simulations/` | Canonical path resolves via `web/next.config.mjs` rewrite |

### Remaining frontend gaps

| Gap type | Surface |
|---|---|
| Consolidated into one tabbed page | Demand / Cost / Funding / Working Capital assumptions live inside `assumptions/page.tsx` |

---

## Computation Graph — Implemented and Exercised

| Area | Spec | Implemented |
|---|---|---|
| Compute nodes | 14 | 14 |
| Execution steps | 18 | 18 |
| Variables | 73 | 73 |
| Metrics | 35 | 35 |

The real orchestrator runs in the integration suite, and the live async queue path is now also proven on both the host-run and compose-hosted stacks. The golden harness still directly seeds **34** canonical assumption bindings rather than asserting one-by-one coverage for all **73** variables or all **35** metrics.

---

## Database — Fully Covered

- All **50 entities** from `canonical_schema.json` present in DDL.
- 6 migrations landed: `001` schema reconciliation → `002` unique constraints → `003` decision rationale upserts → `004` canonical-alias backfill → `005` canonical assumption-pack/bootstrap seed → `006` seeded opening-balance reconciliation.

---

## Wave 5 Closure Status

| Item | Status |
|---|---|
| `db/migrations/` tooling (node-pg-migrate) | **DONE** — root scripts + `scripts/migrate.mjs` + baseline scaffold |
| `tests/e2e/dashboard.test.ts` (Playwright) | **DONE** — scenario compare, scope editors, scope review, compute center, executive AI SME, P&L AI SME, and wizard smoke flows |
| Full `docker-compose` stack (Redis, worker) | **DONE** — `docker compose up -d` boots Postgres + Redis + API + worker + web locally; a compose-hosted queued compute run completes all 18 steps |

---

## Prioritised Gap List

No remaining prioritized SpecOS parity gaps are currently tracked. The last
runtime cleanup item was the seeded base-scenario reconciliation issue, which is
now handled by migration
[`006-reconcile-seeded-opening-balances.sql`](/Users/ashutoshmahindru/.codex/worktrees/d206/BME/db/migrations/006-reconcile-seeded-opening-balances.sql).
