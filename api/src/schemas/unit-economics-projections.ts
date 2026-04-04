// Generated from specos/artifacts/canonical_schema.json → entities[name="unit_economics_projections"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a UnitEconomicsProjection */
export const UnitEconomicsProjectionInsert = z.object({
  company_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  version_id: z.string().uuid().nullable(),
  period_id: z.string().uuid().nullable(),
  compute_run_id: z.string().uuid().nullable(),
  metric_name: z.string(),
  value: z.number().nullable(),
  currency: z.string().nullable(),
  dimension_signatures: z.record(z.string(), z.unknown()).nullable(),
  scope_bundle_id: z.string().uuid().nullable(),
  is_provisional: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const UnitEconomicsProjectionUpdate = UnitEconomicsProjectionInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const UnitEconomicsProjectionFull = UnitEconomicsProjectionInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type UnitEconomicsProjectionInsertType = z.infer<typeof UnitEconomicsProjectionInsert>;
export type UnitEconomicsProjectionUpdateType = z.infer<typeof UnitEconomicsProjectionUpdate>;
export type UnitEconomicsProjectionFullType = z.infer<typeof UnitEconomicsProjectionFull>;
