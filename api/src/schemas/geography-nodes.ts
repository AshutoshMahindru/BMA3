// Generated from specos/artifacts/canonical_schema.json → entities[name="geography_nodes"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a GeographyNode */
export const GeographyNodeInsert = z.object({
  company_id: z.string().uuid().nullable(),
  parent_node_id: z.string().uuid().nullable(),
  node_type: z.enum(['region', 'country', 'state', 'cluster', 'macro_market', 'micro_market', 'site']),
  code: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  status: z.enum(['active', 'pipeline', 'planned', 'horizon', 'deprecated', 'archived']).optional(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  timezone: z.string().nullable(),
  currency: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const GeographyNodeUpdate = GeographyNodeInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const GeographyNodeFull = GeographyNodeInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type GeographyNodeInsertType = z.infer<typeof GeographyNodeInsert>;
export type GeographyNodeUpdateType = z.infer<typeof GeographyNodeUpdate>;
export type GeographyNodeFullType = z.infer<typeof GeographyNodeFull>;
