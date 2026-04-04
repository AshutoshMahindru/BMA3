-- Migration 004: Add canonical SpecOS columns required by compute nodes.
-- Keeps compatibility aliases in place while backfilling the canonical names
-- used by the generated schema and runtime queries.

BEGIN;

ALTER TABLE assumption_packs
  ADD COLUMN IF NOT EXISTS assumption_set_id UUID,
  ADD COLUMN IF NOT EXISTS assumption_family assumption_family,
  ADD COLUMN IF NOT EXISTS pack_name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

UPDATE assumption_packs
   SET assumption_family = COALESCE(assumption_family, family),
       pack_name = COALESCE(pack_name, name);

WITH pack_links AS (
  SELECT pack_id, MIN(assumption_set_id) AS assumption_set_id
    FROM assumption_pack_bindings
   GROUP BY pack_id
)
UPDATE assumption_packs ap
   SET assumption_set_id = pl.assumption_set_id
  FROM pack_links pl
 WHERE ap.id = pl.pack_id
   AND ap.assumption_set_id IS NULL;

DO $$ BEGIN
  ALTER TABLE assumption_packs
    ADD CONSTRAINT fk_assumption_packs_assumption_set
      FOREIGN KEY (assumption_set_id) REFERENCES assumption_sets(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE decision_records
  ADD COLUMN IF NOT EXISTS decision_family decision_family,
  ADD COLUMN IF NOT EXISTS decision_status TEXT,
  ADD COLUMN IF NOT EXISTS effective_from_period_id UUID,
  ADD COLUMN IF NOT EXISTS confidence_assessment_id UUID;

UPDATE decision_records
   SET decision_family = COALESCE(decision_family, family),
       decision_status = COALESCE(decision_status, status::text),
       effective_from_period_id = COALESCE(effective_from_period_id, effective_period_id);

COMMIT;
