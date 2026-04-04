// Generated from specos/artifacts/canonical_schema.json → entities[name="category_taxonomy_nodes"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a CategoryTaxonomyNode */
export const CategoryTaxonomyNodeInsert = z.object({
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
export const CategoryTaxonomyNodeUpdate = CategoryTaxonomyNodeInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const CategoryTaxonomyNodeFull = CategoryTaxonomyNodeInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type CategoryTaxonomyNodeInsertType = z.infer<typeof CategoryTaxonomyNodeInsert>;
export type CategoryTaxonomyNodeUpdateType = z.infer<typeof CategoryTaxonomyNodeUpdate>;
export type CategoryTaxonomyNodeFullType = z.infer<typeof CategoryTaxonomyNodeFull>;
