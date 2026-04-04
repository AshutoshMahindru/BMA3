// Generated from specos/artifacts/canonical_schema.json → entities[name="plan_versions"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a PlanVersion */
export const PlanVersionInsert = z.object({
  company_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  version_number: z.number().int(),
  label: z.string().nullable(),
  status: z.enum(['draft', 'submitted', 'approved', 'frozen', 'published', 'archived']).optional(),
  created_by: z.string().uuid().nullable(),
  frozen_at: z.string().datetime().nullable(),
  published_at: z.string().datetime().nullable(),
  approved_by: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const PlanVersionUpdate = PlanVersionInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const PlanVersionFull = PlanVersionInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type PlanVersionInsertType = z.infer<typeof PlanVersionInsert>;
export type PlanVersionUpdateType = z.infer<typeof PlanVersionUpdate>;
export type PlanVersionFullType = z.infer<typeof PlanVersionFull>;
