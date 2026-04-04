// Generated from specos/artifacts/canonical_schema.json → entities[name="compute_run_artifacts"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a ComputeRunArtifact */
export const ComputeRunArtifactInsert = z.object({
  compute_run_id: z.string().uuid(),
  artifact_type: z.enum(['pnl', 'cashflow', 'balance_sheet', 'unit_economics', 'kpi', 'sensitivity', 'comparison', 'driver_bridge', 'report']),
  artifact_ref: z.string().nullable(),
  row_count: z.number().int().nullable(),
  checksum: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const ComputeRunArtifactUpdate = ComputeRunArtifactInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ComputeRunArtifactFull = ComputeRunArtifactInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ComputeRunArtifactInsertType = z.infer<typeof ComputeRunArtifactInsert>;
export type ComputeRunArtifactUpdateType = z.infer<typeof ComputeRunArtifactUpdate>;
export type ComputeRunArtifactFullType = z.infer<typeof ComputeRunArtifactFull>;
