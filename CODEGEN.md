# Codegen Manifest — SpecOS → BMA3

## Artifact → Code Mapping

| SpecOS Artifact | Generates | Target Path |
|---|---|---|
| `canonical_schema.json` | TypeScript entity interfaces | `api/src/types/entities.ts` |
| `canonical_schema.json` | Zod insert/update schemas | `api/src/schemas/*.ts` |
| `canonical_schema.json` | TypeScript enum types | `api/src/types/enums.ts` |
| `canonical_schema.json` + `ddl.sql` | DB migration scripts | `db/migrations/*.sql` |
| `api_contracts.json` | Express route files | `api/src/routes/v1/*.ts` |
| `api_contracts.json` | API request/response types | `api/src/types/api.ts` |
| `api_contracts.json` | Typed frontend API client | `web/lib/api-client.ts` |
| `api_contracts.json` | Frontend shared types | `web/lib/types/*.ts` |
| `computation_graph.json` | BullMQ orchestrator | `api/src/compute/orchestrator.ts` |
| `computation_graph.json` | Compute node stubs | `api/src/compute/nodes/*.ts` |
| `variable_registry.json` | Formula implementations | `api/src/compute/nodes/*.ts` |
| `variable_mapping.json` | Variable → column ORM | `api/src/compute/variable-map.ts` |
| `traceability.json` (screens) | Page → API wiring | `web/app/dashboard/*/page.tsx` |
| `traceability.json` (routes) | Frontend route config | `web/app/dashboard/layout.tsx` |
| `test_fixtures.json` | Integration tests | `tests/integration/compute-pipeline.test.ts` |
| `api_contracts.json` | API contract tests | `tests/api/contracts.test.ts` |

## Codegen Pattern

For every code file:

```
1. READ the SpecOS artifact (JSON)
2. EXTRACT the relevant slice (entity, endpoint, variable, node)
3. GENERATE code that implements that slice
4. VALIDATE column names / types match the artifact
5. TEST against golden fixtures where applicable
```

## Quick Lookups

### Entity schema
```
specos/artifacts/canonical_schema.json
  → entities[] → find by name
  → fields[]: name, type, nullable, constraints, description
  → relationships[]: type, target, through
```

### API endpoint contract
```
specos/artifacts/api_contracts.json
  → endpoints[] → find by method + path
  → request_schema: body, query_params, path_params
  → response_schema: success body + error codes
```

### Variable formula
```
specos/artifacts/variable_registry.json
  → variables[] → find by name
  → formula_or_source: the computation or "user_input"
  → dependencies: what variables feed into this one
  → mapped_table + mapped_column: where it lives in the DB
```

### Computation node
```
specos/artifacts/computation_graph.json
  → nodes[] → find by id
  → input_variables: what it reads
  → output_variables: what it writes
  → computation_logic: step-by-step algorithm
  → dependencies: which nodes must run first
```

### Screen → API binding
```
specos/artifacts/traceability.json
  → screens[] → find by name
  → apis_consumed: which API IDs this screen calls
  → entities_displayed: which entities appear on screen
  → route: the frontend URL path
```

## Computation Node → File Mapping

| Node ID | Execution Step | Output File |
|---|---|---|
| `node_planning_spine` | 1 | `api/src/compute/nodes/planning-spine.ts` |
| `node_scope_bundle` | 2 | `api/src/compute/nodes/scope-bundle.ts` |
| `node_decisions` | 3 | `api/src/compute/nodes/decisions.ts` |
| `node_assumption_packs` | 4 | `api/src/compute/nodes/assumption-packs.ts` |
| `node_demand_drivers` | 5 | `api/src/compute/nodes/demand-drivers.ts` |
| `node_revenue_stack` | 6 | `api/src/compute/nodes/revenue-stack.ts` |
| `node_contribution_stack` | 7 | `api/src/compute/nodes/contribution-stack.ts` |
| `node_capex_opex` | 8 | `api/src/compute/nodes/capex-opex.ts` |
| `node_working_capital` | 9 | `api/src/compute/nodes/working-capital.ts` |
| `node_burn_runway` | 10 | `api/src/compute/nodes/burn-runway.ts` |
| `node_balance_sheet` | 11 | `api/src/compute/nodes/balance-sheet.ts` |
| `node_unit_economics` | 12 | `api/src/compute/nodes/unit-economics.ts` |
| `node_sensitivity_risk` | 13 | `api/src/compute/nodes/sensitivity-risk.ts` |
| `node_confidence` | 14 | `api/src/compute/nodes/confidence.ts` |
