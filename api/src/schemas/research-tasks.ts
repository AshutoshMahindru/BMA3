// Generated from specos/artifacts/canonical_schema.json → entities[name="research_tasks"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a ResearchTask */
export const ResearchTaskInsert = z.object({
  company_id: z.string().uuid(),
  scenario_id: z.string().uuid().nullable(),
  entity_type: z.string().nullable(),
  entity_id: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  status: z.enum(['open', 'in_progress', 'blocked', 'completed', 'cancelled']).optional(),
  assigned_to: z.string().uuid().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  completed_at: z.string().datetime().nullable(),
  outcome_summary: z.string().nullable(),
  evidence_items_created: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const ResearchTaskUpdate = ResearchTaskInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ResearchTaskFull = ResearchTaskInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ResearchTaskInsertType = z.infer<typeof ResearchTaskInsert>;
export type ResearchTaskUpdateType = z.infer<typeof ResearchTaskUpdate>;
export type ResearchTaskFullType = z.infer<typeof ResearchTaskFull>;
