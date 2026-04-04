// Generated from specos/artifacts/canonical_schema.json → entities[name="assumption_sets"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a AssumptionSet */
export const AssumptionSetInsert = z.object({
  company_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  version_id: z.string().uuid().nullable(),
  name: z.string().nullable(),
  status: z.enum(['draft', 'review', 'approved', 'frozen', 'archived']).optional(),
  owner: z.string().uuid().nullable(),
  confidence_state: z.string().nullable(),
  parent_set_id: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const AssumptionSetUpdate = AssumptionSetInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const AssumptionSetFull = AssumptionSetInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type AssumptionSetInsertType = z.infer<typeof AssumptionSetInsert>;
export type AssumptionSetUpdateType = z.infer<typeof AssumptionSetUpdate>;
export type AssumptionSetFullType = z.infer<typeof AssumptionSetFull>;
