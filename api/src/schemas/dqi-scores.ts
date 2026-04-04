// Generated from specos/artifacts/canonical_schema.json → entities[name="dqi_scores"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a DqiScore */
export const DqiScoreInsert = z.object({
  company_id: z.string().uuid(),
  entity_type: z.string(),
  entity_id: z.string().uuid(),
  confidence_assessment_id: z.string().uuid().nullable(),
  source_quality_score: z.number().int().min(0).nullable(),
  freshness_score: z.number().int().min(0).nullable(),
  completeness_score: z.number().int().min(0).nullable(),
  relevance_score: z.number().int().min(0).nullable(),
  granularity_score: z.number().int().min(0).nullable(),
  consistency_score: z.number().int().min(0).nullable(),
  traceability_score: z.number().int().min(0).nullable(),
  overall_score: z.number().int().min(0).nullable(),
  scoring_method: z.string().nullable(),
  scored_by: z.string().uuid().nullable(),
  scored_at: z.string().datetime().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const DqiScoreUpdate = DqiScoreInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const DqiScoreFull = DqiScoreInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type DqiScoreInsertType = z.infer<typeof DqiScoreInsert>;
export type DqiScoreUpdateType = z.infer<typeof DqiScoreUpdate>;
export type DqiScoreFullType = z.infer<typeof DqiScoreFull>;
