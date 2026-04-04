// Generated from specos/artifacts/canonical_schema.json → entities[name="assumption_override_log"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a AssumptionOverrideLog */
export const AssumptionOverrideLogInsert = z.object({
  binding_id: z.string().uuid(),
  previous_value: z.record(z.string(), z.unknown()).nullable(),
  new_value: z.record(z.string(), z.unknown()),
  changed_by: z.string().uuid().nullable(),
  changed_at: z.string().datetime().optional(),
  reason: z.string().nullable(),
  change_source: z.enum(['manual', 'ai_assisted', 'template', 'import', 'scenario_clone']).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const AssumptionOverrideLogUpdate = AssumptionOverrideLogInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const AssumptionOverrideLogFull = AssumptionOverrideLogInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type AssumptionOverrideLogInsertType = z.infer<typeof AssumptionOverrideLogInsert>;
export type AssumptionOverrideLogUpdateType = z.infer<typeof AssumptionOverrideLogUpdate>;
export type AssumptionOverrideLogFullType = z.infer<typeof AssumptionOverrideLogFull>;
