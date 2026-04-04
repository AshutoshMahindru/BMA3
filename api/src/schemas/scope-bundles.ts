// Generated from specos/artifacts/canonical_schema.json → entities[name="scope_bundles"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a ScopeBundle */
export const ScopeBundleInsert = z.object({
  company_id: z.string().uuid(),
  scenario_id: z.string().uuid().nullable(),
  version_id: z.string().uuid().nullable(),
  bundle_name: z.string(),
  status: z.enum(['draft', 'active', 'approved', 'archived']).optional(),
  is_default: z.boolean().optional(),
  created_by: z.string().uuid().nullable(),
  approved_by: z.string().uuid().nullable(),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const ScopeBundleUpdate = ScopeBundleInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ScopeBundleFull = ScopeBundleInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ScopeBundleInsertType = z.infer<typeof ScopeBundleInsert>;
export type ScopeBundleUpdateType = z.infer<typeof ScopeBundleUpdate>;
export type ScopeBundleFullType = z.infer<typeof ScopeBundleFull>;
