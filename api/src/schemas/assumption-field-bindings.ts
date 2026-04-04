// Generated from specos/artifacts/canonical_schema.json → entities[name="assumption_field_bindings"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a AssumptionFieldBinding */
export const AssumptionFieldBindingInsert = z.object({
  pack_id: z.string().uuid(),
  variable_name: z.string(),
  grain_signature: z.record(z.string(), z.unknown()),
  value: z.record(z.string(), z.unknown()),
  unit: z.string().nullable(),
  data_type: z.enum(['numeric', 'percent', 'currency', 'index', 'boolean', 'text', 'date_range']).nullable(),
  is_override: z.boolean().optional(),
  inherited_from_id: z.string().uuid().nullable(),
  evidence_ref: z.string().uuid().nullable(),
  confidence_assessment_id: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const AssumptionFieldBindingUpdate = AssumptionFieldBindingInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const AssumptionFieldBindingFull = AssumptionFieldBindingInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type AssumptionFieldBindingInsertType = z.infer<typeof AssumptionFieldBindingInsert>;
export type AssumptionFieldBindingUpdateType = z.infer<typeof AssumptionFieldBindingUpdate>;
export type AssumptionFieldBindingFullType = z.infer<typeof AssumptionFieldBindingFull>;
