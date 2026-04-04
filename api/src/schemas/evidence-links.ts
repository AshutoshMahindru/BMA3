// Generated from specos/artifacts/canonical_schema.json → entities[name="evidence_links"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a EvidenceLink */
export const EvidenceLinkInsert = z.object({
  evidence_id: z.string().uuid(),
  entity_type: z.enum(['assumption_field', 'assumption_pack', 'decision', 'scope_bundle', 'compute_output', 'recommendation', 'version']),
  entity_id: z.string().uuid(),
  link_type: z.enum(['supports', 'contradicts', 'context', 'supersedes']).optional(),
  relevance_note: z.string().nullable(),
  linked_by: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const EvidenceLinkUpdate = EvidenceLinkInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const EvidenceLinkFull = EvidenceLinkInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type EvidenceLinkInsertType = z.infer<typeof EvidenceLinkInsert>;
export type EvidenceLinkUpdateType = z.infer<typeof EvidenceLinkUpdate>;
export type EvidenceLinkFullType = z.infer<typeof EvidenceLinkFull>;
