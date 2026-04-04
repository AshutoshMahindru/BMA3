// Generated from specos/artifacts/canonical_schema.json → entities[name="confidence_assessments"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a ConfidenceAssessment */
export const ConfidenceAssessmentInsert = z.object({
  company_id: z.string().uuid(),
  entity_type: z.enum(['assumption_field', 'assumption_pack', 'decision', 'scope_bundle', 'compute_output', 'recommendation', 'version']),
  entity_id: z.string().uuid(),
  state: z.enum(['high', 'medium', 'low', 'estimated', 'unknown']).optional(),
  numeric_score: z.number().int().min(0).nullable(),
  owner_user_id: z.string().uuid().nullable(),
  review_status: z.enum(['draft', 'under_research', 'reviewed', 'approved', 'expired', 'needs_refresh']).nullable(),
  last_reviewed_at: z.string().datetime().nullable(),
  review_due_at: z.string().datetime().nullable(),
  status: z.string().optional(),
  rationale: z.string().nullable(),
  evidence_count: z.number().int().nullable().optional(),
  downgrade_reason: z.string().nullable(),
  upgrade_reason: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const ConfidenceAssessmentUpdate = ConfidenceAssessmentInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ConfidenceAssessmentFull = ConfidenceAssessmentInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ConfidenceAssessmentInsertType = z.infer<typeof ConfidenceAssessmentInsert>;
export type ConfidenceAssessmentUpdateType = z.infer<typeof ConfidenceAssessmentUpdate>;
export type ConfidenceAssessmentFullType = z.infer<typeof ConfidenceAssessmentFull>;
