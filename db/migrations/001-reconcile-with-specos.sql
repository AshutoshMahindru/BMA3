-- Migration 001: Reconcile BMA3 schema with SpecOS v2 canonical DDL
-- Generated: 2026-04-04
-- Source: specos/artifacts/ddl.sql vs db/01-schema.sql
--
-- This migration brings the existing BMA3 schema into alignment with
-- the SpecOS canonical specification. It is additive — it does not
-- drop existing tables or columns.
--
-- Sections:
--   1. New enum types missing from BMA3
--   2. New tables from SpecOS not in BMA3
--   3. ALTER TABLE — missing columns on shared tables
--   4. ALTER TABLE — column type / default fixes
--   5. New FK constraints
--   6. New indexes
--   7. Views from SpecOS (CREATE OR REPLACE — idempotent)
--
-- Rules applied:
--   - NEVER DROP tables, columns, or constraints
--   - IF NOT EXISTS guards on all CREATE TABLE / CREATE INDEX
--   - ADD COLUMN IF NOT EXISTS everywhere (requires PG 9.6+)
--   - Whole script wrapped in a single transaction
--   - BMA3-only tables are left completely untouched

BEGIN;

-- ============================================================
-- 1. NEW ENUM TYPES
--    SpecOS defines 12 enums; BMA3 defines 24 different ones.
--    The 11 below are in SpecOS but absent from BMA3.
--    BMA3-only enums are preserved as-is.
--    NOTE: scenario_type exists in both but with different values —
--          we ADD the new SpecOS values without removing old ones.
-- ============================================================

