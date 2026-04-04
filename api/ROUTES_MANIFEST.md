# BMA3 SpecOS API Routes — Build Manifest

Generated: 2026-04-04
Source: `specos/artifacts/api_contracts.json` + `specos/artifacts/canonical_schema.json`

## Files Created

| File | Namespace | Endpoints | Tables Used |
|------|-----------|-----------|-------------|
| `src/routes/v1/context.ts` | `/api/v1/context` | 17 | companies, scenarios, plan_versions, planning_calendars, planning_periods, pnl_projections, compute_validation_results, compute_runs |
| `src/routes/v1/assumptions.ts` | `/api/v1/assumptions` | 17 | assumption_sets, assumption_packs, assumption_pack_bindings, assumption_field_bindings, assumption_override_log, plan_versions |
| `src/routes/v1/financials.ts` | `/api/v1/financials` | 7 | pnl_projections, cashflow_projections, balance_sheet_projections, unit_economics_projections, planning_periods, compute_runs |
| `src/routes/v1/compute.ts` | `/api/v1/compute` | 11 | compute_runs, compute_run_steps, compute_validation_results, compute_run_artifacts, compute_dependency_snapshots, plan_versions, assumption_field_bindings, assumption_packs, assumption_sets |
| `src/server.ts` | — | Updated | Registers all 4 new route modules |

**Total: 52 endpoints**

## Context Routes (17)

| Method | Path | Contract ID | Description |
|--------|------|-------------|-------------|
| GET | /context/companies | api_context_001 | List companies |
| POST | /context/companies | api_context_002 | Create company |
| GET | /context/companies/:companyId | api_context_003 | Get company by ID |
| PATCH | /context/companies/:companyId | api_context_004 | Update company |
| GET | /context/companies/:companyId/calendars | api_context_005 | List calendars |
| POST | /context/companies/:companyId/calendars | api_context_006 | Create calendar |
| GET | /context/planning-periods | api_context_007 | List planning periods |
| GET | /context/scenarios | api_context_008 | List scenarios |
| POST | /context/scenarios | api_context_009 | Create scenario |
| POST | /context/scenarios/:scenarioId/clone | api_context_010 | Clone scenario |
| PATCH | /context/scenarios/:scenarioId | api_context_011 | Update scenario |
| GET | /context/versions | api_context_012 | List versions |
| POST | /context/versions | api_context_013 | Create version |
| GET | /context/versions/:versionId | api_context_014 | Get version by ID |
| POST | /context/versions/:versionId/freeze | api_context_015 | Freeze version |
| POST | /context/versions/:versionId/publish | api_context_016 | Publish version |
| GET | /context/overview | api_context_017 | Shell overview read-model |

## Assumption Routes (17)

| Method | Path | Contract ID | Description |
|--------|------|-------------|-------------|
| GET | /assumptions/sets | api_assumptions_001 | List assumption sets |
| POST | /assumptions/sets | api_assumptions_002 | Create assumption set |
| GET | /assumptions/sets/:assumptionSetId | api_assumptions_003 | Get set by ID |
| PATCH | /assumptions/sets/:assumptionSetId | api_assumptions_004 | Update set |
| GET | /assumptions/packs | api_assumptions_005 | List assumption packs |
| POST | /assumptions/packs | api_assumptions_006 | Create pack |
| POST | /assumptions/packs/:packId/apply | api_assumptions_007 | Apply pack to set |
| GET | /assumptions/demand | api_assumptions_008 | List demand assumptions |
| PUT | /assumptions/demand/bulk | api_assumptions_009 | Bulk update demand |
| GET | /assumptions/cost | api_assumptions_010 | List cost assumptions |
| PUT | /assumptions/cost/bulk | api_assumptions_011 | Bulk update cost |
| GET | /assumptions/funding | api_assumptions_012 | List funding assumptions |
| PUT | /assumptions/funding/bulk | api_assumptions_013 | Bulk update funding |
| GET | /assumptions/working-capital | api_assumptions_014 | List working capital |
| PUT | /assumptions/working-capital/bulk | api_assumptions_015 | Bulk update working capital |
| GET | /assumptions/overrides | api_assumptions_016 | List overrides |
| POST | /assumptions/overrides | api_assumptions_017 | Create override |

## Financial Routes (7)

| Method | Path | Contract ID | Description |
|--------|------|-------------|-------------|
| GET | /financials/executive-summary | api_financials_001 | Executive summary KPIs |
| GET | /financials/pnl | api_financials_002 | P&L projection |
| GET | /financials/cash-flow | api_financials_003 | Cash flow projection |
| GET | /financials/balance-sheet | api_financials_004 | Balance sheet projection |
| GET | /financials/unit-economics | api_financials_005 | Unit economics breakdown |
| GET | /financials/funding-summary | api_financials_006 | Funding summary |
| GET | /financials/capital-strategy | api_financials_007 | Capital strategy view |

## Compute Routes (11)

| Method | Path | Contract ID | Description |
|--------|------|-------------|-------------|
| POST | /compute/validations | api_compute_001 | Run validation |
| GET | /compute/validations/:validationId | api_compute_002 | Get validation status |
| GET | /compute/validations/:validationId/issues | api_compute_003 | List validation issues |
| POST | /compute/runs | api_compute_004 | Start compute run (BullMQ) |
| GET | /compute/runs | api_compute_005 | List compute runs |
| GET | /compute/runs/:runId | api_compute_006 | Get run by ID |
| POST | /compute/runs/:runId/cancel | api_compute_007 | Cancel run |
| GET | /compute/runs/:runId/steps | api_compute_008 | List run steps |
| GET | /compute/runs/:runId/results | api_compute_009 | Get run results |
| GET | /compute/dependencies | api_compute_010 | Dependency graph |
| GET | /compute/freshness | api_compute_011 | Freshness check |

## Key Design Decisions

1. **Column names**: All SQL references use canonical_schema.json column names exactly (e.g., `default_currency` not `base_currency`, `fiscal_year_start_month` not `fiscal_year_start`).

2. **Parameterized queries**: All values use `$1, $2, ...` placeholders — zero string interpolation.

3. **Response envelope**: Every response uses `{ data, meta: { freshness: { source, timestamp } } }`.

4. **Error codes**: Match api_contracts.json error registry (COMPANY_NOT_FOUND, VERSION_FROZEN, etc.).

5. **Tenant extraction**: Uses `req.headers['x-tenant-id']` (Wave 5 moves to JWT).

6. **Version freeze guard**: All mutating assumption/compute endpoints check version status before writes.

7. **Compute runs**: POST /compute/runs inserts a `status: 'queued'` record and attempts BullMQ queue (graceful fallback if Redis unavailable).

8. **Assumption family mapping**: Demand = product+market, Cost = capacity+operations, Funding = funding, Working-capital = operations (via assumption_family on assumption_packs).

9. **Financial pivoting**: Raw metric rows from projection tables are pivoted into `{ periods, lineItems }` structure matching the API contract response shape.
