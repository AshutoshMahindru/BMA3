// Generated from specos/artifacts/canonical_schema.json → entities[name="assumption_pack_bindings"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a AssumptionPackBinding */
export const AssumptionPackBindingInsert = z.object({
  pack_id: z.string().uuid(),
  scenario_id: z.string().uuid().nullable(),
  version_id: z.string().uuid().nullable(),
  scope_bundle_id: z.string().uuid().nullable(),
  binding_status: z.enum(['active', 'inactive', 'superseded']).optional(),
  applied_by: z.string().uuid().nullable(),
  applied_at: z.string().datetime().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const AssumptionPackBindingUpdate = AssumptionPackBindingInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const AssumptionPackBindingFull = AssumptionPackBindingInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type AssumptionPackBindingInsertType = z.infer<typeof AssumptionPackBindingInsert>;
export type AssumptionPackBindingUpdateType = z.infer<typeof AssumptionPackBindingUpdate>;
export type AssumptionPackBindingFullType = z.infer<typeof AssumptionPackBindingFull>;
