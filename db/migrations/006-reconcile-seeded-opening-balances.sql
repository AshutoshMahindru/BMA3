-- Migration 006: reconcile seeded canonical assumption packs with the compute
-- engine's opening-balance model.
--
-- The local bootstrap previously seeded depreciation, amortization, and
-- opening debt balances directly into assumption packs. The current compute
-- runtime starts with zero opening PPE and zero opening equity, so those
-- seeded carried-state values produce guaranteed base-scenario warnings:
--   - negative PPE in step 11 when depreciation starts from a zero asset base
--   - balance-sheet imbalance in steps 11 and 16 when opening debt is present
--     without a corresponding opening asset/equity balance
--
-- Until opening balance-sheet state is modeled canonically, keep these
-- stateful/system-generated values at zero in the bootstrap assumptions.

BEGIN;

WITH seeded_scenarios AS (
  SELECT unnest(
    ARRAY[
      'cccccccc-0001-4000-8000-000000000001'::uuid,
      'cccccccc-0002-4000-8000-000000000001'::uuid,
      'cccccccc-0003-4000-8000-000000000001'::uuid,
      'cccccccc-0004-4000-8000-000000000001'::uuid
    ]
  ) AS scenario_id
),
target_bindings AS (
  SELECT afb.id
  FROM assumption_field_bindings afb
  JOIN assumption_packs ap
    ON ap.id = afb.pack_id
  JOIN assumption_sets aset
    ON aset.id = ap.assumption_set_id
  JOIN seeded_scenarios ss
    ON ss.scenario_id = aset.scenario_id
  WHERE afb.variable_name IN ('depreciation', 'amortization', 'debt_outstanding')
)
UPDATE assumption_field_bindings afb
SET value = 0,
    updated_at = NOW()
FROM target_bindings tb
WHERE afb.id = tb.id
  AND afb.value <> 0;

COMMIT;
