-- Migration 003: Ensure decision_rationales supports canonical upsert semantics
-- Adds UNIQUE(decision_id) so route-level rationale upserts can use
-- ON CONFLICT(decision_id) safely.

BEGIN;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY decision_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
    FROM decision_rationales
)
DELETE FROM decision_rationales
 WHERE id IN (
   SELECT id
     FROM ranked
    WHERE rn > 1
 );

DO $$ BEGIN
  ALTER TABLE decision_rationales
    ADD CONSTRAINT uq_decision_rationales_decision UNIQUE (decision_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
