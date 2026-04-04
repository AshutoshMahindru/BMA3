// Generated from specos/artifacts/canonical_schema.json → entities[name="decision_dimensions"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a DecisionDimension */
export const DecisionDimensionInsert = z.object({
  decision_id: z.string().uuid(),
  dimension_family: z.enum(['format', 'category', 'portfolio', 'channel', 'operating_model', 'geography']),
  node_id: z.string().uuid(),
  role: z.enum(['target', 'context', 'comparison', 'exclusion']).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const DecisionDimensionUpdate = DecisionDimensionInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const DecisionDimensionFull = DecisionDimensionInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type DecisionDimensionInsertType = z.infer<typeof DecisionDimensionInsert>;
export type DecisionDimensionUpdateType = z.infer<typeof DecisionDimensionUpdate>;
export type DecisionDimensionFullType = z.infer<typeof DecisionDimensionFull>;
