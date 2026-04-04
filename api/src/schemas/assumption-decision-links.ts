// Generated from specos/artifacts/canonical_schema.json → entities[name="assumption_decision_links"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a AssumptionDecisionLink */
export const AssumptionDecisionLinkInsert = z.object({
  assumption_pack_id: z.string().uuid(),
  decision_id: z.string().uuid(),
  link_type: z.enum(['parameterizes', 'constrains', 'informs', 'validates']).optional(),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const AssumptionDecisionLinkUpdate = AssumptionDecisionLinkInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const AssumptionDecisionLinkFull = AssumptionDecisionLinkInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type AssumptionDecisionLinkInsertType = z.infer<typeof AssumptionDecisionLinkInsert>;
export type AssumptionDecisionLinkUpdateType = z.infer<typeof AssumptionDecisionLinkUpdate>;
export type AssumptionDecisionLinkFullType = z.infer<typeof AssumptionDecisionLinkFull>;
