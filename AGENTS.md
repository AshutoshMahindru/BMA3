# AGENTS.md — BMA3 Food Business Modelling Engine

## Before You Start Coding

1. Read `WAVE_STATUS.md` — know which wave is active and what's already done
2. Read this file — conventions and rules
3. Read `CODEGEN.md` — which artifact generates which file
4. Check the target file in WAVE_STATUS.md — confirm it's NOT_STARTED or IN_PROGRESS
5. After completing work, update `WAVE_STATUS.md`: mark targets DONE, add session log entry
6. Run `python3 scripts/spec-compliance.py` — report the result

## Architecture

- **Stack:** Next.js 14 (App Router) + Express + PostgreSQL 15 + BullMQ + Redis
- **API:** Express REST at `/api/v1/`, response envelope: `{data, meta: {freshness, governance}}`
- **Compute:** BullMQ worker executes 18-step DAG from `specos/artifacts/computation_graph.json`
- **Frontend:** Next.js dashboard with AG Grid, Tailwind CSS, dark navy/teal theme
- **Database:** Multi-tenant via `tenant_id` on every table, soft-delete via `is_deleted`

## Canonical Spec

All code traces to SpecOS artifacts in `specos/artifacts/`:

| What you need | Open this file |
|---|---|
| Entity schema / column names | `specos/artifacts/canonical_schema.json` (50 entities) |
| API endpoints / request-response | `specos/artifacts/api_contracts.json` (128 endpoints) |
| Variables / formulas | `specos/artifacts/variable_registry.json` (73 vars, 35 metrics) |
| Computation pipeline | `specos/artifacts/computation_graph.json` (14 nodes, 18 steps) |
| Database DDL | `specos/artifacts/ddl.sql` (50 tables, 99 FKs, 88 indexes) |
| Golden test data | `specos/artifacts/test_fixtures.json` (CM waterfall traces) |
| Screen → API mapping | `specos/artifacts/traceability.json` (30 screens, 63 routes) |
| Variable → table mapping | `specos/artifacts/variable_mapping.json` (73 mappings) |

**Rule: do NOT write code without a SpecOS trace.** If the artifact doesn't define the
behavior, update the spec first or ask.

See `specos/CODEGEN.md` for the full artifact → code-file mapping.

## Key Conventions

### Validation
- Zod schemas on every POST/PUT/PATCH endpoint
- Schemas generated from `canonical_schema.json` entity field definitions
- Request validation middleware applied before route handler

### Column Names
- MUST match `canonical_schema.json` field names exactly
- The previous codebase had fatal column mismatches between API and DDL — this is the #1 historical bug class
- When writing SQL: open `canonical_schema.json`, find the entity, copy the field name. Do not guess.

### IDs and References
- Scenario IDs: UUIDs only. Never construct string IDs like `sc_base_001`
- All entity IDs: `UUID DEFAULT gen_random_uuid()`
- Foreign keys: always reference the parent table's `id` column

### Tenant and Auth
- Extract tenant from JWT claims, not from `x-tenant-id` header
- No hardcoded tenant ID fallbacks like `tttttttt-0000-0000-0000-000000000001`

### Computation Engine
- No hardcoded financial constants — all values from assumption tables
- Platform commission rates: from `price_plans` table, not a constant
- Monte Carlo: real random sampling from risk distributions. Never insert predetermined P10/P50/P90 values
- Every formula implementation must match `variable_registry.json` formula definitions

### Frontend Data
- `web/lib/data/*.ts` static data files are DELETED — do not recreate
- Every page fetches from the real API
- `DataFreshness` badge must show "Live" in all views

### Error Handling
- Use the SpecOS Phase 1 error registry (governance_status, error codes)
- Structured logging via pino — no `console.error`
- Endpoint-specific error codes from `api_contracts.json`, not the same codes for every endpoint

## Ask First

- Adding npm packages
- Changing DDL schema (must update `specos/artifacts/ddl.sql` first)
- Modifying API response envelope structure
- Any change affecting more than 3 files
- Adding new API endpoints not in `api_contracts.json`

## Do Not

- Hardcode currencies, markets, launch months, or financial constants
- Use `console.log` / `console.error` for error handling
- Create API routes not defined in `specos/artifacts/api_contracts.json`
- Skip Zod validation on write endpoints
- Reference column names not in `canonical_schema.json`
- Use string scenario IDs (must be UUIDs)
- Create static/fallback data files
- Comment out the BullMQ worker import
