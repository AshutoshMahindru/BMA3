// Generated from specos/artifacts/canonical_schema.json → entities[name="decision_impacts"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a DecisionImpact */
export const DecisionImpactInsert = z.object({
  decision_id: z.string().uuid(),
  impact_dimension: z.string(),
  impact_direction: z.enum(['positive', 'negative', 'neutral', 'mixed']).nullable(),
  impact_magnitude: z.enum(['low', 'medium', 'high', 'critical']).nullable(),
  impact_description: z.string().nullable(),
  quantitative_estimate: z.number().nullable(),
  estimate_unit: z.string().nullable(),
  confidence_level: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const DecisionImpactUpdate = DecisionImpactInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const DecisionImpactFull = DecisionImpactInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type DecisionImpactInsertType = z.infer<typeof DecisionImpactInsert>;
export type DecisionImpactUpdateType = z.infer<typeof DecisionImpactUpdate>;
export type DecisionImpactFullType = z.infer<typeof DecisionImpactFull>;
