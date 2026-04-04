// Generated from specos/artifacts/canonical_schema.json → entities[name="assumption_packs"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a AssumptionPack */
export const AssumptionPackInsert = z.object({
  company_id: z.string().uuid(),
  assumption_set_id: z.string().uuid().nullable(),
  assumption_family: z.enum(['product', 'market', 'capacity', 'operations', 'funding']),
  pack_name: z.string(),
  source_type: z.enum(['template', 'benchmark', 'copied', 'scenario_specific']).optional(),
  scope_bundle_id: z.string().uuid().nullable(),
  decision_id: z.string().uuid().nullable(),
  default_confidence_assessment_id: z.string().uuid().nullable(),
  status: z.enum(['active', 'draft', 'deprecated', 'archived']).optional(),
  effective_period_range: z.record(z.string(), z.unknown()).nullable(),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const AssumptionPackUpdate = AssumptionPackInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const AssumptionPackFull = AssumptionPackInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type AssumptionPackInsertType = z.infer<typeof AssumptionPackInsert>;
export type AssumptionPackUpdateType = z.infer<typeof AssumptionPackUpdate>;
export type AssumptionPackFullType = z.infer<typeof AssumptionPackFull>;
