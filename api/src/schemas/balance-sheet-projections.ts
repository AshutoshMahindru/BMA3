// Generated from specos/artifacts/canonical_schema.json → entities[name="balance_sheet_projections"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a BalanceSheetProjection */
export const BalanceSheetProjectionInsert = z.object({
  company_id: z.string().uuid(),
  scenario_id: z.string().uuid(),
  version_id: z.string().uuid().nullable(),
  period_id: z.string().uuid().nullable(),
  compute_run_id: z.string().uuid().nullable(),
  metric_name: z.string(),
  value: z.number().nullable(),
  currency: z.string().nullable(),
  dimension_signatures: z.record(z.string(), z.unknown()).nullable(),
  scope_bundle_id: z.string().uuid().nullable(),
  is_provisional: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const BalanceSheetProjectionUpdate = BalanceSheetProjectionInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const BalanceSheetProjectionFull = BalanceSheetProjectionInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type BalanceSheetProjectionInsertType = z.infer<typeof BalanceSheetProjectionInsert>;
export type BalanceSheetProjectionUpdateType = z.infer<typeof BalanceSheetProjectionUpdate>;
export type BalanceSheetProjectionFullType = z.infer<typeof BalanceSheetProjectionFull>;
