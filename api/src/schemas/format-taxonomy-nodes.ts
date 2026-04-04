// Generated from specos/artifacts/canonical_schema.json → entities[name="format_taxonomy_nodes"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a FormatTaxonomyNode */
export const FormatTaxonomyNodeInsert = z.object({
  company_id: z.string().uuid().nullable(),
  taxonomy_family: z.string(),
  parent_node_id: z.string().uuid().nullable(),
  code: z.string(),
  label: z.string(),
  level: z.string().nullable(),
  description: z.string().nullable(),
  status: z.enum(['active', 'deprecated', 'draft', 'archived']).optional(),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  sort_order: z.number().int().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const FormatTaxonomyNodeUpdate = FormatTaxonomyNodeInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const FormatTaxonomyNodeFull = FormatTaxonomyNodeInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type FormatTaxonomyNodeInsertType = z.infer<typeof FormatTaxonomyNodeInsert>;
export type FormatTaxonomyNodeUpdateType = z.infer<typeof FormatTaxonomyNodeUpdate>;
export type FormatTaxonomyNodeFullType = z.infer<typeof FormatTaxonomyNodeFull>;
