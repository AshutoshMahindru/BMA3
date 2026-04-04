// Generated from specos/artifacts/canonical_schema.json → entities[name="decision_rationales"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a DecisionRationale */
export const DecisionRationaleInsert = z.object({
  decision_id: z.string().uuid(),
  summary: z.string(),
  rationale_type: z.enum(['strategic', 'financial', 'operational', 'risk', 'evidence_based', 'sme_judgment']).nullable(),
  evidence_ref: z.string().uuid().nullable(),
  authored_by: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const DecisionRationaleUpdate = DecisionRationaleInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const DecisionRationaleFull = DecisionRationaleInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type DecisionRationaleInsertType = z.infer<typeof DecisionRationaleInsert>;
export type DecisionRationaleUpdateType = z.infer<typeof DecisionRationaleUpdate>;
export type DecisionRationaleFullType = z.infer<typeof DecisionRationaleFull>;
