// Generated from specos/artifacts/canonical_schema.json → entities[name="compute_runs"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a ComputeRun */
export const ComputeRunInsert = z.object({
  company_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  version_id: z.string().uuid().nullable(),
  scope_bundle_id: z.string().uuid().nullable(),
  trigger_type: z.enum(['manual', 'auto', 'publish_gate', 'compare_prep', 'scheduled']),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled']).optional(),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  triggered_by: z.string().uuid().nullable(),
  error_message: z.string().nullable(),
  run_config: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const ComputeRunUpdate = ComputeRunInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ComputeRunFull = ComputeRunInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ComputeRunInsertType = z.infer<typeof ComputeRunInsert>;
export type ComputeRunUpdateType = z.infer<typeof ComputeRunUpdate>;
export type ComputeRunFullType = z.infer<typeof ComputeRunFull>;
