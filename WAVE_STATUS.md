# Wave Status Tracker

> Machine-readable migration state. Updated after major merged milestones.
> Read by agents to know what is actually done, what is partially landed, and
> what still must be completed to satisfy the SpecOS wave gates.
> For artifact -> code-file mapping, see `CODEGEN.md`.

## Status Semantics

- **DONE**: the target exists and the wave gate for that area is considered met
- **IN_PROGRESS**: meaningful merged work exists, but the wave gate is not met
- **GENERATED**: scaffold/codegen output exists, but it is not yet validated to the wave gate
- **PARTIAL**: only part of the target surface is live
- **NOT_STARTED**: no meaningful merged work yet

## Current Wave: 5 (Harden) — DONE

## Baseline Snapshot

Merged stabilization through commit `bd66c3a` means the repo is no longer at the
original Wave 1-only state:

- Canonical route modules are live in `api/src/routes/v1/` for `context`,
  `assumptions`, `financials`, `compute`, and a partial `analysis` bridge
- Core finance screens are already rewired to `web/lib/api-client.ts`
- `risk` and `simulations` are also rewired to canonical routes
- Canonical smoke and CI now exercise the queued compute runtime, and the
  compose stack is verified with Postgres + Redis + API + worker + web
- No active legacy frontend boundary remains on the dashboard surfaces; Wave 5
  hardening is now closed, and the remaining repo work is optional post-wave
  parity/UX refinement rather than a tracked SpecOS compliance blocker

## Wave Status

| Wave | Status | Risk | Gate | Current Reality |
|---|---|---|---|---|
| 1. Foundation | **DONE** | Low | `tsc --noEmit` passes both `api/` and `web/` | Delivered and merged |
| 2. First Slice | **DONE** | Low | Golden fixture passes, P&L page shows live data | 48/48 golden tests pass, P&L wired to live API |
| 3. Compute | **DONE** | Low | Full 18-step DAG runs, both fixtures pass, balance sheet identity holds | 114/114 tests pass, all 14 nodes validated, DAG acceptance met |
| 4. Rewire | **DONE** | Low | All pages live, no static fallback, no string IDs | All primary API routes live (11 routers, including `reference` and `ai`), all dashboard pages wired to canonical API, legacy files deleted |
| 5. Harden | **DONE** | Low | Full CI green, compliance blocking, `docker-compose up` runs full stack | Auth/tenant middleware, structured logging, contract tests, migration tooling, Playwright E2E, and blocking compliance are live. Local `docker compose up -d` now boots Postgres + Redis + API + worker + web, and a compose-hosted queued compute run completes all 18 steps. |

## Verification Strategy

| Wave | Method |
|---|---|
| 1. Foundation | Static checks: `tsc --noEmit`, Zod parse against seed data |
| 2. First Slice | Golden fixture test: input -> compute -> output matches `test_fixtures.json`. Use blind-deposit verification for compute nodes. |
| 3. Compute | Extended golden fixture (both test cases, 114 tests). Balance sheet identity: A - amort - tax = L + E (documented structural gaps). Cash flow reconciliation: OCF+ICF+FCF=net_change. All 14 node formulas match variable_registry.json and computation_graph.json. Hand-verified cash flow/BS values. |
| 4. Rewire | Page-level verification: all 11 implemented API routers registered (`context`, `assumptions`, `financials`, `compute`, `analysis`, `scope`, `reference`, `decisions`, `confidence`, `governance`, `ai`). All dashboard pages import from `api-client.ts`. Routed Scenario Comparison, Scope Review, Scope Dimension Editors, Scenario Wizard, and Compute Center surfaces are live. Canonical dashboard aliases for `cash-flow`, `capital-strategy`, and `simulation` resolve via Next rewrites. Legacy files deleted (`web/lib/api.ts`, `web/lib/use-api-data.ts`, `web/lib/data/markets.ts`). Duplicate `simulation/` folder removed. `DataFreshness` shows live on all surfaces. `tsc --noEmit` clean, Jest green, compliance COMPLIANT. |
| 5. Harden | Full CI pipeline green, canonical smoke green, compliance checker blocking with 0 errors / 0 warnings, Playwright E2E green, and the compose stack is verified end to end for Postgres + Redis + API + worker + web. Async queue handoff and a full 18-step compute run are proven on the compose-hosted stack. |

## File Generation Tracker

