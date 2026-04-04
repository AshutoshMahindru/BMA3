// Generated from specos/artifacts/canonical_schema.json → entities[name="evidence_items"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a EvidenceItem */
export const EvidenceItemInsert = z.object({
  company_id: z.string().uuid(),
  source_type: z.enum(['internal_historical', 'internal_actuals', 'primary_research', 'sme_judgment', 'field_observation', 'benchmark_dataset', 'secondary_research', 'vendor_info', 'modeled_estimate', 'template_default']),
  source_name: z.string().nullable(),
  source_url: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  collection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  effective_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  effective_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  geography_node_id: z.string().uuid().nullable(),
  format_relevance: z.string().nullable(),
  category_relevance: z.string().nullable(),
  method_note: z.string().nullable(),
  completeness_note: z.string().nullable(),
  caveats_note: z.string().nullable(),
  collected_by: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const EvidenceItemUpdate = EvidenceItemInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const EvidenceItemFull = EvidenceItemInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type EvidenceItemInsertType = z.infer<typeof EvidenceItemInsert>;
export type EvidenceItemUpdateType = z.infer<typeof EvidenceItemUpdate>;
export type EvidenceItemFullType = z.infer<typeof EvidenceItemFull>;
