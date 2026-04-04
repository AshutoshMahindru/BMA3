// Generated from specos/artifacts/canonical_schema.json → entities[name="compute_validation_results"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a ComputeValidationResult */
export const ComputeValidationResultInsert = z.object({
  compute_run_id: z.string().uuid().nullable(),
  validation_job_id: z.string().uuid().nullable(),
  issue_code: z.string(),
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  stage_family: z.string().nullable(),
  surface_code: z.string().nullable(),
  entity_type: z.string().nullable(),
  entity_id: z.string().uuid().nullable(),
  message: z.string(),
  resolution_state: z.enum(['open', 'acknowledged', 'resolved', 'suppressed', 'wont_fix']).optional(),
  resolved_by: z.string().uuid().nullable(),
  resolved_at: z.string().datetime().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const ComputeValidationResultUpdate = ComputeValidationResultInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ComputeValidationResultFull = ComputeValidationResultInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ComputeValidationResultInsertType = z.infer<typeof ComputeValidationResultInsert>;
export type ComputeValidationResultUpdateType = z.infer<typeof ComputeValidationResultUpdate>;
export type ComputeValidationResultFullType = z.infer<typeof ComputeValidationResultFull>;