### Wave 1: Foundation (types + schemas + validation + API client)

| Target | Status | Generated From |
|---|---|---|
| `api/src/types/entities.ts` | **DONE** | `canonical_schema.json` |
| `api/src/types/enums.ts` | **DONE** | `canonical_schema.json` enum types |
| `api/src/types/api.ts` | **DONE** | `api_contracts.json` |
| `api/src/schemas/*.ts` | **DONE** | `canonical_schema.json` |
| `api/src/middleware/validate.ts` | **DONE** | Zod validation middleware |
| `web/lib/api-client.ts` | **DONE** | `api_contracts.json` |
| `web/lib/types/api.ts` | **DONE** | `api_contracts.json` |
| `db/migrations/001-reconcile-with-specos.sql` | **DONE** | Schema reconciliation migration |

### Wave 2: First Vertical Slice (planning -> compute -> P&L)

| Target | Status | Generated From |
|---|---|---|
| `api/src/routes/v1/context.ts` | **DONE** | `api_contracts.json` context |
| `api/src/routes/v1/assumptions.ts` | **DONE** | `api_contracts.json` assumptions — sets, packs, pack apply, family reads/writes, and overrides live on canonical assumption-pack tables |
| `api/src/routes/v1/financials.ts` | **DONE** | `api_contracts.json` financials |
| `api/src/compute/orchestrator.ts` | **DONE** | `computation_graph.json` — 18-step sequencer |
| `api/src/compute/nodes/planning-spine.ts` | **DONE** | node 1 — DDL-aligned (plan_versions) |
| `api/src/compute/nodes/scope-bundle.ts` | **DONE** | node 2 — DDL-aligned (geography_nodes, scope_bundle_items) |
| `api/src/compute/nodes/decisions.ts` | **DONE** | node 3 — DDL-aligned (decision_records, decision_status) |
| `api/src/compute/nodes/assumption-packs.ts` | **DONE** | node 4 — DDL-aligned (family, name, NUMERIC value) |
| `api/src/compute/nodes/demand-drivers.ts` | **DONE** | node 5 — golden fixture verified |
| `api/src/compute/nodes/revenue-stack.ts` | **DONE** | node 6 — golden fixture verified |
| `api/src/compute/nodes/contribution-stack.ts` | **DONE** | node 7 — golden fixture verified |
| `web/app/dashboard/pnl/page.tsx` (rewire) | **DONE** | `traceability.json` |
| `web/app/dashboard/executive/page.tsx` (rewire) | **DONE** | `traceability.json` |
| `web/lib/planning-context.tsx` (rewire) | **DONE** | Real API |
| `tests/integration/compute-pipeline.test.ts` | **DONE** | `test_fixtures.json` — 114/114 tests (Wave 2+3 combined) |

### Wave 3: Compute Nodes 8-14 (full DAG)

| Target | Status | Generated From |
|---|---|---|
| `api/src/compute/nodes/capex-opex.ts` | **DONE** | node 8 — golden fixture verified |
| `api/src/compute/nodes/working-capital.ts` | **DONE** | node 9 — formulas verified |
| `api/src/compute/nodes/burn-runway.ts` | **DONE** | node 10 — cash flow reconciliation |
| `api/src/compute/nodes/balance-sheet.ts` | **DONE** | node 11 — A=L+E identity |
| `api/src/compute/nodes/unit-economics.ts` | **DONE** | node 12 — per-order + IRR/NPV |
| `api/src/compute/nodes/sensitivity-risk.ts` | **DONE** | node 13 — tornado + MC simulation |
| `api/src/compute/nodes/confidence.ts` | **DONE** | node 14 — DDL-aligned (dqi_scores, confidence_rollups) |

### Wave 4: Full Rewire (all APIs + all pages)

