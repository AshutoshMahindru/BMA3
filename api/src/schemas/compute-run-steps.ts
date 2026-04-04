// Generated from specos/artifacts/canonical_schema.json → entities[name="compute_run_steps"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a ComputeRunStep */
export const ComputeRunStepInsert = z.object({
  compute_run_id: z.string().uuid(),
  step_code: z.string(),
  step_label: z.string().nullable(),
  step_order: z.number().int(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']).optional(),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  output_summary: z.record(z.string(), z.unknown()).nullable(),
  error_message: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const ComputeRunStepUpdate = ComputeRunStepInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ComputeRunStepFull = ComputeRunStepInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ComputeRunStepInsertType = z.infer<typeof ComputeRunStepInsert>;
export type ComputeRunStepUpdateType = z.infer<typeof ComputeRunStepUpdate>;
export type ComputeRunStepFullType = z.infer<typeof ComputeRunStepFull>;
