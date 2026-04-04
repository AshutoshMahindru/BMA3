# Repo vs SpecOS Analysis
> Generated: 4 April 2026

## Overall Health

| Check | Result |
|---|---|
| `spec-compliance.py` | **COMPLIANT** — 9/9, 0 warnings |
| `specos/validate_specos.py` | **PASS** — 0 errors, 0 warnings |
| Test suite | **118/118 passing** |
| Wave status | Wave 5 **PARTIAL** (3 items remain) |

---

## API Layer — 4 Spec Endpoints Still Missing

Spec declares **128 endpoints** across 11 router groups. **10 routers are now registered** in `api/src/server.ts`, and the full `/api/v1/reference` group is live. The remaining fully absent router group is `/api/v1/ai`:

| Router | Spec Endpoints | Status |
|---|---|---|
| `/api/v1/ai` | 4 POST endpoints | **Not implemented** — no router file, no registration |

### Missing `/ai` endpoints
- `POST /api/v1/ai/edit-suggestions`
- `POST /api/v1/ai/analyze`
- `POST /api/v1/ai/explain`
- `POST /api/v1/ai/research-draft`

> Note: the compliance script currently reports **110 code routes with spec coverage**. That count reflects the route extractor’s view of implemented code paths, not a direct “128 minus missing endpoints” formula.

---

## Frontend — 9 Missing Pages + 8 Naming Mismatches

Spec defines **30 screens**. Actual has **21** `page.tsx` files.

### 8 Naming / Path Mismatches (page exists, slug differs from spec route)

| Spec route slug | Actual dir | Issue |
|---|---|---|
| `cash-flow` | `cashflow/` | hyphen dropped |
| `capital-strategy` | `capital/` | truncated |
| `simulation` | `simulations/` | pluralised |
| `alerts` | `triggers/` | renamed |
| `summary` | `confidence/` | different name |
| `approvals` | `governance/` | merged into one page |
| `memory` | `governance/` | merged into one page |
| `home` | `.` (dashboard root) | path difference only |

### ~10 True Gaps (no page file of any kind)

| Spec screen | Expected path |
|---|---|
| Demand Assumptions | `web/app/dashboard/assumptions/demand/` |
| Cost Assumptions | `web/app/dashboard/assumptions/cost/` |
| Funding Assumptions | `web/app/dashboard/assumptions/funding/` |
| Working Capital Assumptions | `web/app/dashboard/assumptions/working-capital/` |
| Scenario Comparison Console | `web/app/dashboard/analysis/compare/` |
| Scope Dimension Editors | `web/app/dashboard/scope/formats/` |
| Scope Review Surface | `web/app/dashboard/scope/review/` |
| Compute Center | `web/app/dashboard/compute/center/` |
| Scenario Wizard | `web/app/wizard/scenario/start/` |
| AI SME overlays (×2) | UI overlays — no page component |

> The combined `dashboard/assumptions/page.tsx` covers all four assumption sub-pages as tabs, so those 4 are arguably intentional consolidation rather than true gaps.

---

## Wave 5 Remaining Items

| Item | Status |
|---|---|
| `db/migrations/` tooling (node-pg-migrate) | **NOT_STARTED** |
| `tests/e2e/dashboard.test.ts` (Playwright) | **NOT_STARTED** |
| Full `docker-compose` stack (Redis, worker) | **PARTIAL** — Postgres only |

---

## Computation Graph

- All **14 nodes / 18 steps** implemented and verified — no gaps.
- All **73 variables / 35 metrics** from `variable_registry.json` are covered by compute nodes per test suite.

---

## Database

- All **50 entities** from `canonical_schema.json` are in DDL.
- 4 migrations landed (`001`–`004`): schema reconciliation, unique constraints, decision rationales, canonical-alias backfill.

---

## Gap Summary

| Category | Gap count | Severity |
|---|---|---|
| Missing API routers (`/ai`) | 4 endpoints | Medium — AI helper features are still absent |
| Missing/mismatched frontend pages | ~10 true gaps | Low–Medium — core finance screens all exist |
| Wave 5 infrastructure | 3 items | Low — CI is green, tooling/E2E only |
| Spec/actual slug naming divergence | 8 mismatches | Low — functional, but traceability matrix links break |