| Target | Status | Generated From |
|---|---|---|
| `api/src/routes/v1/analysis.ts` | **DONE** | `api_contracts.json` — full: risk, simulation-runs, comparisons, explainability, sensitivity, alerts, portfolio |
| `api/src/routes/v1/scope.ts` | **DONE** | `api_contracts.json` — bundles CRUD, apply, dimensions (formats/categories/portfolio/channels/operating-models/geographies), review validate/summary |
| `api/src/routes/v1/reference.ts` | **DONE** | `api_contracts.json` — geographies, formats, categories, portfolio-hierarchy, channels, operating-models, platforms, product-families |
| `api/src/routes/v1/decisions.ts` | **DONE** | `api_contracts.json` — products/markets/marketing/operations CRUD, rationale, links, sequencing |
| `api/src/routes/v1/confidence.ts` | **DONE** | `api_contracts.json` — summary, evidence CRUD, assessments CRUD, DQI, research-tasks CRUD, rollups |
| `api/src/routes/v1/governance.ts` | **DONE** | `api_contracts.json` — versions, approval-workflows (submit/approve/reject), events, audit-log, decision-memory CRUD, publication (publish/unpublish) |
| `api/src/routes/v1/ai.ts` | **DONE** | `api_contracts.json` — edit-suggestions, analyze, explain, research-draft |
| Core finance screens rewired | **DONE** | `traceability.json` |
| `web/app/dashboard/risk/page.tsx` | **DONE** | canonical `analysis/risk` |
| `web/app/dashboard/simulations/page.tsx` | **DONE** | canonical `analysis/simulation-runs` |
| `web/app/dashboard/assumptions/page.tsx` | **DONE** | canonical assumptions overview route |
| `web/app/dashboard/assumptions/[family]/page.tsx` | **DONE** | canonical routed family surfaces for demand, cost, funding, and working capital |
| `web/app/dashboard/markets/page.tsx` | **DONE** | canonical `decisions/markets` API |
| `web/app/dashboard/analysis/compare/page.tsx` | **DONE** | canonical Scenario Comparison Console route |
| `web/app/dashboard/scope/page.tsx` | **DONE** | canonical scope route index |
| `web/app/dashboard/scope/[family]/page.tsx` | **DONE** | canonical scope dimension editor family routes |
| `web/app/dashboard/scope/review/page.tsx` | **DONE** | canonical scope review surface |
| `web/app/dashboard/compute/center/page.tsx` | **DONE** | canonical compute center surface |
| `web/app/wizard/scenario/page.tsx` | **DONE** | canonical scenario wizard entry route |
| `web/app/wizard/scenario/[step]/page.tsx` | **DONE** | routed scenario wizard flow over live APIs |
| `web/next.config.mjs` route aliases | **DONE** | canonical dashboard slug aliases for `cash-flow`, `capital-strategy`, and `simulation` |
| Delete `/dashboard/simulation/` duplicate | **DONE** | removed (keep `simulations/`) |
| Delete legacy `web/lib/api.ts` | **DONE** | no remaining consumers |
| Delete legacy `web/lib/use-api-data.ts` | **DONE** | no remaining consumers |
| Delete legacy `web/lib/data/markets.ts` | **DONE** | no remaining consumers |
| Fix `03-risk-seed.sql` UUID format | **DONE** | merged |

### Wave 5: Harden (auth, logging, tests, CI gate)

| Target | Status | Generated From |
|---|---|---|
| `api/src/middleware/auth.ts` | **DONE** | JWT bearer claims + local dev token |
| `api/src/middleware/tenant.ts` | **DONE** | JWT claims + company/tenant ownership enforcement |
| Structured logging (pino) | **DONE** | `console.*` removed from production API runtime / compute code |
| Canonical smoke script + CI job | **DONE** | compose-backed queued runtime gate |
| Complete docker-compose | **DONE** | Postgres + Redis + API + worker + web boot locally via `docker compose up -d`; container-native `node_modules` volumes prevent host-binary drift, and compose-hosted queued compute completes successfully |
| `db/migrations/` tooling | **DONE** | `node-pg-migrate` scripts + baseline migration scaffold |
| `tests/api/contracts.test.ts` | **DONE** | app boot + auth/envelope smoke against canonical routes |
| `tests/e2e/dashboard.test.ts` | **DONE** | Playwright full-stack route smoke with fixture API (`9/9` local) |
| Flip compliance to blocking CI | **DONE** | spec compliance now fails CI on error/warn regressions |

## DDL Alignment Fix Log (Wave 3)

Critical table/column mismatches found and fixed during Wave 3 audit:

