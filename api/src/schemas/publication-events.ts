// Generated from specos/artifacts/canonical_schema.json → entities[name="publication_events"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a PublicationEvent */
export const PublicationEventInsert = z.object({
  company_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  version_id: z.string().uuid().nullable(),
  publication_type: z.enum(['internal_review', 'board_ready', 'investor_ready', 'operational', 'draft_share']),
  published_by: z.string().uuid().nullable(),
  published_at: z.string().datetime().optional(),
  audience: z.string().nullable(),
  notes: z.string().nullable(),
  compute_run_id: z.string().uuid().nullable(),
  confidence_snapshot: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const PublicationEventUpdate = PublicationEventInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const PublicationEventFull = PublicationEventInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type PublicationEventInsertType = z.infer<typeof PublicationEventInsert>;
export type PublicationEventUpdateType = z.infer<typeof PublicationEventUpdate>;
export type PublicationEventFullType = z.infer<typeof PublicationEventFull>;
