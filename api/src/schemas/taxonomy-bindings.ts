// Generated from specos/artifacts/canonical_schema.json → entities[name="taxonomy_bindings"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a TaxonomyBinding */
export const TaxonomyBindingInsert = z.object({
  company_id: z.string().uuid().nullable(),
  source_family: z.enum(['format', 'category', 'portfolio', 'channel', 'operating_model', 'geography']),
  source_node_id: z.string().uuid(),
  target_family: z.enum(['format', 'category', 'portfolio', 'channel', 'operating_model', 'geography']),
  target_node_id: z.string().uuid(),
  binding_type: z.enum(['compatible', 'default', 'required', 'excluded', 'recommended']).optional(),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const TaxonomyBindingUpdate = TaxonomyBindingInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const TaxonomyBindingFull = TaxonomyBindingInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type TaxonomyBindingInsertType = z.infer<typeof TaxonomyBindingInsert>;
export type TaxonomyBindingUpdateType = z.infer<typeof TaxonomyBindingUpdate>;
export type TaxonomyBindingFullType = z.infer<typeof TaxonomyBindingFull>;
