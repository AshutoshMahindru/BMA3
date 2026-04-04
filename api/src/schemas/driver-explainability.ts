// Generated from specos/artifacts/canonical_schema.json → entities[name="driver_explainability"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a DriverExplainability */
export const DriverExplainabilityInsert = z.object({
  company_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  version_id: z.string().uuid().nullable(),
  period_id: z.string().uuid().nullable(),
  compute_run_id: z.string().uuid().nullable(),
  target_metric: z.string(),
  driver_name: z.string(),
  driver_type: z.string().nullable(),
  contribution_value: z.number().nullable(),
  contribution_pct: z.number().nullable(),
  direction: z.enum(['positive', 'negative', 'neutral']).nullable(),
  dimension_signatures: z.record(z.string(), z.unknown()).nullable(),
  confidence_note: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const DriverExplainabilityUpdate = DriverExplainabilityInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const DriverExplainabilityFull = DriverExplainabilityInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type DriverExplainabilityInsertType = z.infer<typeof DriverExplainabilityInsert>;
export type DriverExplainabilityUpdateType = z.infer<typeof DriverExplainabilityUpdate>;
export type DriverExplainabilityFullType = z.infer<typeof DriverExplainabilityFull>;
