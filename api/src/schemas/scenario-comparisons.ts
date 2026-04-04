// Generated from specos/artifacts/canonical_schema.json → entities[name="scenario_comparisons"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a ScenarioComparison */
export const ScenarioComparisonInsert = z.object({
  company_id: z.string().uuid(),
  base_scenario_id: z.string().uuid(),
  base_version_id: z.string().uuid().nullable(),
  compare_scenario_id: z.string().uuid(),
  compare_version_id: z.string().uuid().nullable(),
  compute_run_id: z.string().uuid().nullable(),
  comparison_type: z.enum(['scenario_vs_scenario', 'version_vs_version', 'pre_post_change', 'actual_vs_plan']),
  delta_summary: z.record(z.string(), z.unknown()).nullable(),
  decision_deltas: z.record(z.string(), z.unknown()).nullable(),
  assumption_deltas: z.record(z.string(), z.unknown()).nullable(),
  confidence_comparison: z.record(z.string(), z.unknown()).nullable(),
  generated_at: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const ScenarioComparisonUpdate = ScenarioComparisonInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ScenarioComparisonFull = ScenarioComparisonInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ScenarioComparisonInsertType = z.infer<typeof ScenarioComparisonInsert>;
export type ScenarioComparisonUpdateType = z.infer<typeof ScenarioComparisonUpdate>;
export type ScenarioComparisonFullType = z.infer<typeof ScenarioComparisonFull>;
