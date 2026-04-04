// Generated from specos/artifacts/canonical_schema.json → entities[name="scope_bundle_items"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a ScopeBundleItem */
export const ScopeBundleItemInsert = z.object({
  scope_bundle_id: z.string().uuid(),
  dimension_family: z.enum(['format', 'category', 'portfolio', 'channel', 'operating_model', 'geography']),
  node_id: z.string().uuid(),
  grain_role: z.enum(['include', 'exclude', 'primary', 'secondary']).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const ScopeBundleItemUpdate = ScopeBundleItemInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ScopeBundleItemFull = ScopeBundleItemInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ScopeBundleItemInsertType = z.infer<typeof ScopeBundleItemInsert>;
export type ScopeBundleItemUpdateType = z.infer<typeof ScopeBundleItemUpdate>;
export type ScopeBundleItemFullType = z.infer<typeof ScopeBundleItemFull>;