-- 1.1 governance_status — replaces/supplements plan_status in SpecOS
--     Used on companies, scenarios, plan_versions, assumption_sets, etc.
DO $$ BEGIN
  CREATE TYPE governance_status AS ENUM (
    'draft', 'submitted', 'under_review', 'approved', 'rejected',
    'frozen', 'published', 'archived', 'deprecated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.2 compute_status — lifecycle for compute_runs / compute_run_steps
DO $$ BEGIN
  CREATE TYPE compute_status AS ENUM (
    'queued', 'running', 'completed', 'failed', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.3 compute_trigger_type — what initiated a compute run
DO $$ BEGIN
  CREATE TYPE compute_trigger_type AS ENUM (
    'manual', 'auto', 'publish_gate', 'compare_prep'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.4 confidence_state — SpecOS replaces confidence_level with this
--     (finer-grained: adds 'estimated' and 'unknown')
DO $$ BEGIN
  CREATE TYPE confidence_state AS ENUM (
    'high', 'medium', 'low', 'estimated', 'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.5 decision_family — classifies decision_records
DO $$ BEGIN
  CREATE TYPE decision_family AS ENUM (
    'product', 'market', 'marketing', 'operations', 'governance'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.6 assumption_family — classifies assumption_packs
DO $$ BEGIN
  CREATE TYPE assumption_family AS ENUM (
    'product', 'market', 'capacity', 'operations', 'funding'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.7 assumption_source_type — provenance of an assumption pack
DO $$ BEGIN
  CREATE TYPE assumption_source_type AS ENUM (
    'template', 'benchmark', 'copied', 'scenario_specific'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.8 dimension_family — generalised taxonomy dimension classifier
DO $$ BEGIN
  CREATE TYPE dimension_family AS ENUM (
    'geography', 'format', 'category', 'portfolio',
    'channel', 'operating_model'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.9 validation_severity — severity of a compute validation issue
DO $$ BEGIN
  CREATE TYPE validation_severity AS ENUM (
    'blocking', 'warning', 'info'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.10 period_type — typed enum replacing BMA3's plain TEXT column
DO $$ BEGIN
  CREATE TYPE period_type AS ENUM (
    'month', 'quarter', 'year'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.11 geography_node_type — node types for the generalised geo hierarchy
DO $$ BEGIN
  CREATE TYPE geography_node_type AS ENUM (
    'region', 'country', 'state', 'cluster', 'macro', 'micro', 'site'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.12 Extend scenario_type with SpecOS values not in BMA3
--     BMA3 values: base, bull_case, bear_case, stress_test, custom
--     SpecOS values: base, upside, downside, stress, strategic_option, management_case, investor_case
--     We ADD the net-new SpecOS values; BMA3 values remain valid.
DO $$ BEGIN
  ALTER TYPE scenario_type ADD VALUE IF NOT EXISTS 'upside';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE scenario_type ADD VALUE IF NOT EXISTS 'downside';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE scenario_type ADD VALUE IF NOT EXISTS 'strategic_option';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE scenario_type ADD VALUE IF NOT EXISTS 'management_case';
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TYPE scenario_type ADD VALUE IF NOT EXISTS 'investor_case';
EXCEPTION WHEN others THEN NULL;
END $$;


-- ============================================================
-- 2. NEW TABLES FROM SPECOS NOT IN BMA3
--    BMA3-only tables (actuals_bridge, attractiveness_scores,
--    capex_plans, capital_allocation_plans, clusters, competitor_profiles,
--    countries, debt_facilities, debt_repayment_schedules,
--    dilution_models, equity_rounds, expansion_phases, expansion_plans,
--    headcount_plans, intraday_demand_slots, kitchens, kpi_projections*,
--    labor_models, loyalty_cohorts, macros, market_ramp_curves,
--    marketing_plans, micros, mix_plans, monte_carlo_runs,
--    monte_carlo_summaries, opex_plans, order_headers, order_lines,
--    performance_alerts, platform_promotions, platforms,
--    portfolio_kpi_rollups, portfolio_market_allocations, portfolio_plans,
--    price_plans, product_families, product_skus, revenue_projection_lines,
--    risk_objects, risk_scenarios, scenario_sensitivity_matrices,
--    sensitivity_analyses, simulation_results, simulation_runs,
--    trigger_log, unit_cost_profiles, variance_attribution,
--    working_capital_policies, assumption_confidence, assumption_lineage,
--    decision_records*, decision_outcomes*)
--    are LEFT UNTOUCHED.
--    * These also exist in SpecOS with different shapes — only columns
--      are reconciled in section 3.
-- ============================================================

-- -------------------------------------------------------
-- 2.1 Generalised Geography Hierarchy
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS geography_nodes (
  node_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL,
  node_type       geography_node_type NOT NULL,
  parent_node_id  UUID,
  code            TEXT NOT NULL,
  label           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  metadata        JSONB,
  latitude        NUMERIC,
  longitude       NUMERIC,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_geography_nodes_company_code UNIQUE (company_id, code)
);
COMMENT ON TABLE geography_nodes IS 'Generalized geography hierarchy: region→country→state→cluster→macro→micro→site. Replaces/generalises BMA3 countries/clusters/macros/micros for SpecOS compatibility. updated_at managed at app level.';

-- -------------------------------------------------------
-- 2.2 Format Taxonomy
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS format_taxonomy_nodes (
  node_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL,
  taxonomy_family TEXT NOT NULL DEFAULT 'format' CHECK (taxonomy_family = 'format'),
  parent_node_id  UUID,
  code            TEXT NOT NULL,
  label           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  metadata        JSONB,
  effective_from  DATE,
  effective_to    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_format_taxonomy_company_code UNIQUE (company_id, code)
);
COMMENT ON TABLE format_taxonomy_nodes IS 'Food-format taxonomy (dark kitchen, QSR, café, etc.). updated_at managed at app level.';

-- -------------------------------------------------------
-- 2.3 Category Taxonomy
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS category_taxonomy_nodes (
  node_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL,
  taxonomy_family TEXT NOT NULL DEFAULT 'category' CHECK (taxonomy_family = 'category'),
  parent_node_id  UUID,
  code            TEXT NOT NULL,
  label           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  metadata        JSONB,
  effective_from  DATE,
  effective_to    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_category_taxonomy_company_code UNIQUE (company_id, code)
);
COMMENT ON TABLE category_taxonomy_nodes IS 'Food-category taxonomy (pizza, burgers, coffee, etc.). updated_at managed at app level.';

-- -------------------------------------------------------
-- 2.4 Portfolio Nodes
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS portfolio_nodes (
  node_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL,
  taxonomy_family TEXT NOT NULL DEFAULT 'portfolio' CHECK (taxonomy_family = 'portfolio'),
  parent_node_id  UUID,
  code            TEXT NOT NULL,
  label           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  metadata        JSONB,
  effective_from  DATE,
  effective_to    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_portfolio_nodes_company_code UNIQUE (company_id, code)
);
COMMENT ON TABLE portfolio_nodes IS 'Portfolio hierarchy: category_group→category→subcategory→family→item→SKU. updated_at managed at app level.';

-- -------------------------------------------------------
-- 2.5 Channel Taxonomy
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS channel_taxonomy_nodes (
  node_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL,
  taxonomy_family TEXT NOT NULL DEFAULT 'channel' CHECK (taxonomy_family = 'channel'),
  parent_node_id  UUID,
  code            TEXT NOT NULL,
  label           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  metadata        JSONB,
  effective_from  DATE,
  effective_to    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_channel_taxonomy_company_code UNIQUE (company_id, code)
);
COMMENT ON TABLE channel_taxonomy_nodes IS 'Channel taxonomy (aggregator, direct, dine-in, catering, etc.). updated_at managed at app level.';

-- -------------------------------------------------------
-- 2.6 Operating Model Nodes
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS operating_model_nodes (
  node_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL,
  taxonomy_family TEXT NOT NULL DEFAULT 'operating_model' CHECK (taxonomy_family = 'operating_model'),
  parent_node_id  UUID,
  code            TEXT NOT NULL,
  label           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  metadata        JSONB,
  effective_from  DATE,
  effective_to    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_operating_model_company_code UNIQUE (company_id, code)
);
COMMENT ON TABLE operating_model_nodes IS 'Operating-model taxonomy (cook-to-order, batch-prep, assembly, hub-spoke, etc.). updated_at managed at app level.';

-- -------------------------------------------------------
-- 2.7 Taxonomy Bindings (polymorphic)
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS taxonomy_bindings (
  binding_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_type TEXT NOT NULL,
  source_entity_id   UUID NOT NULL,
  taxonomy_family    dimension_family NOT NULL,
  node_id            UUID NOT NULL,
  binding_role       TEXT,  -- primary, secondary, etc.
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE taxonomy_bindings IS 'Polymorphic bindings between entities and taxonomy nodes across any family.';

-- -------------------------------------------------------
-- 2.8 Scope Bundles
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS scope_bundles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL,
  scenario_id    UUID,
  version_id     UUID,
  name           TEXT,
  status         governance_status NOT NULL DEFAULT 'draft',
  is_default     BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from DATE,
  effective_to   DATE,
  created_by     TEXT,
  approved_by    TEXT,
  is_deleted     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE scope_bundles IS 'Reusable planning boundaries for a scenario/version. updated_at managed at app level.';

CREATE TABLE IF NOT EXISTS scope_bundle_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_bundle_id  UUID NOT NULL,
  dimension_family dimension_family,
  node_type        TEXT,
  node_id          UUID NOT NULL,
  grain_role       TEXT,  -- include, exclude, primary, secondary
  mode             TEXT,
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE scope_bundle_items IS 'Individual dimension selections within a scope bundle.';

CREATE TABLE IF NOT EXISTS scope_bundle_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_bundle_id  UUID NOT NULL,
  version_number   INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft',
  snapshot_data    JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE scope_bundle_versions IS 'Governed version snapshots of scope bundles.';

-- -------------------------------------------------------
-- 2.9 Decision Model (SpecOS canonical — separate from BMA3 decision_records)
--     BMA3 has decision_records and decision_outcomes with a different shape.
--     We add the SpecOS sub-tables; the BMA3 originals are untouched.
--     The shared tables (decision_records, decision_outcomes) are reconciled
--     via ALTER TABLE in section 3 below.
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS decision_dimensions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id      UUID NOT NULL,
  dimension_family dimension_family NOT NULL,
  node_id          UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE decision_dimensions IS 'Dimension bindings for decisions (geography, format, etc.).';

CREATE TABLE IF NOT EXISTS decision_dependencies (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id             UUID NOT NULL,
  depends_on_decision_id  UUID NOT NULL,
  dependency_type         TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_decision_dep_no_self CHECK (decision_id <> depends_on_decision_id)
);
COMMENT ON TABLE decision_dependencies IS 'Prerequisite and blocking relationships between decisions.';

CREATE TABLE IF NOT EXISTS decision_rationales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id   UUID NOT NULL,
  summary       TEXT,
  evidence_ref  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE decision_rationales IS 'Rationale records attached to decisions.';

CREATE TABLE IF NOT EXISTS decision_impacts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id         UUID NOT NULL,
  impact_dimension    TEXT,
  impact_description  TEXT,
  impact_value        NUMERIC,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE decision_impacts IS 'Expected effects of decisions on demand, capacity, margin, etc.';

-- -------------------------------------------------------
-- 2.10 Assumption Model (SpecOS canonical packs / bindings)
--      BMA3 has assumption_sets, assumption_lineage, assumption_confidence,
--      assumption_override_log (different shape). Those are left alone.
--      We add the net-new SpecOS tables.
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS assumption_packs (
  id                               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id                       UUID NOT NULL,
  family                           assumption_family,
  name                             TEXT,
  status                           governance_status NOT NULL DEFAULT 'draft',
  source_type                      assumption_source_type,
  scope_bundle_id                  UUID,
  decision_id                      UUID,
  default_confidence_assessment_id UUID,
  effective_period_range           TEXT,
  metadata                         JSONB,
  is_deleted                       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE assumption_packs IS 'Reusable grouped assumption bundles. updated_at managed at app level.';

CREATE TABLE IF NOT EXISTS assumption_field_bindings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id         UUID NOT NULL,
  variable_name   TEXT,
  grain_signature JSONB,
  value           NUMERIC,
  unit            TEXT,
  evidence_ref    TEXT,
  is_override     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_afb_pack_variable_grain UNIQUE (pack_id, variable_name, grain_signature)
);
COMMENT ON TABLE assumption_field_bindings IS 'Individual assumption field values within packs. updated_at managed at app level.';

CREATE TABLE IF NOT EXISTS assumption_pack_bindings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id           UUID NOT NULL,
  assumption_set_id UUID NOT NULL,
  scope_bundle_id   UUID,
  applied_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE assumption_pack_bindings IS 'Binding of assumption packs to assumption sets.';

CREATE TABLE IF NOT EXISTS assumption_decision_links (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_pack_id UUID NOT NULL,
  decision_id        UUID NOT NULL,
  link_type          TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE assumption_decision_links IS 'Explicit links between assumption packs and decisions.';

-- -------------------------------------------------------
-- 2.11 Compute Model (entirely new in SpecOS)
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS compute_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL,
  scenario_id     UUID NOT NULL,
  version_id      UUID NOT NULL,
  scope_bundle_id UUID,
  trigger_type    compute_trigger_type,
  status          compute_status NOT NULL DEFAULT 'queued',
  triggered_by    TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ DEFAULT NULL,  -- NULL until run completes
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE compute_runs IS 'First-class compute execution records. updated_at managed at app level.';

CREATE TABLE IF NOT EXISTS compute_run_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compute_run_id  UUID NOT NULL,
  step_code       TEXT,
  step_order      INTEGER NOT NULL,
  status          compute_status NOT NULL DEFAULT 'queued',
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ DEFAULT NULL,  -- NULL until step completes
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE compute_run_steps IS 'Individual steps within a compute run.';

CREATE TABLE IF NOT EXISTS compute_validation_results (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compute_run_id   UUID NOT NULL,
  issue_code       TEXT,
  severity         validation_severity,
  stage_family     TEXT,
  surface_code     TEXT,
  entity_type      TEXT,
  entity_id        UUID,
  message          TEXT,
  resolution_state TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE compute_validation_results IS 'Validation issues found during compute runs.';

CREATE TABLE IF NOT EXISTS compute_dependency_snapshots (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compute_run_id       UUID NOT NULL,
  snapshot_hash        TEXT,
  dependency_manifest  JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE compute_dependency_snapshots IS 'Dependency snapshots for compute run reproducibility.';

CREATE TABLE IF NOT EXISTS compute_run_artifacts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compute_run_id  UUID NOT NULL,
  artifact_type   TEXT NOT NULL,
  artifact_url    TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE compute_run_artifacts IS 'Output artifacts produced by compute runs.';

-- -------------------------------------------------------
-- 2.12 Scenario Comparisons (SpecOS version — BMA3 has one too,
--       both are kept; ALTER TABLE reconciliation in section 3)
--       The BMA3 table has a different shape (scenario_ids UUID[]).
--       We do NOT create a duplicate — we reconcile in section 3.
-- -------------------------------------------------------

-- -------------------------------------------------------
-- 2.13 Confidence & Evidence Model (entirely new in SpecOS)
-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS evidence_items (
  evidence_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL,
  source_type       TEXT NOT NULL,
  source_name       TEXT,
  source_url        TEXT,
  title             TEXT NOT NULL,
  collection_date   DATE,
  effective_from    DATE,
  effective_to      DATE,
  geography_node_id UUID,
  method_note       TEXT,
  completeness_note TEXT,
  caveats_note      TEXT,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE evidence_items IS 'Evidence records used to justify assumptions. updated_at managed at app level.';

CREATE TABLE IF NOT EXISTS evidence_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id  UUID NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE evidence_links IS 'Polymorphic links between evidence items and target entities.';

CREATE TABLE IF NOT EXISTS confidence_assessments (
  assessment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID,
  entity_type    TEXT NOT NULL,
  entity_id      UUID NOT NULL,
  state          confidence_state NOT NULL DEFAULT 'unknown',
  numeric_score  NUMERIC CHECK (numeric_score IS NULL OR (numeric_score >= 0 AND numeric_score <= 100)),
  owner_user_id  TEXT,
  review_due_at  TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'draft',
  rationale      TEXT,
  evidence_count INTEGER DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE confidence_assessments IS 'Confidence evaluations attached to entities. updated_at managed at app level.';

CREATE TABLE IF NOT EXISTS dqi_scores (
  dqi_score_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type           TEXT NOT NULL,
  entity_id             UUID NOT NULL,
  source_quality_score  NUMERIC,
  freshness_score       NUMERIC,
  completeness_score    NUMERIC,
  relevance_score       NUMERIC,
  granularity_score     NUMERIC,
  consistency_score     NUMERIC,
  traceability_score    NUMERIC,
  overall_score         NUMERIC,
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE dqi_scores IS 'Data Quality Index sub-scores for assumptions and entities.';

CREATE TABLE IF NOT EXISTS confidence_rollups (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID,
  rollup_scope          TEXT NOT NULL,  -- family, market, scenario, version
  scope_id              UUID NOT NULL,
  weighted_score        NUMERIC,
  lowest_critical_score NUMERIC,
  assessment_count      INTEGER DEFAULT 0,
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE confidence_rollups IS 'Aggregated confidence summaries at higher levels.';

CREATE TABLE IF NOT EXISTS research_tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    UUID NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  assignee     TEXT,
  due_date     DATE,
  status       TEXT NOT NULL DEFAULT 'open',
  priority     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE research_tasks IS 'Research backlog for evidence gaps and confidence improvement. updated_at managed at app level.';

CREATE TABLE IF NOT EXISTS research_notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  research_task_id UUID NOT NULL,
  author           TEXT NOT NULL,
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE research_notes IS 'Notes and findings attached to research tasks.';

-- -------------------------------------------------------
-- 2.14 Governance Model additions (SpecOS adds sub-tables)
-- -------------------------------------------------------

-- approval_workflow_steps — BMA3 has approval_workflows but not the step table
CREATE TABLE IF NOT EXISTS approval_workflow_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL,
  step_order  INTEGER NOT NULL,
  approver    TEXT NOT NULL,
  action      TEXT,  -- approve, reject, defer
  acted_at    TIMESTAMPTZ,
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE approval_workflow_steps IS 'Individual steps within approval workflows.';

-- publication_events — tracks explicit publish/unpublish actions
CREATE TABLE IF NOT EXISTS publication_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id  UUID NOT NULL,
  action      TEXT NOT NULL CHECK (action IN ('publish', 'unpublish')),
  actor_id    TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE publication_events IS 'Specific publication/unpublication events for plan versions.';


-- ============================================================
-- 3. ALTER TABLE — MISSING COLUMNS ON SHARED TABLES
--    For each table present in both schemas, we add columns
--    that exist in SpecOS but are absent from BMA3.
--    BMA3-only columns are never touched.
-- ============================================================

-- -------------------------------------------------------
-- 3.1 companies
--     BMA3:  tenant_id, name, base_currency, fiscal_year_start_month,
--            country_code, metadata, created_at, updated_at, created_by,
--            is_deleted, deleted_at
--     SpecOS adds: slug, status (governance_status)
-- -------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS slug   TEXT,
  ADD COLUMN IF NOT EXISTS status governance_status NOT NULL DEFAULT 'draft';

COMMENT ON COLUMN companies.slug   IS 'URL-safe unique identifier for the company (SpecOS canonical).';
COMMENT ON COLUMN companies.status IS 'Governance lifecycle status (SpecOS canonical).';

-- Unique constraint on slug — only add if column was just created and constraint absent
DO $$ BEGIN
  ALTER TABLE companies ADD CONSTRAINT uq_companies_slug UNIQUE (slug);
EXCEPTION WHEN duplicate_table THEN NULL;  -- constraint already exists
END $$;

-- -------------------------------------------------------
-- 3.2 scenarios
--     BMA3:  tenant_id, company_id (FK), name, scenario_type, description,
--            base_scenario_id (FK), created_at, updated_at, created_by,
--            is_deleted, deleted_at
--     SpecOS adds: scenario_family (scenario_type), parent_scenario_id (UUID),
--                  status (governance_status)
--     NOTE: SpecOS uses 'parent_scenario_id' instead of BMA3's 'base_scenario_id'.
--           We add 'parent_scenario_id' as an alias; BMA3's base_scenario_id stays.
--           SpecOS uses 'scenario_family' for the type; BMA3 uses 'scenario_type'.
-- -------------------------------------------------------
ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS scenario_family    scenario_type,
  ADD COLUMN IF NOT EXISTS parent_scenario_id UUID,   -- nullable: root scenarios have no parent
  ADD COLUMN IF NOT EXISTS status             governance_status NOT NULL DEFAULT 'draft';

COMMENT ON COLUMN scenarios.scenario_family    IS 'SpecOS canonical scenario type (mirrors scenario_type for compatibility).';
COMMENT ON COLUMN scenarios.parent_scenario_id IS 'SpecOS canonical parent link (nullable; mirrors base_scenario_id).';
COMMENT ON COLUMN scenarios.status             IS 'Governance lifecycle status (SpecOS canonical).';

-- -------------------------------------------------------
-- 3.3 plan_versions
--     BMA3:  tenant_id, company_id (FK), scenario_id (FK),
--            assumption_set_id (FK), name, version_type, status (plan_status),
--            is_frozen, created_at, updated_at, created_by,
--            is_deleted, deleted_at
--     SpecOS adds: version_label (TEXT), status as governance_status,
--                  frozen_at (TIMESTAMPTZ DEFAULT NULL),
--                  published_at (TIMESTAMPTZ DEFAULT NULL)
--     KNOWN ISSUES FIXED:
--       - frozen_at / published_at must default to NULL (not NOW())
--       - SpecOS adds version_id / version_label concept
-- -------------------------------------------------------
ALTER TABLE plan_versions
  ADD COLUMN IF NOT EXISTS version_label TEXT,
  ADD COLUMN IF NOT EXISTS frozen_at     TIMESTAMPTZ DEFAULT NULL,  -- NULL until freeze action
  ADD COLUMN IF NOT EXISTS published_at  TIMESTAMPTZ DEFAULT NULL;  -- NULL until publish action

COMMENT ON COLUMN plan_versions.version_label IS 'Human-readable version label (SpecOS canonical).';
COMMENT ON COLUMN plan_versions.frozen_at     IS 'Timestamp when version was frozen; NULL until freeze action (SpecOS).';
COMMENT ON COLUMN plan_versions.published_at  IS 'Timestamp when version was published; NULL until publish action (SpecOS).';

-- -------------------------------------------------------
-- 3.4 planning_calendars
--     BMA3:  tenant_id, company_id (FK), name, start_date, end_date,
--            is_active, created_at, updated_at, created_by,
--            is_deleted, deleted_at
--     SpecOS adds: fiscal_year_start_month, status (governance_status)
--     NOTE: fiscal_year_start_month is on companies in BMA3 and
--           on planning_calendars in SpecOS — we add it to both.
-- -------------------------------------------------------
ALTER TABLE planning_calendars
  ADD COLUMN IF NOT EXISTS fiscal_year_start_month INTEGER
      CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  ADD COLUMN IF NOT EXISTS status governance_status NOT NULL DEFAULT 'draft';

COMMENT ON COLUMN planning_calendars.fiscal_year_start_month IS 'First month of fiscal year (1=Jan … 12=Dec). SpecOS canonical.';
COMMENT ON COLUMN planning_calendars.status                  IS 'Governance lifecycle status (SpecOS canonical).';

-- -------------------------------------------------------
-- 3.5 planning_periods
--     BMA3:  tenant_id, calendar_id (FK), name, start_date, end_date,
--            period_type (TEXT), sequence_order, is_locked,
--            created_at, updated_at, created_by, is_deleted, deleted_at
--     SpecOS adds: period_label (TEXT), fiscal_year (INTEGER),
--                  fiscal_quarter (INTEGER), sequence_number (INTEGER)
--     NOTE: SpecOS uses 'period_label' for the name and 'sequence_number'
--           instead of 'sequence_order'. We add both — BMA3 columns remain.
-- -------------------------------------------------------
ALTER TABLE planning_periods
  ADD COLUMN IF NOT EXISTS period_label    TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_year     INTEGER,
  ADD COLUMN IF NOT EXISTS fiscal_quarter  INTEGER,
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER;

COMMENT ON COLUMN planning_periods.period_label    IS 'SpecOS canonical period label (mirrors name).';
COMMENT ON COLUMN planning_periods.fiscal_year     IS 'Fiscal year this period belongs to (SpecOS canonical).';
COMMENT ON COLUMN planning_periods.fiscal_quarter  IS 'Fiscal quarter within the year, if applicable (SpecOS canonical).';
COMMENT ON COLUMN planning_periods.sequence_number IS 'SpecOS canonical ordering integer (mirrors sequence_order).';

-- Also add the date-range check constraint if missing
DO $$ BEGIN
  ALTER TABLE planning_periods
    ADD CONSTRAINT chk_planning_periods_dates CHECK (end_date >= start_date);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 3.6 assumption_sets
--     BMA3:  tenant_id, scenario_id (FK), name, is_active,
--            overall_confidence, owner_id, review_cadence,
--            created_at, updated_at, created_by, is_deleted, deleted_at
--     SpecOS adds: company_id (UUID), version_id (UUID NOT NULL),
--                  status (governance_status), owner (TEXT),
--                  confidence_state (confidence_state)
--     NOTE: version_id is NOT NULL in SpecOS spec. Because BMA3 rows
--           have no version_id yet, we add it as nullable first.
--           A follow-up migration can backfill and tighten the constraint.
-- -------------------------------------------------------
ALTER TABLE assumption_sets
  ADD COLUMN IF NOT EXISTS company_id       UUID,
  ADD COLUMN IF NOT EXISTS version_id       UUID,   -- nullable here; NOT NULL after backfill
  ADD COLUMN IF NOT EXISTS status           governance_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS owner            TEXT,
  ADD COLUMN IF NOT EXISTS confidence_state confidence_state;

COMMENT ON COLUMN assumption_sets.company_id       IS 'SpecOS canonical company scope (optional for multi-tenant compat).';
COMMENT ON COLUMN assumption_sets.version_id       IS 'Plan version this set belongs to (SpecOS canonical; nullable until backfilled).';
COMMENT ON COLUMN assumption_sets.status           IS 'Governance lifecycle status (SpecOS canonical).';
COMMENT ON COLUMN assumption_sets.owner            IS 'SpecOS canonical owner identifier (TEXT; mirrors owner_id UUID in BMA3).';
COMMENT ON COLUMN assumption_sets.confidence_state IS 'SpecOS confidence_state enum (replaces confidence_level in BMA3).';

-- -------------------------------------------------------
-- 3.7 governance_events
--     BMA3:  tenant_id, plan_version_id (FK), event_type (governance_event_type),
--            user_id (UUID), details (JSONB), created_at
--     SpecOS: company_id, version_id, event_type (TEXT), actor_id (TEXT),
--             occurred_at, metadata (JSONB)
--     We add SpecOS columns; BMA3 columns remain.
-- -------------------------------------------------------
ALTER TABLE governance_events
  ADD COLUMN IF NOT EXISTS company_id  UUID,
  ADD COLUMN IF NOT EXISTS version_id  UUID,   -- SpecOS FK alias for plan_version_id
  ADD COLUMN IF NOT EXISTS actor_id    TEXT,   -- SpecOS alias for user_id
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS metadata    JSONB;  -- SpecOS alias for details

COMMENT ON COLUMN governance_events.company_id  IS 'Company scope (SpecOS canonical).';
COMMENT ON COLUMN governance_events.version_id  IS 'SpecOS canonical alias for plan_version_id.';
COMMENT ON COLUMN governance_events.actor_id    IS 'SpecOS canonical actor identifier (TEXT; mirrors user_id UUID in BMA3).';
COMMENT ON COLUMN governance_events.occurred_at IS 'SpecOS canonical timestamp (mirrors created_at).';
COMMENT ON COLUMN governance_events.metadata    IS 'SpecOS canonical JSONB context (mirrors details).';

-- -------------------------------------------------------
-- 3.8 approval_workflows
--     BMA3:  tenant_id, plan_version_id (FK), approver_id (UUID),
--            approval_status (approval_status), comments (TEXT),
--            actioned_at (TIMESTAMPTZ), approval_step (INTEGER), created_at
--     SpecOS: company_id, version_id, workflow_type (TEXT),
--             status (governance_status), created_at, completed_at
--     We add SpecOS columns; BMA3 columns remain.
-- -------------------------------------------------------
ALTER TABLE approval_workflows
  ADD COLUMN IF NOT EXISTS company_id    UUID,
  ADD COLUMN IF NOT EXISTS version_id    UUID,  -- SpecOS alias for plan_version_id
  ADD COLUMN IF NOT EXISTS workflow_type TEXT,
  ADD COLUMN IF NOT EXISTS completed_at  TIMESTAMPTZ;

COMMENT ON COLUMN approval_workflows.company_id    IS 'Company scope (SpecOS canonical).';
COMMENT ON COLUMN approval_workflows.version_id    IS 'SpecOS canonical alias for plan_version_id.';
COMMENT ON COLUMN approval_workflows.workflow_type IS 'Workflow classification (SpecOS canonical).';
COMMENT ON COLUMN approval_workflows.completed_at  IS 'Timestamp when workflow completed (SpecOS canonical).';

-- -------------------------------------------------------
-- 3.9 scenario_comparisons
--     BMA3:  tenant_id, name, scenario_ids (UUID[]), metric_names (TEXT[]),
--            created_by (UUID), created_at
--     SpecOS: company_id, scenario_a_id (UUID), scenario_b_id (UUID),
--             version_a_id (UUID), version_b_id (UUID),
--             compute_run_id (UUID), comparison_data (JSONB), created_at
--     We add SpecOS structured columns; BMA3 array columns remain.
-- -------------------------------------------------------
ALTER TABLE scenario_comparisons
  ADD COLUMN IF NOT EXISTS company_id      UUID,
  ADD COLUMN IF NOT EXISTS scenario_a_id   UUID,
  ADD COLUMN IF NOT EXISTS scenario_b_id   UUID,
  ADD COLUMN IF NOT EXISTS version_a_id    UUID,
  ADD COLUMN IF NOT EXISTS version_b_id    UUID,
  ADD COLUMN IF NOT EXISTS compute_run_id  UUID,
  ADD COLUMN IF NOT EXISTS comparison_data JSONB;

COMMENT ON COLUMN scenario_comparisons.company_id      IS 'Company scope (SpecOS canonical).';
COMMENT ON COLUMN scenario_comparisons.scenario_a_id   IS 'First scenario in pairwise comparison (SpecOS canonical).';
COMMENT ON COLUMN scenario_comparisons.scenario_b_id   IS 'Second scenario in pairwise comparison (SpecOS canonical).';
COMMENT ON COLUMN scenario_comparisons.version_a_id    IS 'Plan version for scenario A (SpecOS canonical).';
COMMENT ON COLUMN scenario_comparisons.version_b_id    IS 'Plan version for scenario B (SpecOS canonical).';
COMMENT ON COLUMN scenario_comparisons.compute_run_id  IS 'Compute run that produced this comparison (SpecOS canonical).';
COMMENT ON COLUMN scenario_comparisons.comparison_data IS 'Structured comparison output JSONB (SpecOS canonical).';

-- -------------------------------------------------------
-- 3.10 driver_explainability
--      BMA3:  tenant_id, scenario_id (FK), planning_period_id (FK),
--             target_metric, driver_name, impact_amount, display_order, created_at
--      SpecOS: compute_run_id (UUID NOT NULL), target_metric, driver_name,
--              contribution_value (NUMERIC), contribution_pct (NUMERIC),
--              dimension_signatures (JSONB), created_at
--      We add SpecOS columns; BMA3 columns remain.
-- -------------------------------------------------------
ALTER TABLE driver_explainability
  ADD COLUMN IF NOT EXISTS compute_run_id       UUID,
  ADD COLUMN IF NOT EXISTS contribution_value   NUMERIC,
  ADD COLUMN IF NOT EXISTS contribution_pct     NUMERIC,
  ADD COLUMN IF NOT EXISTS dimension_signatures JSONB;

COMMENT ON COLUMN driver_explainability.compute_run_id       IS 'Compute run that generated this explanation (SpecOS canonical).';
COMMENT ON COLUMN driver_explainability.contribution_value   IS 'Absolute contribution of driver to target metric (SpecOS canonical).';
COMMENT ON COLUMN driver_explainability.contribution_pct     IS 'Percentage contribution of driver to target metric (SpecOS canonical).';
COMMENT ON COLUMN driver_explainability.dimension_signatures IS 'Dimension slices for this driver record (SpecOS canonical JSONB).';

-- -------------------------------------------------------
-- 3.11 pnl_projections
--      BMA3:  tenant_id, scenario_id (FK), planning_period_id (FK),
--             geographic_level, entity_id, gross_revenue, platform_commission,
--             discounts, net_revenue, cogs_total, gross_profit, labor_cost,
--             marketing_cost, opex_total, ebitda, depreciation, ebit,
--             interest_expense, net_income, created_at
--      SpecOS: company_id, scenario_id, version_id, period_id,
--              compute_run_id, metric_name (TEXT), value (NUMERIC),
--              dimension_signatures (JSONB)
--      SpecOS uses a narrow/tall schema; BMA3 uses wide rows.
--      We add the SpecOS columns so new compute runs can write either shape.
-- -------------------------------------------------------
ALTER TABLE pnl_projections
  ADD COLUMN IF NOT EXISTS company_id           UUID,
  ADD COLUMN IF NOT EXISTS version_id           UUID,
  ADD COLUMN IF NOT EXISTS period_id            UUID,  -- SpecOS alias for planning_period_id
  ADD COLUMN IF NOT EXISTS compute_run_id       UUID,
  ADD COLUMN IF NOT EXISTS metric_name          TEXT,
  ADD COLUMN IF NOT EXISTS value                NUMERIC,
  ADD COLUMN IF NOT EXISTS dimension_signatures JSONB;

COMMENT ON COLUMN pnl_projections.company_id           IS 'Company scope (SpecOS canonical).';
COMMENT ON COLUMN pnl_projections.version_id           IS 'Plan version (SpecOS canonical).';
COMMENT ON COLUMN pnl_projections.period_id            IS 'SpecOS canonical alias for planning_period_id.';
COMMENT ON COLUMN pnl_projections.compute_run_id       IS 'Compute run that produced this row (SpecOS canonical).';
COMMENT ON COLUMN pnl_projections.metric_name          IS 'SpecOS narrow-row metric name (e.g. gross_revenue, ebitda).';
COMMENT ON COLUMN pnl_projections.value                IS 'SpecOS narrow-row metric value.';
COMMENT ON COLUMN pnl_projections.dimension_signatures IS 'Dimension slice JSONB for this metric row (SpecOS canonical).';

-- -------------------------------------------------------
-- 3.12 cashflow_projections
--      BMA3:  tenant_id, scenario_id (FK), planning_period_id (FK),
--             opening_balance, operating_cashflow, investing_cashflow,
--             financing_cashflow, net_change, closing_balance,
--             cash_runway_months, created_at
--      SpecOS: company_id, version_id, period_id, compute_run_id,
--              metric_name, value, dimension_signatures
-- -------------------------------------------------------
ALTER TABLE cashflow_projections
  ADD COLUMN IF NOT EXISTS company_id           UUID,
  ADD COLUMN IF NOT EXISTS version_id           UUID,
  ADD COLUMN IF NOT EXISTS period_id            UUID,
  ADD COLUMN IF NOT EXISTS compute_run_id       UUID,
  ADD COLUMN IF NOT EXISTS metric_name          TEXT,
  ADD COLUMN IF NOT EXISTS value                NUMERIC,
  ADD COLUMN IF NOT EXISTS dimension_signatures JSONB;

COMMENT ON COLUMN cashflow_projections.company_id           IS 'Company scope (SpecOS canonical).';
COMMENT ON COLUMN cashflow_projections.version_id           IS 'Plan version (SpecOS canonical).';
COMMENT ON COLUMN cashflow_projections.period_id            IS 'SpecOS canonical alias for planning_period_id.';
COMMENT ON COLUMN cashflow_projections.compute_run_id       IS 'Compute run that produced this row (SpecOS canonical).';
COMMENT ON COLUMN cashflow_projections.metric_name          IS 'SpecOS narrow-row metric name.';
COMMENT ON COLUMN cashflow_projections.value                IS 'SpecOS narrow-row metric value.';
COMMENT ON COLUMN cashflow_projections.dimension_signatures IS 'Dimension slice JSONB (SpecOS canonical).';

-- -------------------------------------------------------
-- 3.13 balance_sheet_projections
--      BMA3:  tenant_id, scenario_id (FK), planning_period_id (FK),
--             wide columns for assets/liabilities/equity, created_at
--      SpecOS: narrow columns (company_id, version_id, period_id,
--              compute_run_id, metric_name, value, dimension_signatures)
-- -------------------------------------------------------
ALTER TABLE balance_sheet_projections
  ADD COLUMN IF NOT EXISTS company_id           UUID,
  ADD COLUMN IF NOT EXISTS version_id           UUID,
  ADD COLUMN IF NOT EXISTS period_id            UUID,
  ADD COLUMN IF NOT EXISTS compute_run_id       UUID,
  ADD COLUMN IF NOT EXISTS metric_name          TEXT,
  ADD COLUMN IF NOT EXISTS value                NUMERIC,
  ADD COLUMN IF NOT EXISTS dimension_signatures JSONB;

COMMENT ON COLUMN balance_sheet_projections.company_id           IS 'Company scope (SpecOS canonical).';
COMMENT ON COLUMN balance_sheet_projections.version_id           IS 'Plan version (SpecOS canonical).';
COMMENT ON COLUMN balance_sheet_projections.period_id            IS 'SpecOS canonical alias for planning_period_id.';
COMMENT ON COLUMN balance_sheet_projections.compute_run_id       IS 'Compute run that produced this row (SpecOS canonical).';
COMMENT ON COLUMN balance_sheet_projections.metric_name          IS 'SpecOS narrow-row metric name.';
COMMENT ON COLUMN balance_sheet_projections.value                IS 'SpecOS narrow-row metric value.';
COMMENT ON COLUMN balance_sheet_projections.dimension_signatures IS 'Dimension slice JSONB (SpecOS canonical).';

-- -------------------------------------------------------
-- 3.14 unit_economics_projections
--      BMA3:  tenant_id, scenario_id (FK), kitchen_id (FK),
--             planning_period_id (FK), aov, cac, clv,
--             orders_per_day, contribution_margin_1, contribution_margin_2,
--             ebitda_per_order, payback_months, created_at
--      SpecOS: narrow columns (company_id, version_id, period_id,
--              compute_run_id, metric_name, value, dimension_signatures)
-- -------------------------------------------------------
ALTER TABLE unit_economics_projections
  ADD COLUMN IF NOT EXISTS company_id           UUID,
  ADD COLUMN IF NOT EXISTS version_id           UUID,
  ADD COLUMN IF NOT EXISTS period_id            UUID,
  ADD COLUMN IF NOT EXISTS compute_run_id       UUID,
  ADD COLUMN IF NOT EXISTS metric_name          TEXT,
  ADD COLUMN IF NOT EXISTS value                NUMERIC,
  ADD COLUMN IF NOT EXISTS dimension_signatures JSONB;

COMMENT ON COLUMN unit_economics_projections.company_id           IS 'Company scope (SpecOS canonical).';
COMMENT ON COLUMN unit_economics_projections.version_id           IS 'Plan version (SpecOS canonical).';
COMMENT ON COLUMN unit_economics_projections.period_id            IS 'SpecOS canonical alias for planning_period_id.';
COMMENT ON COLUMN unit_economics_projections.compute_run_id       IS 'Compute run that produced this row (SpecOS canonical).';
COMMENT ON COLUMN unit_economics_projections.metric_name          IS 'SpecOS narrow-row metric name.';
COMMENT ON COLUMN unit_economics_projections.value                IS 'SpecOS narrow-row metric value.';
COMMENT ON COLUMN unit_economics_projections.dimension_signatures IS 'Dimension slice JSONB (SpecOS canonical).';

-- -------------------------------------------------------
-- 3.15 kpi_projections
--      BMA3:  tenant_id, scenario_id (FK), planning_period_id (FK),
--             kpi_name, kpi_category, kpi_value, target_value,
--             traffic_light, created_at
--      SpecOS: narrow columns (company_id, version_id, period_id,
--              compute_run_id, metric_name, value, dimension_signatures)
-- -------------------------------------------------------
ALTER TABLE kpi_projections
  ADD COLUMN IF NOT EXISTS company_id           UUID,
  ADD COLUMN IF NOT EXISTS version_id           UUID,
  ADD COLUMN IF NOT EXISTS period_id            UUID,
  ADD COLUMN IF NOT EXISTS compute_run_id       UUID,
  ADD COLUMN IF NOT EXISTS metric_name          TEXT,
  ADD COLUMN IF NOT EXISTS value                NUMERIC,
  ADD COLUMN IF NOT EXISTS dimension_signatures JSONB;

COMMENT ON COLUMN kpi_projections.company_id           IS 'Company scope (SpecOS canonical).';
COMMENT ON COLUMN kpi_projections.version_id           IS 'Plan version (SpecOS canonical).';
COMMENT ON COLUMN kpi_projections.period_id            IS 'SpecOS canonical alias for planning_period_id.';
COMMENT ON COLUMN kpi_projections.compute_run_id       IS 'Compute run that produced this row (SpecOS canonical).';
COMMENT ON COLUMN kpi_projections.metric_name          IS 'SpecOS narrow-row metric name (mirrors kpi_name).';
COMMENT ON COLUMN kpi_projections.value                IS 'SpecOS narrow-row metric value (mirrors kpi_value).';
COMMENT ON COLUMN kpi_projections.dimension_signatures IS 'Dimension slice JSONB (SpecOS canonical).';

-- -------------------------------------------------------
-- 3.16 decision_records
--      BMA3:  tenant_id, plan_version_id (FK), decision_title,
--             decision_type, decision_context, rationale, decided_by,
--             decided_at, created_at
--      SpecOS: company_id, scenario_id, version_id, family (decision_family),
--              status (governance_status), title, rationale_summary,
--              owner_user_id, scope_bundle_id, effective_period_id,
--              effective_to_period_id, metadata, is_deleted,
--              created_at, updated_at
--      We add the SpecOS columns; BMA3 columns remain.
-- -------------------------------------------------------
ALTER TABLE decision_records
  ADD COLUMN IF NOT EXISTS company_id             UUID,
  ADD COLUMN IF NOT EXISTS scenario_id            UUID,
  ADD COLUMN IF NOT EXISTS version_id             UUID,
  ADD COLUMN IF NOT EXISTS family                 decision_family,
  ADD COLUMN IF NOT EXISTS status                 governance_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS title                  TEXT,
  ADD COLUMN IF NOT EXISTS rationale_summary      TEXT,
  ADD COLUMN IF NOT EXISTS owner_user_id          TEXT,
  ADD COLUMN IF NOT EXISTS scope_bundle_id        UUID,
  ADD COLUMN IF NOT EXISTS effective_period_id    UUID,
  ADD COLUMN IF NOT EXISTS effective_to_period_id UUID,
  ADD COLUMN IF NOT EXISTS metadata               JSONB,
  ADD COLUMN IF NOT EXISTS is_deleted             BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at             TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN decision_records.company_id             IS 'Company scope (SpecOS canonical).';
COMMENT ON COLUMN decision_records.scenario_id            IS 'Scenario this decision belongs to (SpecOS canonical).';
COMMENT ON COLUMN decision_records.version_id             IS 'Plan version (SpecOS canonical).';
COMMENT ON COLUMN decision_records.family                 IS 'Decision family classification (SpecOS canonical).';
COMMENT ON COLUMN decision_records.status                 IS 'Governance lifecycle status (SpecOS canonical).';
COMMENT ON COLUMN decision_records.title                  IS 'SpecOS canonical title (mirrors decision_title in BMA3).';
COMMENT ON COLUMN decision_records.rationale_summary      IS 'Brief rationale (SpecOS canonical; mirrors rationale in BMA3).';
COMMENT ON COLUMN decision_records.owner_user_id          IS 'Owner user identifier TEXT (SpecOS canonical).';
COMMENT ON COLUMN decision_records.scope_bundle_id        IS 'Scope bundle this decision applies to (SpecOS canonical).';
COMMENT ON COLUMN decision_records.effective_period_id    IS 'Start period for decision effectivity (SpecOS canonical).';
COMMENT ON COLUMN decision_records.effective_to_period_id IS 'End period for decision effectivity (SpecOS canonical).';
COMMENT ON COLUMN decision_records.metadata               IS 'Extensible JSONB metadata (SpecOS canonical).';
COMMENT ON COLUMN decision_records.is_deleted             IS 'Soft-delete flag (SpecOS canonical).';
COMMENT ON COLUMN decision_records.updated_at             IS 'Last modification timestamp (SpecOS canonical).';

-- -------------------------------------------------------
-- 3.17 decision_outcomes
--      BMA3:  tenant_id, decision_record_id (FK), review_date,
--             outcome_summary, financial_variance, lesson_learned,
--             reviewed_by, created_at
--      SpecOS: decision_id (FK), outcome_type (TEXT NOT NULL),
--              outcome_summary, recorded_at, metadata (JSONB)
--      We add SpecOS columns; BMA3 columns remain.
-- -------------------------------------------------------
ALTER TABLE decision_outcomes
  ADD COLUMN IF NOT EXISTS decision_id  UUID,  -- SpecOS FK (mirrors decision_record_id)
  ADD COLUMN IF NOT EXISTS outcome_type TEXT,
  ADD COLUMN IF NOT EXISTS recorded_at  TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS metadata     JSONB;

COMMENT ON COLUMN decision_outcomes.decision_id  IS 'SpecOS canonical FK to decision_records (mirrors decision_record_id).';
COMMENT ON COLUMN decision_outcomes.outcome_type IS 'SpecOS canonical outcome classification.';
COMMENT ON COLUMN decision_outcomes.recorded_at  IS 'When the outcome was recorded (SpecOS canonical).';
COMMENT ON COLUMN decision_outcomes.metadata     IS 'Extensible JSONB metadata (SpecOS canonical).';

-- -------------------------------------------------------
-- 3.18 assumption_override_log
--      BMA3:  tenant_id, assumption_set_id (FK), field_name, old_value,
--             new_value, override_reason, overridden_by, overridden_at,
--             created_at
--      SpecOS: binding_id (FK → assumption_field_bindings), previous_value
--              (NUMERIC), new_value (NUMERIC), changed_by (TEXT),
--              changed_at (TIMESTAMPTZ), reason (TEXT)
--      We add SpecOS columns; BMA3 columns remain.
-- -------------------------------------------------------
ALTER TABLE assumption_override_log
  ADD COLUMN IF NOT EXISTS binding_id      UUID,   -- FK to assumption_field_bindings
  ADD COLUMN IF NOT EXISTS previous_value  NUMERIC,
  ADD COLUMN IF NOT EXISTS changed_by      TEXT,
  ADD COLUMN IF NOT EXISTS changed_at      TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reason          TEXT;

COMMENT ON COLUMN assumption_override_log.binding_id     IS 'SpecOS FK to assumption_field_bindings (fine-grained audit).';
COMMENT ON COLUMN assumption_override_log.previous_value IS 'Previous numeric value (SpecOS canonical; mirrors old_value TEXT in BMA3).';
COMMENT ON COLUMN assumption_override_log.changed_by     IS 'Actor who made the change (SpecOS canonical TEXT).';
COMMENT ON COLUMN assumption_override_log.changed_at     IS 'When the change occurred (SpecOS canonical).';
COMMENT ON COLUMN assumption_override_log.reason         IS 'Reason for the override (SpecOS canonical; mirrors override_reason in BMA3).';


-- ============================================================
-- 4. COLUMN TYPE / DEFAULT FIXES (KNOWN ISSUES)
-- ============================================================

-- 4.1 plan_versions.frozen_at / published_at defaults
--     These were just added in section 3 with DEFAULT NULL — correct.
--     If they already existed with a wrong default (e.g. DEFAULT NOW())
--     we correct the default here. PostgreSQL ALTER COLUMN SET DEFAULT
--     only changes future inserts; it is safe to run.
ALTER TABLE plan_versions
  ALTER COLUMN frozen_at    SET DEFAULT NULL,
  ALTER COLUMN published_at SET DEFAULT NULL;

COMMENT ON COLUMN plan_versions.frozen_at    IS 'NULL until freeze action — not a creation timestamp.';
COMMENT ON COLUMN plan_versions.published_at IS 'NULL until publish action — not a creation timestamp.';

-- 4.2 scenarios.parent_scenario_id — must be nullable (root scenarios have no parent)
--     Column was added as nullable in 3.2, which is correct.
--     If it somehow existed as NOT NULL, this fixes it:
ALTER TABLE scenarios
  ALTER COLUMN parent_scenario_id DROP NOT NULL;

-- 4.3 planning_periods.period_type
--     BMA3 defines this as TEXT NOT NULL DEFAULT 'month'.
--     SpecOS defines a period_type enum. We do NOT change the existing
--     column type (that would require a USING cast and could break apps).
--     Instead we note the canonical enum type is available via
--     the period_type enum created in section 1.10, and new code should
--     validate against it in application layer.
--     No DDL change needed — the TEXT column already accepts the same values.

-- 4.4 compute_runs.completed_at — must default to NULL
--     Added correctly in section 2.11. Explicit guard:
ALTER TABLE compute_runs
  ALTER COLUMN completed_at SET DEFAULT NULL;


-- ============================================================
-- 5. FOREIGN KEY CONSTRAINTS
--    We use DO blocks to handle the case where the constraint
--    already exists. pg_constraint is checked by name.
-- ============================================================

-- -------------------------------------------------------
-- 5.1 geography_nodes
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE geography_nodes
    ADD CONSTRAINT fk_geography_nodes_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE geography_nodes
    ADD CONSTRAINT fk_geography_nodes_parent
      FOREIGN KEY (parent_node_id) REFERENCES geography_nodes(node_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.2 format_taxonomy_nodes
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE format_taxonomy_nodes
    ADD CONSTRAINT fk_format_taxonomy_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE format_taxonomy_nodes
    ADD CONSTRAINT fk_format_taxonomy_parent
      FOREIGN KEY (parent_node_id) REFERENCES format_taxonomy_nodes(node_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.3 category_taxonomy_nodes
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE category_taxonomy_nodes
    ADD CONSTRAINT fk_category_taxonomy_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE category_taxonomy_nodes
    ADD CONSTRAINT fk_category_taxonomy_parent
      FOREIGN KEY (parent_node_id) REFERENCES category_taxonomy_nodes(node_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.4 portfolio_nodes
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE portfolio_nodes
    ADD CONSTRAINT fk_portfolio_nodes_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE portfolio_nodes
    ADD CONSTRAINT fk_portfolio_nodes_parent
      FOREIGN KEY (parent_node_id) REFERENCES portfolio_nodes(node_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.5 channel_taxonomy_nodes
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE channel_taxonomy_nodes
    ADD CONSTRAINT fk_channel_taxonomy_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE channel_taxonomy_nodes
    ADD CONSTRAINT fk_channel_taxonomy_parent
      FOREIGN KEY (parent_node_id) REFERENCES channel_taxonomy_nodes(node_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.6 operating_model_nodes
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE operating_model_nodes
    ADD CONSTRAINT fk_operating_model_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE operating_model_nodes
    ADD CONSTRAINT fk_operating_model_parent
      FOREIGN KEY (parent_node_id) REFERENCES operating_model_nodes(node_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.7 scope_bundles
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE scope_bundles
    ADD CONSTRAINT fk_scope_bundles_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE scope_bundles
    ADD CONSTRAINT fk_scope_bundles_scenario
      FOREIGN KEY (scenario_id) REFERENCES scenarios(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE scope_bundles
    ADD CONSTRAINT fk_scope_bundles_version
      FOREIGN KEY (version_id) REFERENCES plan_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.8 scope_bundle_items / scope_bundle_versions
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE scope_bundle_items
    ADD CONSTRAINT fk_scope_bundle_items_bundle
      FOREIGN KEY (scope_bundle_id) REFERENCES scope_bundles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE scope_bundle_versions
    ADD CONSTRAINT fk_scope_bundle_versions_bundle
      FOREIGN KEY (scope_bundle_id) REFERENCES scope_bundles(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.9 decision_dimensions / decision_dependencies / decision_rationales / decision_impacts
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE decision_dimensions
    ADD CONSTRAINT fk_decision_dimensions_decision
      FOREIGN KEY (decision_id) REFERENCES decision_records(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE decision_dependencies
    ADD CONSTRAINT fk_decision_deps_decision
      FOREIGN KEY (decision_id) REFERENCES decision_records(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE decision_dependencies
    ADD CONSTRAINT fk_decision_deps_depends_on
      FOREIGN KEY (depends_on_decision_id) REFERENCES decision_records(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE decision_rationales
    ADD CONSTRAINT fk_decision_rationales_decision
      FOREIGN KEY (decision_id) REFERENCES decision_records(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE decision_impacts
    ADD CONSTRAINT fk_decision_impacts_decision
      FOREIGN KEY (decision_id) REFERENCES decision_records(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.10 assumption_packs / assumption_field_bindings /
--       assumption_pack_bindings / assumption_decision_links
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE assumption_packs
    ADD CONSTRAINT fk_assumption_packs_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assumption_packs
    ADD CONSTRAINT fk_assumption_packs_scope_bundle
      FOREIGN KEY (scope_bundle_id) REFERENCES scope_bundles(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assumption_packs
    ADD CONSTRAINT fk_assumption_packs_decision
      FOREIGN KEY (decision_id) REFERENCES decision_records(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assumption_field_bindings
    ADD CONSTRAINT fk_afb_pack
      FOREIGN KEY (pack_id) REFERENCES assumption_packs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assumption_pack_bindings
    ADD CONSTRAINT fk_apb_pack
      FOREIGN KEY (pack_id) REFERENCES assumption_packs(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assumption_pack_bindings
    ADD CONSTRAINT fk_apb_assumption_set
      FOREIGN KEY (assumption_set_id) REFERENCES assumption_sets(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assumption_pack_bindings
    ADD CONSTRAINT fk_apb_scope_bundle
      FOREIGN KEY (scope_bundle_id) REFERENCES scope_bundles(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assumption_decision_links
    ADD CONSTRAINT fk_adl_pack
      FOREIGN KEY (assumption_pack_id) REFERENCES assumption_packs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assumption_decision_links
    ADD CONSTRAINT fk_adl_decision
      FOREIGN KEY (decision_id) REFERENCES decision_records(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE assumption_override_log
    ADD CONSTRAINT fk_aol_binding
      FOREIGN KEY (binding_id) REFERENCES assumption_field_bindings(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.11 assumption_sets — version_id FK (added in section 3.6)
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE assumption_sets
    ADD CONSTRAINT fk_assumption_sets_version
      FOREIGN KEY (version_id) REFERENCES plan_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.12 compute_runs / compute_run_steps / compute_validation_results /
--       compute_dependency_snapshots / compute_run_artifacts
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE compute_runs
    ADD CONSTRAINT fk_compute_runs_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE compute_runs
    ADD CONSTRAINT fk_compute_runs_scenario
      FOREIGN KEY (scenario_id) REFERENCES scenarios(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE compute_runs
    ADD CONSTRAINT fk_compute_runs_version
      FOREIGN KEY (version_id) REFERENCES plan_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE compute_runs
    ADD CONSTRAINT fk_compute_runs_scope_bundle
      FOREIGN KEY (scope_bundle_id) REFERENCES scope_bundles(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE compute_run_steps
    ADD CONSTRAINT fk_compute_run_steps_run
      FOREIGN KEY (compute_run_id) REFERENCES compute_runs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE compute_validation_results
    ADD CONSTRAINT fk_compute_validation_run
      FOREIGN KEY (compute_run_id) REFERENCES compute_runs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE compute_dependency_snapshots
    ADD CONSTRAINT fk_compute_dep_snapshots_run
      FOREIGN KEY (compute_run_id) REFERENCES compute_runs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE compute_run_artifacts
    ADD CONSTRAINT fk_compute_run_artifacts_run
      FOREIGN KEY (compute_run_id) REFERENCES compute_runs(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.13 Financial projections — SpecOS new columns added in section 3
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE pnl_projections
    ADD CONSTRAINT fk_pnl_company     FOREIGN KEY (company_id)     REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE pnl_projections
    ADD CONSTRAINT fk_pnl_version     FOREIGN KEY (version_id)     REFERENCES plan_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE pnl_projections
    ADD CONSTRAINT fk_pnl_compute_run FOREIGN KEY (compute_run_id) REFERENCES compute_runs(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE cashflow_projections
    ADD CONSTRAINT fk_cf_company     FOREIGN KEY (company_id)     REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE cashflow_projections
    ADD CONSTRAINT fk_cf_version     FOREIGN KEY (version_id)     REFERENCES plan_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE cashflow_projections
    ADD CONSTRAINT fk_cf_compute_run FOREIGN KEY (compute_run_id) REFERENCES compute_runs(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE balance_sheet_projections
    ADD CONSTRAINT fk_bs_company     FOREIGN KEY (company_id)     REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE balance_sheet_projections
    ADD CONSTRAINT fk_bs_version     FOREIGN KEY (version_id)     REFERENCES plan_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE balance_sheet_projections
    ADD CONSTRAINT fk_bs_compute_run FOREIGN KEY (compute_run_id) REFERENCES compute_runs(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE unit_economics_projections
    ADD CONSTRAINT fk_ue_company     FOREIGN KEY (company_id)     REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE unit_economics_projections
    ADD CONSTRAINT fk_ue_version     FOREIGN KEY (version_id)     REFERENCES plan_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE unit_economics_projections
    ADD CONSTRAINT fk_ue_compute_run FOREIGN KEY (compute_run_id) REFERENCES compute_runs(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE kpi_projections
    ADD CONSTRAINT fk_kpi_company     FOREIGN KEY (company_id)     REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE kpi_projections
    ADD CONSTRAINT fk_kpi_version     FOREIGN KEY (version_id)     REFERENCES plan_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE kpi_projections
    ADD CONSTRAINT fk_kpi_compute_run FOREIGN KEY (compute_run_id) REFERENCES compute_runs(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.14 driver_explainability — compute_run_id FK
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE driver_explainability
    ADD CONSTRAINT fk_driver_explain_compute_run
      FOREIGN KEY (compute_run_id) REFERENCES compute_runs(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.15 scenario_comparisons — SpecOS columns added in section 3
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE scenario_comparisons
    ADD CONSTRAINT fk_sc_company     FOREIGN KEY (company_id)    REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE scenario_comparisons
    ADD CONSTRAINT fk_sc_scenario_a  FOREIGN KEY (scenario_a_id) REFERENCES scenarios(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE scenario_comparisons
    ADD CONSTRAINT fk_sc_scenario_b  FOREIGN KEY (scenario_b_id) REFERENCES scenarios(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE scenario_comparisons
    ADD CONSTRAINT fk_sc_version_a   FOREIGN KEY (version_a_id)  REFERENCES plan_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE scenario_comparisons
    ADD CONSTRAINT fk_sc_version_b   FOREIGN KEY (version_b_id)  REFERENCES plan_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE scenario_comparisons
    ADD CONSTRAINT fk_sc_compute_run FOREIGN KEY (compute_run_id) REFERENCES compute_runs(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.16 evidence_items / evidence_links / confidence_assessments /
--       confidence_rollups / research_tasks / research_notes
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE evidence_items
    ADD CONSTRAINT fk_evidence_items_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE evidence_items
    ADD CONSTRAINT fk_evidence_items_geo_node
      FOREIGN KEY (geography_node_id) REFERENCES geography_nodes(node_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE evidence_links
    ADD CONSTRAINT fk_evidence_links_evidence
      FOREIGN KEY (evidence_id) REFERENCES evidence_items(evidence_id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE confidence_assessments
    ADD CONSTRAINT fk_confidence_assessments_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE confidence_rollups
    ADD CONSTRAINT fk_confidence_rollups_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE research_tasks
    ADD CONSTRAINT fk_research_tasks_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE research_notes
    ADD CONSTRAINT fk_research_notes_task
      FOREIGN KEY (research_task_id) REFERENCES research_tasks(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.17 governance_events — version_id FK (SpecOS)
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE governance_events
    ADD CONSTRAINT fk_governance_events_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE governance_events
    ADD CONSTRAINT fk_governance_events_version
      FOREIGN KEY (version_id) REFERENCES plan_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.18 approval_workflows — SpecOS columns
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE approval_workflows
    ADD CONSTRAINT fk_approval_workflows_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE approval_workflows
    ADD CONSTRAINT fk_approval_workflows_version
      FOREIGN KEY (version_id) REFERENCES plan_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.19 approval_workflow_steps / publication_events
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE approval_workflow_steps
    ADD CONSTRAINT fk_approval_steps_workflow
      FOREIGN KEY (workflow_id) REFERENCES approval_workflows(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE publication_events
    ADD CONSTRAINT fk_publication_events_version
      FOREIGN KEY (version_id) REFERENCES plan_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.20 scenarios — parent_scenario_id FK (SpecOS; mirrors base_scenario_id)
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE scenarios
    ADD CONSTRAINT fk_scenarios_parent_specos
      FOREIGN KEY (parent_scenario_id) REFERENCES scenarios(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- -------------------------------------------------------
-- 5.21 decision_records — SpecOS columns FKs
-- -------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE decision_records
    ADD CONSTRAINT fk_decision_records_company
      FOREIGN KEY (company_id) REFERENCES companies(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE decision_records
    ADD CONSTRAINT fk_decision_records_scenario
      FOREIGN KEY (scenario_id) REFERENCES scenarios(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE decision_records
    ADD CONSTRAINT fk_decision_records_version
      FOREIGN KEY (version_id) REFERENCES plan_versions(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE decision_records
    ADD CONSTRAINT fk_decision_records_scope_bundle
      FOREIGN KEY (scope_bundle_id) REFERENCES scope_bundles(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE decision_records
    ADD CONSTRAINT fk_decision_records_eff_period
      FOREIGN KEY (effective_period_id) REFERENCES planning_periods(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE decision_records
    ADD CONSTRAINT fk_decision_records_eff_to_period
      FOREIGN KEY (effective_to_period_id) REFERENCES planning_periods(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
-- 6. INDEXES (SpecOS canonical — all IF NOT EXISTS)
-- ============================================================

-- -------------------------------------------------------
-- 6.1 Planning Spine
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_scenarios_company_status
  ON scenarios (company_id, status);

CREATE INDEX IF NOT EXISTS idx_scenarios_parent
  ON scenarios (parent_scenario_id)
  WHERE parent_scenario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scenarios_active
  ON scenarios (company_id, status)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_plan_versions_scenario
  ON plan_versions (scenario_id);

CREATE INDEX IF NOT EXISTS idx_plan_versions_active
  ON plan_versions (scenario_id)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_planning_calendars_company
  ON planning_calendars (company_id);

CREATE INDEX IF NOT EXISTS idx_planning_periods_calendar
  ON planning_periods (calendar_id);

CREATE INDEX IF NOT EXISTS idx_planning_periods_dates
  ON planning_periods (start_date, end_date);

-- -------------------------------------------------------
-- 6.2 Geography & Taxonomy
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_geography_nodes_company
  ON geography_nodes (company_id);

CREATE INDEX IF NOT EXISTS idx_geography_nodes_parent
  ON geography_nodes (parent_node_id)
  WHERE parent_node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_geography_nodes_type
  ON geography_nodes (company_id, node_type);

CREATE INDEX IF NOT EXISTS idx_geography_nodes_label_trgm
  ON geography_nodes USING GIN (label gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_format_taxonomy_company
  ON format_taxonomy_nodes (company_id);

CREATE INDEX IF NOT EXISTS idx_format_taxonomy_parent
  ON format_taxonomy_nodes (parent_node_id)
  WHERE parent_node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_format_taxonomy_label_trgm
  ON format_taxonomy_nodes USING GIN (label gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_category_taxonomy_company
  ON category_taxonomy_nodes (company_id);

CREATE INDEX IF NOT EXISTS idx_category_taxonomy_parent
  ON category_taxonomy_nodes (parent_node_id)
  WHERE parent_node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_category_taxonomy_label_trgm
  ON category_taxonomy_nodes USING GIN (label gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_portfolio_nodes_company
  ON portfolio_nodes (company_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_nodes_parent
  ON portfolio_nodes (parent_node_id)
  WHERE parent_node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_portfolio_nodes_label_trgm
  ON portfolio_nodes USING GIN (label gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_channel_taxonomy_company
  ON channel_taxonomy_nodes (company_id);

CREATE INDEX IF NOT EXISTS idx_channel_taxonomy_parent
  ON channel_taxonomy_nodes (parent_node_id)
  WHERE parent_node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_channel_taxonomy_label_trgm
  ON channel_taxonomy_nodes USING GIN (label gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_operating_model_company
  ON operating_model_nodes (company_id);

CREATE INDEX IF NOT EXISTS idx_operating_model_parent
  ON operating_model_nodes (parent_node_id)
  WHERE parent_node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_taxonomy_bindings_entity
  ON taxonomy_bindings (source_entity_type, source_entity_id);

CREATE INDEX IF NOT EXISTS idx_taxonomy_bindings_node
  ON taxonomy_bindings (taxonomy_family, node_id);

-- -------------------------------------------------------
-- 6.3 Scope Bundles
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_scope_bundles_company
  ON scope_bundles (company_id);

CREATE INDEX IF NOT EXISTS idx_scope_bundles_scenario
  ON scope_bundles (scenario_id)
  WHERE scenario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scope_bundles_active
  ON scope_bundles (company_id, status)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_scope_bundle_items_bundle
  ON scope_bundle_items (scope_bundle_id);

CREATE INDEX IF NOT EXISTS idx_scope_bundle_versions_bundle
  ON scope_bundle_versions (scope_bundle_id);

-- -------------------------------------------------------
-- 6.4 Decision Model
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_decision_records_scenario_version
  ON decision_records (scenario_id, version_id, family);

CREATE INDEX IF NOT EXISTS idx_decision_records_company
  ON decision_records (company_id);

CREATE INDEX IF NOT EXISTS idx_decision_records_active
  ON decision_records (company_id, scenario_id)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_decision_dimensions_decision
  ON decision_dimensions (decision_id);

CREATE INDEX IF NOT EXISTS idx_decision_impacts_decision
  ON decision_impacts (decision_id);

CREATE INDEX IF NOT EXISTS idx_decision_deps_decision
  ON decision_dependencies (decision_id);

CREATE INDEX IF NOT EXISTS idx_decision_rationales_decision
  ON decision_rationales (decision_id);

CREATE INDEX IF NOT EXISTS idx_decision_outcomes_decision
  ON decision_outcomes (decision_id);

-- -------------------------------------------------------
-- 6.5 Assumption Model
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_assumption_sets_scenario_version
  ON assumption_sets (scenario_id, version_id);

CREATE INDEX IF NOT EXISTS idx_assumption_sets_active
  ON assumption_sets (scenario_id)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_assumption_packs_company
  ON assumption_packs (company_id);

CREATE INDEX IF NOT EXISTS idx_assumption_packs_active
  ON assumption_packs (company_id)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_afb_pack_variable
  ON assumption_field_bindings (pack_id, variable_name);

CREATE INDEX IF NOT EXISTS idx_apb_pack
  ON assumption_pack_bindings (pack_id);

CREATE INDEX IF NOT EXISTS idx_apb_set
  ON assumption_pack_bindings (assumption_set_id);

CREATE INDEX IF NOT EXISTS idx_adl_pack
  ON assumption_decision_links (assumption_pack_id);

CREATE INDEX IF NOT EXISTS idx_adl_decision
  ON assumption_decision_links (decision_id);

CREATE INDEX IF NOT EXISTS idx_aol_binding
  ON assumption_override_log (binding_id);

-- -------------------------------------------------------
-- 6.6 Compute Model
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_compute_runs_scenario_version_status
  ON compute_runs (scenario_id, version_id, status);

CREATE INDEX IF NOT EXISTS idx_compute_runs_company
  ON compute_runs (company_id);

CREATE INDEX IF NOT EXISTS idx_compute_run_steps_run
  ON compute_run_steps (compute_run_id);

CREATE INDEX IF NOT EXISTS idx_compute_validation_run_severity
  ON compute_validation_results (compute_run_id, severity);

CREATE INDEX IF NOT EXISTS idx_compute_dep_snapshots_run
  ON compute_dependency_snapshots (compute_run_id);

CREATE INDEX IF NOT EXISTS idx_compute_run_artifacts_run
  ON compute_run_artifacts (compute_run_id);

-- -------------------------------------------------------
-- 6.7 Financial Projections (SpecOS canonical composite indexes)
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_pnl_proj_lookup
  ON pnl_projections (company_id, scenario_id, version_id, period_id);

CREATE INDEX IF NOT EXISTS idx_pnl_proj_dim_sig
  ON pnl_projections USING GIN (dimension_signatures);

CREATE INDEX IF NOT EXISTS idx_cf_proj_lookup
  ON cashflow_projections (company_id, scenario_id, version_id, period_id);

CREATE INDEX IF NOT EXISTS idx_cf_proj_dim_sig
  ON cashflow_projections USING GIN (dimension_signatures);

CREATE INDEX IF NOT EXISTS idx_bs_proj_lookup
  ON balance_sheet_projections (company_id, scenario_id, version_id, period_id);

CREATE INDEX IF NOT EXISTS idx_bs_proj_dim_sig
  ON balance_sheet_projections USING GIN (dimension_signatures);

CREATE INDEX IF NOT EXISTS idx_ue_proj_lookup
  ON unit_economics_projections (company_id, scenario_id, version_id, period_id);

CREATE INDEX IF NOT EXISTS idx_ue_proj_dim_sig
  ON unit_economics_projections USING GIN (dimension_signatures);

CREATE INDEX IF NOT EXISTS idx_kpi_proj_lookup
  ON kpi_projections (company_id, scenario_id, version_id, period_id);

CREATE INDEX IF NOT EXISTS idx_kpi_proj_dim_sig
  ON kpi_projections USING GIN (dimension_signatures);

-- -------------------------------------------------------
-- 6.8 Analysis
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_driver_explain_run
  ON driver_explainability (compute_run_id);

CREATE INDEX IF NOT EXISTS idx_driver_explain_metric
  ON driver_explainability (target_metric);

CREATE INDEX IF NOT EXISTS idx_sc_company
  ON scenario_comparisons (company_id);

CREATE INDEX IF NOT EXISTS idx_sc_scenarios
  ON scenario_comparisons (scenario_a_id, scenario_b_id);

-- -------------------------------------------------------
-- 6.9 Confidence & Evidence
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_evidence_items_company
  ON evidence_items (company_id);

CREATE INDEX IF NOT EXISTS idx_evidence_items_source_type
  ON evidence_items (source_type);

CREATE INDEX IF NOT EXISTS idx_evidence_links_evidence
  ON evidence_links (evidence_id);

CREATE INDEX IF NOT EXISTS idx_evidence_links_entity
  ON evidence_links (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_confidence_assessments_entity
  ON confidence_assessments (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_confidence_assessments_state
  ON confidence_assessments (state);

CREATE INDEX IF NOT EXISTS idx_dqi_scores_entity
  ON dqi_scores (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_confidence_rollups_scope
  ON confidence_rollups (rollup_scope, scope_id);

CREATE INDEX IF NOT EXISTS idx_research_tasks_company
  ON research_tasks (company_id);

CREATE INDEX IF NOT EXISTS idx_research_tasks_entity
  ON research_tasks (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_research_tasks_status
  ON research_tasks (status);

CREATE INDEX IF NOT EXISTS idx_research_notes_task
  ON research_notes (research_task_id);

-- -------------------------------------------------------
-- 6.10 Governance
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_governance_events_version
  ON governance_events (version_id);

CREATE INDEX IF NOT EXISTS idx_governance_events_company
  ON governance_events (company_id);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_version
  ON approval_workflows (version_id);

CREATE INDEX IF NOT EXISTS idx_approval_workflow_steps_workflow
  ON approval_workflow_steps (workflow_id);

CREATE INDEX IF NOT EXISTS idx_publication_events_version
  ON publication_events (version_id);


-- ============================================================
-- 7. SPECOS CANONICAL VIEWS (CREATE OR REPLACE — idempotent)
-- ============================================================

-- 7.1 Financial summary — canonical union of P&L and cash flow
CREATE OR REPLACE VIEW vw_financial_summary_canonical AS
SELECT p.id, p.company_id, p.scenario_id, p.version_id, p.period_id,
       p.metric_name, p.value, p.dimension_signatures, p.compute_run_id,
       'pnl' AS source_table
FROM pnl_projections p
WHERE p.metric_name IS NOT NULL   -- SpecOS narrow-row shape only
UNION ALL
SELECT c.id, c.company_id, c.scenario_id, c.version_id, c.period_id,
       c.metric_name, c.value, c.dimension_signatures, c.compute_run_id,
       'cashflow' AS source_table
FROM cashflow_projections c
WHERE c.metric_name IS NOT NULL;  -- SpecOS narrow-row shape only

-- 7.2 Governance version state
CREATE OR REPLACE VIEW vw_governance_version_state AS
SELECT pv.id AS version_id,
       pv.scenario_id,
       pv.status AS version_status,
       pv.frozen_at,
       pv.published_at,
       ge.id AS event_id,
       ge.event_type,
       ge.actor_id,
       ge.occurred_at
FROM plan_versions pv
LEFT JOIN governance_events ge ON ge.version_id = pv.id;

-- 7.3 Scope bundle summary
CREATE OR REPLACE VIEW vw_scope_bundle_summary AS
SELECT sb.id,
       sb.company_id,
       sb.scenario_id,
       sb.version_id,
       sb.name,
       sb.status,
       sb.effective_from,
       sb.effective_to,
       sbi.dimension_family,
       sbi.node_type,
       sbi.node_id,
       sbi.grain_role,
       sbi.mode
FROM scope_bundles sb
JOIN scope_bundle_items sbi ON sbi.scope_bundle_id = sb.id;

-- 7.4 Assumption confidence (SpecOS pack-binding path)
CREATE OR REPLACE VIEW vw_assumption_confidence_legacy AS
SELECT aset.id AS assumption_set_id,
       aset.scenario_id,
       aset.version_id,
       aset.status,
       aset.confidence_state,
       ap.id AS pack_id,
       ap.family AS pack_family,
       afb.variable_name,
       afb.grain_signature,
       afb.value,
       afb.unit
FROM assumption_sets aset
JOIN assumption_pack_bindings apb ON apb.assumption_set_id = aset.id
JOIN assumption_packs ap ON ap.id = apb.pack_id
JOIN assumption_field_bindings afb ON afb.pack_id = ap.id;

-- 7.5 Compute freshness by version
CREATE OR REPLACE VIEW vw_compute_freshness_by_version AS
SELECT cr.id AS compute_run_id,
       cr.company_id,
       cr.scenario_id,
       cr.version_id,
       cr.status,
       cr.trigger_type,
       cr.started_at,
       cr.completed_at,
       cds.snapshot_hash
FROM compute_runs cr
LEFT JOIN compute_dependency_snapshots cds ON cds.compute_run_id = cr.id;

-- 7.6 Decision summary
CREATE OR REPLACE VIEW vw_decision_summary AS
SELECT dr.id,
       dr.company_id,
       dr.scenario_id,
       dr.version_id,
       dr.family,
       dr.title,
       dr.status,
       dr.owner_user_id,
       drat.summary AS rationale_summary,
       di.impact_dimension,
       di.impact_description
FROM decision_records dr
LEFT JOIN decision_rationales drat ON drat.decision_id = dr.id
LEFT JOIN decision_impacts di ON di.decision_id = dr.id;

-- 7.7 Market hierarchy legacy (geography_nodes compatibility view)
CREATE OR REPLACE VIEW vw_market_hierarchy_legacy AS
SELECT gn.node_id,
       gn.company_id,
       gn.node_type,
       gn.parent_node_id,
       gn.code,
       gn.label,
       gn.status,
       parent.label AS parent_label,
       parent.node_type AS parent_node_type
FROM geography_nodes gn
LEFT JOIN geography_nodes parent ON parent.node_id = gn.parent_node_id;


COMMIT;

-- ============================================================
-- POST-MIGRATION NOTES (non-executable reminders)
-- ============================================================
--
-- A. BACKFILL TASKS — should follow this migration in a separate script:
--    1. assumption_sets.version_id — backfill to earliest plan_version
--       per scenario, then tighten: ALTER TABLE assumption_sets
--       ALTER COLUMN version_id SET NOT NULL;
--    2. scenarios.scenario_family — backfill from existing scenario_type.
--    3. companies.status — already defaults to 'draft'; review live rows.
--    4. planning_periods.fiscal_year / fiscal_quarter — derive from
--       start_date and the calendar's fiscal_year_start_month.
--    5. planning_periods.period_label — backfill from existing name column.
--    6. governance_events.version_id — backfill from plan_version_id.
--    7. governance_events.actor_id  — backfill from user_id::TEXT.
--
-- B. BMA3-ONLY TABLES LEFT UNTOUCHED (not modified, not dropped):
--    actuals_bridge, assumption_confidence, assumption_lineage,
--    attractiveness_scores, capex_plans, capital_allocation_plans,
--    clusters, competitor_profiles, countries, debt_facilities,
--    debt_repayment_schedules, dilution_models, equity_rounds,
--    expansion_phases, expansion_plans, headcount_plans,
--    intraday_demand_slots, kitchens, labor_models, loyalty_cohorts,
--    macros, market_ramp_curves, marketing_plans, micros, mix_plans,
--    monte_carlo_runs, monte_carlo_summaries, opex_plans, order_headers,
--    order_lines, performance_alerts, platform_promotions, platforms,
--    portfolio_kpi_rollups, portfolio_market_allocations, portfolio_plans,
--    price_plans, product_families, product_skus, revenue_projection_lines,
--    risk_objects, risk_scenarios, scenario_sensitivity_matrices,
--    sensitivity_analyses, simulation_results, simulation_runs,
--    trigger_log, unit_cost_profiles, variance_attribution,
--    working_capital_policies.
--
-- C. ENUM COMPATIBILITY:
--    scenario_type — BMA3 values (bull_case, bear_case, stress_test,
--    custom) are preserved alongside SpecOS values (upside, downside,
--    strategic_option, management_case, investor_case). Application code
--    should map/alias as needed.
--
-- D. PROJECTION TABLE DUAL-SHAPE WARNING:
--    pnl_projections, cashflow_projections, balance_sheet_projections,
--    unit_economics_projections, kpi_projections now support both the
--    BMA3 wide-column shape and the SpecOS narrow metric_name/value shape.
--    Queries must filter on metric_name IS NOT NULL (SpecOS rows) or
--    metric_name IS NULL (BMA3 rows) until a full data migration is done.
-- ============================================================
