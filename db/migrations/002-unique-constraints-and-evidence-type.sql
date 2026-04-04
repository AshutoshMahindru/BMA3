-- Migration 002: Add UNIQUE constraints for ON CONFLICT upserts + evidence_type column
-- Generated: 2026-04-04
--
-- This migration addresses DDL gaps found during Wave 3/4 compute node development:
--   1. confidence_assessments needs UNIQUE(entity_type, entity_id) for ON CONFLICT upsert
--   2. dqi_scores needs UNIQUE(entity_type, entity_id) for ON CONFLICT upsert
--   3. confidence_rollups needs UNIQUE(company_id, rollup_scope, scope_id) for ON CONFLICT upsert
--   4. assumption_field_bindings gains an evidence_type column for DQI scoring
--
-- All guards are idempotent — safe to re-run.

BEGIN;

-- ============================================================
-- 1. UNIQUE CONSTRAINTS FOR ON CONFLICT UPSERTS
-- ============================================================

-- 1.1 confidence_assessments: UNIQUE(entity_type, entity_id)
--     The compute node confidence.ts uses:
--       ON CONFLICT (entity_type, entity_id) DO UPDATE SET ...
--     Migration 001 only created a non-unique index idx_confidence_assessments_entity.
--     We add the unique constraint; the existing index will be superseded.
DO $$ BEGIN
  ALTER TABLE confidence_assessments
    ADD CONSTRAINT uq_confidence_assessments_entity
      UNIQUE (entity_type, entity_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.2 dqi_scores: UNIQUE(entity_type, entity_id)
--     The compute node confidence.ts uses:
--       ON CONFLICT (entity_type, entity_id) DO UPDATE SET ...
--     Migration 001 only created a non-unique index idx_dqi_scores_entity.
DO $$ BEGIN
  ALTER TABLE dqi_scores
    ADD CONSTRAINT uq_dqi_scores_entity
      UNIQUE (entity_type, entity_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 1.3 confidence_rollups: UNIQUE(company_id, rollup_scope, scope_id)
--     The compute node confidence.ts uses:
--       ON CONFLICT (company_id, rollup_scope, scope_id) DO UPDATE SET ...
--     Migration 001 only created idx_confidence_rollups_scope (non-unique).
DO $$ BEGIN
  ALTER TABLE confidence_rollups
    ADD CONSTRAINT uq_confidence_rollups_scope
      UNIQUE (company_id, rollup_scope, scope_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. EVIDENCE_TYPE COLUMN ON ASSUMPTION_FIELD_BINDINGS
-- ============================================================
-- assumption_field_bindings currently has evidence_ref (TEXT) for reference
-- info but no explicit evidence_type enum column for DQI scoring.
-- The confidence node needs to know the evidence type per binding.

ALTER TABLE assumption_field_bindings
  ADD COLUMN IF NOT EXISTS evidence_type TEXT;

COMMENT ON COLUMN assumption_field_bindings.evidence_type IS
  'Evidence classification for DQI scoring: market_research, historical_data, industry_benchmark, expert_estimate, operator_input, unknown.';

COMMIT;
