// Generated from specos/artifacts/canonical_schema.json → entities[name="governance_events"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a GovernanceEvent */
export const GovernanceEventInsert = z.object({
  company_id: z.string().uuid(),
  scenario_id: z.string().uuid().nullable(),
  version_id: z.string().uuid().nullable(),
  event_type: z.enum(['created', 'submitted', 'approved', 'rejected', 'frozen', 'published', 'archived', 'unfrozen', 'review_requested', 'comment_added', 'override_applied']),
  entity_type: z.string().nullable(),
  entity_id: z.string().uuid().nullable(),
  actor_user_id: z.string().uuid().nullable(),
  actor_role: z.string().nullable(),
  previous_state: z.string().nullable(),
  new_state: z.string().nullable(),
  reason: z.string().nullable(),
  event_timestamp: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const GovernanceEventUpdate = GovernanceEventInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const GovernanceEventFull = GovernanceEventInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type GovernanceEventInsertType = z.infer<typeof GovernanceEventInsert>;
export type GovernanceEventUpdateType = z.infer<typeof GovernanceEventUpdate>;
export type GovernanceEventFullType = z.infer<typeof GovernanceEventFull>;