| File | Issue | Fix |
|---|---|---|
| `planning-spine.ts` | `FROM versions` | `FROM plan_versions` |
| `decisions.ts` | `FROM decisions` | `FROM decision_records` |
| `decisions.ts` | `lifecycle_state` column | `decision_status` |
| `decisions.ts` | `decision_type` column | Removed (not in schema) |
| `decisions.ts` | `effective_period_start/end` | `effective_from_period_id/effective_to_period_id` |
| `scope-bundle.ts` | `geography_taxonomy_nodes` | `geography_nodes` |
| `scope-bundle.ts` | `scope_bundle_members` | `scope_bundle_items` |
| `scope-bundle.ts` | `dimension_type` / `dimension_value` | `dimension_family` / `node_id` |
| `assumption-packs.ts` | `ap.assumption_family` | `ap.family` |
| `assumption-packs.ts` | `ap.pack_name` | `ap.name` |
| `assumption-packs.ts` | `ap.scenario_id` filter | Removed (not in DDL) |
| `assumption-packs.ts` | `afb.inherited_from_id` | Removed (not in DDL) |
| `assumption-packs.ts` | JSONB value parsing | NUMERIC direct parse |
| `confidence.ts` | `id` PK in 3 tables | `assessment_id`, `dqi_score_id`, `id` |
| `confidence.ts` | `confidence_rollups` columns | `weighted_score`, `scope_id`, `assessment_count`, `lowest_critical_score` |
| `confidence.ts` | `dqi_scores.company_id` | Removed (not in DDL) |
| `confidence.ts` | Various extra columns | Removed non-DDL columns |

## Remaining Legacy Surface

All Wave 4 blocking legacy files have been resolved:

- ~~`web/app/dashboard/markets/page.tsx`~~ rewired to `decisions/markets` canonical API
- ~~`web/lib/api.ts`~~ deleted (no consumers)
- ~~`web/lib/use-api-data.ts`~~ deleted (no consumers)
- ~~preview-only assumptions workspace~~ now reads/writes via canonical assumptions API

Wave 5 also removed the remaining stub data files under `web/lib/data/`, so the
dashboard surfaces no longer depend on static `.ts` data shims.

No tracked post-wave parity blockers are currently open. Remaining work is
optional product/UX refinement rather than SpecOS closure work.

## Compliance Snapshot

Last verified after compose runtime closure:

- `python3 scripts/spec-compliance.py`
- Result: **COMPLIANT**
- Summary: 9 pass, 0 warnings, 0 failures

## Session Log

