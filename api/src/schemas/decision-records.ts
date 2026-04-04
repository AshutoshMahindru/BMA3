// Generated from specos/artifacts/canonical_schema.json → entities[name="decision_records"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a DecisionRecord */
export const DecisionRecordInsert = z.object({
  company_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  version_id: z.string().uuid().nullable(),
  decision_family: z.enum(['product', 'market', 'marketing', 'operations', 'governance']),
  decision_status: z.enum(['draft', 'proposed', 'accepted', 'active', 'revised', 'superseded', 'rejected', 'archived']).optional(),
  scope_bundle_id: z.string().uuid().nullable(),
  title: z.string(),
  rationale_summary: z.string().nullable(),
  owner_user_id: z.string().uuid().nullable(),
  effective_from_period_id: z.string().uuid().nullable(),
  effective_to_period_id: z.string().uuid().nullable(),
  confidence_assessment_id: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const DecisionRecordUpdate = DecisionRecordInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const DecisionRecordFull = DecisionRecordInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type DecisionRecordInsertType = z.infer<typeof DecisionRecordInsert>;
export type DecisionRecordUpdateType = z.infer<typeof DecisionRecordUpdate>;
export type DecisionRecordFullType = z.infer<typeof DecisionRecordFull>;
