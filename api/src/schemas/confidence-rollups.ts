// Generated from specos/artifacts/canonical_schema.json → entities[name="confidence_rollups"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a ConfidenceRollup */
export const ConfidenceRollupInsert = z.object({
  company_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  version_id: z.string().uuid().nullable(),
  rollup_scope: z.enum(['assumption_family', 'market', 'category', 'scenario', 'version', 'portfolio', 'recommendation']),
  scope_ref_id: z.string().uuid().nullable(),
  scope_ref_label: z.string().nullable(),
  overall_state: z.enum(['high', 'medium', 'low', 'estimated', 'unknown']),
  overall_score: z.number().int().nullable(),
  component_count: z.number().int().nullable(),
  critical_low_count: z.number().int().nullable(),
  weakest_component_summary: z.string().nullable(),
  rollup_method: z.string().nullable(),
  computed_at: z.string().datetime().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const ConfidenceRollupUpdate = ConfidenceRollupInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ConfidenceRollupFull = ConfidenceRollupInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ConfidenceRollupInsertType = z.infer<typeof ConfidenceRollupInsert>;
export type ConfidenceRollupUpdateType = z.infer<typeof ConfidenceRollupUpdate>;
export type ConfidenceRollupFullType = z.infer<typeof ConfidenceRollupFull>;
