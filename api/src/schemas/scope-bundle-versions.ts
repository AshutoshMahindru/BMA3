// Generated from specos/artifacts/canonical_schema.json → entities[name="scope_bundle_versions"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a ScopeBundleVersion */
export const ScopeBundleVersionInsert = z.object({
  scope_bundle_id: z.string().uuid(),
  version_number: z.number().int(),
  snapshot_data: z.record(z.string(), z.unknown()),
  status: z.enum(['draft', 'approved', 'frozen', 'superseded']).optional(),
  created_by: z.string().uuid().nullable(),
  approved_by: z.string().uuid().nullable(),
  approved_at: z.string().datetime().nullable(),
  change_summary: z.string().nullable(),
});

/** Update schema — all fields optional */
export const ScopeBundleVersionUpdate = ScopeBundleVersionInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ScopeBundleVersionFull = ScopeBundleVersionInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ScopeBundleVersionInsertType = z.infer<typeof ScopeBundleVersionInsert>;
export type ScopeBundleVersionUpdateType = z.infer<typeof ScopeBundleVersionUpdate>;
export type ScopeBundleVersionFullType = z.infer<typeof ScopeBundleVersionFull>;
