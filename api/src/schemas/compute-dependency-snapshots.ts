// Generated from specos/artifacts/canonical_schema.json → entities[name="compute_dependency_snapshots"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a ComputeDependencySnapshot */
export const ComputeDependencySnapshotInsert = z.object({
  compute_run_id: z.string().uuid(),
  snapshot_hash: z.string(),
  dependency_manifest: z.record(z.string(), z.unknown()),
  assumption_set_ids: z.record(z.string(), z.unknown()).nullable(),
  scope_bundle_state: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const ComputeDependencySnapshotUpdate = ComputeDependencySnapshotInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ComputeDependencySnapshotFull = ComputeDependencySnapshotInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ComputeDependencySnapshotInsertType = z.infer<typeof ComputeDependencySnapshotInsert>;
export type ComputeDependencySnapshotUpdateType = z.infer<typeof ComputeDependencySnapshotUpdate>;
export type ComputeDependencySnapshotFullType = z.infer<typeof ComputeDependencySnapshotFull>;
