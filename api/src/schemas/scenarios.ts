// Generated from specos/artifacts/canonical_schema.json → entities[name="scenarios"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a Scenario */
export const ScenarioInsert = z.object({
  company_id: z.string().uuid(),
  name: z.string(),
  scenario_family: z.string().nullable(),
  parent_scenario_id: z.string().uuid().nullable(),
  status: z.enum(['draft', 'active', 'review', 'approved', 'archived']).optional(),
  description: z.string().nullable(),
  active_scope_bundle_id: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const ScenarioUpdate = ScenarioInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ScenarioFull = ScenarioInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ScenarioInsertType = z.infer<typeof ScenarioInsert>;
export type ScenarioUpdateType = z.infer<typeof ScenarioUpdate>;
export type ScenarioFullType = z.infer<typeof ScenarioFull>;
