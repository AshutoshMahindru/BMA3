// Generated from specos/artifacts/canonical_schema.json → entities[name="decision_outcomes"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a DecisionOutcome */
export const DecisionOutcomeInsert = z.object({
  decision_id: z.string().uuid(),
  company_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  version_id: z.string().uuid().nullable(),
  outcome_type: z.enum(['expected', 'actual', 'post_mortem', 'forecast_update']),
  outcome_summary: z.string().nullable(),
  confidence_state_at_decision: z.string().nullable(),
  confidence_score_at_decision: z.number().int().nullable(),
  recorded_by: z.string().uuid().nullable(),
  recorded_at: z.string().datetime().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const DecisionOutcomeUpdate = DecisionOutcomeInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const DecisionOutcomeFull = DecisionOutcomeInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type DecisionOutcomeInsertType = z.infer<typeof DecisionOutcomeInsert>;
export type DecisionOutcomeUpdateType = z.infer<typeof DecisionOutcomeUpdate>;
export type DecisionOutcomeFullType = z.infer<typeof DecisionOutcomeFull>;
