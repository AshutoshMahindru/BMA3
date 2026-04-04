// Generated from specos/artifacts/canonical_schema.json → entities[name="planning_calendars"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a PlanningCalendar */
export const PlanningCalendarInsert = z.object({
  company_id: z.string().uuid(),
  name: z.string(),
  fiscal_year_label: z.string(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  default_grain: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annual']).optional(),
  status: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const PlanningCalendarUpdate = PlanningCalendarInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const PlanningCalendarFull = PlanningCalendarInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type PlanningCalendarInsertType = z.infer<typeof PlanningCalendarInsert>;
export type PlanningCalendarUpdateType = z.infer<typeof PlanningCalendarUpdate>;
export type PlanningCalendarFullType = z.infer<typeof PlanningCalendarFull>;
