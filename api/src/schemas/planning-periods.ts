// Generated from specos/artifacts/canonical_schema.json → entities[name="planning_periods"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a PlanningPeriod */
export const PlanningPeriodInsert = z.object({
  calendar_id: z.string().uuid(),
  company_id: z.string().uuid(),
  label: z.string(),
  grain: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'half_year', 'annual']).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fiscal_year: z.number().int(),
  fiscal_quarter: z.number().int().min(1).max(4).nullable(),
  fiscal_month: z.number().int().min(1).max(12).nullable(),
  sequence_number: z.number().int(),
  trading_days: z.number().int().nullable(),
  is_actual: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const PlanningPeriodUpdate = PlanningPeriodInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const PlanningPeriodFull = PlanningPeriodInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type PlanningPeriodInsertType = z.infer<typeof PlanningPeriodInsert>;
export type PlanningPeriodUpdateType = z.infer<typeof PlanningPeriodUpdate>;
export type PlanningPeriodFullType = z.infer<typeof PlanningPeriodFull>;