| Session | Date | Wave | What Was Done | Compliance After |
|---|---|---|---|---|
| 0 | 2026-04-04 | setup | Scaffolding: submodule, AGENTS.md, CODEGEN.md, compliance checker | 3 pass, 7 warn, 16 fail |
| 1 | 2026-04-04 | Wave 1 | Generated: entity interfaces, enums, Zod schema files, API types, typed API client, validation middleware, schema reconciliation migration | foundation delivered |
| 2 | 2026-04-04 | stabilization | Runtime alignment: fixed schema/seed drift, canonical context/assumptions/financials/compute routes live, seeded finance outputs, core finance screens rewired, canonical smoke path added | execution-green core slice |
| 3 | 2026-04-04 | stabilization | Retired BullMQ/Redis runtime path, added canonical analysis bridge, rewired risk and simulations, pruned legacy helpers | compliant, 0 failures |
| 4 | 2026-04-04 | status rebase | Rebased wave tracker to merged baseline through `bd66c3a`; marked generated vs live vs remaining work accurately | compliant, 0 failures |
| 5 | 2026-04-04 | Wave 2 | Closed golden fixture gate: full 16-step CM waterfall, 48/48 tests passing, blind-deposit verification | compliant, 0 failures |
| 6 | 2026-04-04 | Wave 3 | Full DAG acceptance: fixed 17 DDL mismatches across 5 compute nodes (table names, column names, data types); extended test suite to 67 tests covering steps 5-14 + balance sheet identity + cash flow reconciliation + unit economics + sensitivity + confidence structure + orchestrator verification. API tsc clean. | compliant, 0 failures |
| 7 | 2026-04-04 | Wave 3 re-verify | Fresh re-audit after independent refactoring. Re-verified all 14 node formulas against variable_registry.json. Rewrote test suite to 114 tests: 34 Wave 2 gate (Steps 1-16), 80 Wave 3 gate (DAG structure, nodes 8-14, cash flow hand-verified, balance sheet identity with documented amort+tax gap, unit economics, sensitivity perturbation, confidence DQI, cross-statement reconciliation, multi-period chain). All pass. | compliant, 0 failures |
| 8 | 2026-04-04 | Wave 4 | Full API rewire: created 4 new route modules (scope.ts, decisions.ts, confidence.ts, governance.ts) with DDL-aligned queries. Completed analysis.ts (added comparisons, explainability, sensitivity, alerts, portfolio). Registered all 9 routers in server.ts. Rewired markets/page.tsx to canonical decisions/markets API. Upgraded assumptions/page.tsx from preview-only to full canonical read/write with compute trigger. Deleted legacy files (api.ts, use-api-data.ts, data/markets.ts). Removed duplicate simulation/ folder. tsc clean, 114/114 tests pass. | compliant, 0 failures |
| 9 | 2026-04-04 | Wave 5 hardening | DDL audit + SQL column fixes across all compute nodes: decisions.ts (family, status, effective_period_id), scope-bundle.ts (taxonomy_bindings polymorphic columns, scope_bundles.name), planning-spine.ts (version_label), confidence.ts (evidence_type SELECT). Migration 002 adds UNIQUE constraints for dqi_scores, confidence_assessments, confidence_rollups + evidence_type column on assumption_field_bindings. Real period-overlap check in decisions.ts. Pruned root package.json transitive deps. Improved test suite (finiteness check, DFS cycle detection, canonical constants). 6 compute nodes on Pino structured logging. | compliant, 0 failures |
| 10 | 2026-04-04 | SpecOS maintenance | Synced `specos` source docs and artifacts for dashboard-path traceability, added execution-mode metadata in `validation/spec_score.json`, and hardened `specos/validate_specos.py` with stage-tier, gs_source, computation-graph execution-mode, and schema-derived lifecycle checks. `python3 specos/validate_specos.py` now passes with 0 errors and 0 warnings. | compliant, 0 failures |
| 11 | 2026-04-04 | SpecOS maintenance follow-up | Tightened `specos/validate_specos.py` so required execution modes must be both declared in `supported_modes` and concretely defined, and so `status_lifecycle` always fails fast when missing or empty before schema-subset validation runs. | compliant, 0 failures |
| 12 | 2026-04-04 | Wave 5 hardening follow-up | Replaced `api/src/server.ts` global error/startup `console.*` usage with shared Pino logging, removed redundant `@types/pino` from `api/package.json`, refreshed npm lockfiles, and re-verified that the root Jest script/package split was already correct while the existing `confidence_rollups` unique-constraint migration remained sufficient. | compliant, 0 failures |
| 13 | 2026-04-04 | Wave 5 hardening follow-up | Hardened `api/src/compute/nodes/confidence.ts` by normalizing evidence references to canonical evidence-type keys before DQI scoring, and by switching DQI/confidence upserts to the named unique constraints added in migration `002`. Re-verified that `planning-spine.ts`, `scope-bundle.ts`, and the existing confidence-rollup uniqueness migration were already correct in this checkout. | compliant, 0 failures |
| 14 | 2026-04-04 | Wave 5 hardening follow-up | Switched the golden compute integration suite from duplicated in-test arithmetic to the real orchestrator with a mocked DB harness, hardened `assertClose` with explicit finiteness checks, exported canonical confidence constants for drift-proof tests, and tightened decision overlap warnings so unresolved period IDs no longer create false positives. Also normalized markdownlint spacing in this tracker. | compliant, 0 failures |
| 15 | 2026-04-04 | Wave 5 hardening follow-up | Scoped assumption-pack resolution to the active assumption set, fixed confidence rollups to use critical-only minimums, shared DQI scoring/upsert logic between pipeline and confidence routes, aligned decision rationale/dependency SQL with live tables, batched governance workflow-step loading and wrapped workflow/publication mutations in transactions with row-count checks, hardened scope dimension SQL, preserved assumption unit/period metadata in the dashboard save payload, kept markets freshness live on empty contexts, added real date-based market schedule parsing, and added migration `003` for `decision_rationales(decision_id)` upserts. Also moved shared route UUID validation to `z.string().uuid()` and added shared SpecOS-style error payload helpers. Verified with `npm test -- --runInBand`, `npm run build` in `api/`, `npm run build` in `web/`, and `python3 scripts/spec-compliance.py`. | compliant, 0 failures |
| 16 | 2026-04-04 | Wave 5 hardening follow-up | Canonicalized the compute-layer assumption-pack and decision resolution queries to the SpecOS field names (`assumption_set_id`, `assumption_family`, `decision_family`, `decision_status`, `effective_from_period_id`) and added migration `004` to backfill those canonical columns on the compatibility tables used in local DBs. Also finished shared UUID validation reuse in `context.ts`, `assumptions.ts`, and `compute.ts`, then updated the integration harness to match the canonical SQL text. Re-verified with `npm test -- --runInBand`; the prior `api/` and `web/` builds plus `python3 scripts/spec-compliance.py` remain green on this patchset. | compliant, 0 failures |
| 17 | 2026-04-04 | Wave 5 hardening follow-up | Added JWT auth and tenant ownership middleware, exported `createApp()` for server bootstrapping and contract tests, switched local/web smoke flows to bearer-token auth, deleted the remaining `web/lib/data/` stub files, rewired the dashboard home shell to live canonical APIs, completed the remaining `console.*` -> Pino migration across production API code, added `tests/api/contracts.test.ts`, mapped Jest `uuid` for app-boot tests, and made spec compliance blocking in CI. Re-verified with `npm run build` in `api/`, `npm run build` in `web/`, `npm test -- --runInBand`, `git diff --check`, and `python3 scripts/spec-compliance.py`. | compliant, 0 failures |
| 18 | 2026-04-04 | Wave 5 hardening CI follow-up | Fixed fresh-runner CI breakages by installing `api/` dependencies in the root Jest workflow and by normalizing the seeded company/calendar/scenario IDs in `db/02-seed.sql` to valid RFC UUIDs so strict Zod UUID validation and canonical smoke requests succeed on a fresh database. Re-verified with `npm test -- --runInBand`, `python3 scripts/spec-compliance.py`, and a seed scan confirming the old invalid IDs are gone. | compliant, 0 failures |
| 19 | 2026-04-04 | Post-Wave gap closure | Implemented the missing SpecOS `/api/v1/reference` router (`geographies`, `formats`, `categories`, `portfolio-hierarchy`, `channels`, `operating-models`, `platforms`, `product-families`) using canonical DDL columns and tenant/company context resolution. Registered it in `server.ts`, added contract coverage for the new route family, and updated the root analysis doc to reflect that `/ai` is now the only fully absent API router group. Re-verified with `npm run build` in `api/`, `npm test -- --runInBand` (`118/118`), and `python3 scripts/spec-compliance.py` (`9/9`, 0 warnings). | compliant, 0 failures |
| 20 | 2026-04-05 | Analysis doc correction | Reconciled `specos-analysis.md` with the merged repo and current SpecOS artifacts: removed the stale claim that `/api/v1/assumptions` still lacked category routes, converted dashboard-path-backed frontend surfaces from “mismatches” into canonical remaps, reduced remaining dashboard slug drift to the unresolved `cashflow` / `capital` / `simulations` aliases, and softened compute coverage wording to match the current 34-binding orchestrator harness rather than claiming one-assert-per-variable coverage for all 73 registry variables. Re-verified build status in `api/` and `web/` and reran `python3 scripts/spec-compliance.py`. | compliant, 0 failures |
| 21 | 2026-04-05 | AI + infra + routed-page gap closure | Implemented the missing SpecOS `/api/v1/ai` router (`edit-suggestions`, `analyze`, `explain`, `research-draft`) and registered it in `server.ts`; added BullMQ + Redis queue infrastructure, a compute worker runtime, `node-pg-migrate` tooling, and an expanded `docker-compose.yml` that defines Postgres + Redis + API + worker + web. Added routed frontend surfaces for the Scenario Comparison Console, scope dimension editor family, and Scenario Wizard, plus Playwright E2E coverage over those live flows. Re-verified with `npm run build` in `api/`, `npm run build` in `web/`, `npm test -- --runInBand` (`119/119`), `npm run test:e2e` (`3/3`), `docker compose config`, and `python3 scripts/spec-compliance.py`. Local `docker compose up` remains unverified because the Docker daemon was unavailable in this session. | compliant, 0 failures |
| 22 | 2026-04-05 | Post-Wave frontend parity closure | Implemented the missing routed Scope Review and Compute Center surfaces, switched the scope validation endpoint back to the SpecOS contract shape (`scopeBundleId` only), added canonical Next route aliases for `/dashboard/cash-flow`, `/dashboard/capital-strategy`, and `/dashboard/simulation`, and expanded Playwright dashboard coverage from `3/3` to `5/5`. Re-verified with `npm run build` in `api/`, `npm run build` in `web/`, `npm test -- --runInBand`, `npm run test:e2e`, and `python3 scripts/spec-compliance.py`. Docker runtime verification remains the only open Wave 5 gate. | compliant, 0 failures |
| 23 | 2026-04-05 | Wave 5 runtime closure | Fixed live async compute blockers across assumption-pack resolution, projection persistence, and confidence rollups; added bootstrap migration `005` for canonical assumption packs/bindings; verified `npm run migrate:up`; proved host-run and compose-hosted queued compute both complete all 18 steps; and fixed `docker-compose.yml` to use container-native `node_modules` volumes so Linux containers no longer crash on macOS host binaries. Also re-verified the already-landed AI SME overlays (executive + P&L), bringing Playwright dashboard coverage to `7/7` locally. Wave 5 gate is now closed; remaining follow-up work is assumptions API behavior completion and financial reconciliation cleanup. | compliant, 0 failures |
| 24 | 2026-04-05 | Post-Wave assumptions behavior closure | Replaced the remaining stubbed assumptions handlers with live SQL-backed behavior on `assumption_packs`, `assumption_pack_bindings`, `assumption_field_bindings`, and `assumption_override_log`. `/packs`, `/packs/:packId/apply`, family reads/writes, and `/overrides` now resolve against the active assumption set, persist updates for compute, and expose live contract responses. Added contract coverage for demand reads, funding bulk upserts, pack apply, and overrides. Re-verified with `npm run build` in `api/`, `npm run build` in `web/`, `npm test -- --runInBand` (`123/123`), and `python3 scripts/spec-compliance.py` (`9/9`, 0 warnings). | compliant, 0 failures |
| 25 | 2026-04-05 | Post-Wave seeded financial reconciliation cleanup | Added migration `006-reconcile-seeded-opening-balances.sql` to zero the seeded bootstrap values for `depreciation`, `amortization`, and `debt_outstanding` across the canonical assumption packs. This fixes the local base-scenario warning path where the compute engine starts with zero opening PPE/equity but the bootstrap packs were seeding carried-state balances, which caused negative PPE and step 11/16 balance-sheet warnings on the seeded runtime. Re-verified with `npm run migrate:up`, a compose-hosted queued compute run on `Base Case 2025` (18/18 steps, `ppeNet=0`, `debtOutstanding=0`, `isBalanced=true` in worker logs), `npm test -- --runInBand`, and `python3 scripts/spec-compliance.py`. | compliant, 0 failures |
| 26 | 2026-04-05 | Post-Wave canonical smoke alignment | Updated `api/scripts/smoke-canonical-runtime.ts` to support the live async compute runtime by polling `/compute/runs/:runId` from `queued`/`running` to a terminal state, verifying completed step records via `/steps`, and asserting `freshness=fresh` instead of assuming synchronous `outputSummary` population. Also corrected the analysis doc’s migration count from 5 to 6 and removed the stale smoke-script follow-up note. Re-verified with `npm --prefix api run smoke:canonical`, `python3 scripts/spec-compliance.py`, and `git diff --check`. | compliant, 0 failures |
| 27 | 2026-04-05 | Post-Wave async parity + assumptions route split | Completed async compute result parity by moving run-artifact/output-count emission into the live orchestrator path and sharing the artifact manifest helper with the synchronous compute route, then switched the CI smoke job to the compose-backed async stack. Replaced the legacy 8-tab assumptions shell with a canonical overview route plus routed family surfaces for demand, cost, funding, and working capital, expanded Playwright coverage for the new routes, and cleaned up the status trackers to remove the now-stale assumptions-consolidation gap. Re-verified with `npm run build` in `api/`, `npm run build` in `web/`, `npm test -- --runInBand` (`123/123`), `npm run test:e2e` (`9/9`), `npm --prefix api run smoke:canonical`, and `python3 scripts/spec-compliance.py`. | compliant, 0 failures |
| 28 | 2026-04-05 | Post-Wave compose smoke bootstrap fix | Fixed the fresh-stack compose smoke path by correcting the legacy risk seed scenario UUID in `db/03-risk-seed.sql` and adding a one-shot `migrator` service to `docker-compose.yml` so the compose runtime applies canonical migrations before `api` and `worker` start. Re-verified from a clean volume with `docker compose up -d postgres redis api worker` followed by `npm --prefix api run smoke:canonical`, then reran `python3 scripts/spec-compliance.py` and `git diff --check`. | compliant, 0 failures |
