// Generated from specos/artifacts/canonical_schema.json → entities[name="decision_dependencies"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a DecisionDependency */
export const DecisionDependencyInsert = z.object({
  decision_id: z.string().uuid(),
  depends_on_decision_id: z.string().uuid(),
  dependency_type: z.enum(['prerequisite', 'blocking', 'informing', 'superseding']).optional(),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const DecisionDependencyUpdate = DecisionDependencyInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const DecisionDependencyFull = DecisionDependencyInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type DecisionDependencyInsertType = z.infer<typeof DecisionDependencyInsert>;
export type DecisionDependencyUpdateType = z.infer<typeof DecisionDependencyUpdate>;
export type DecisionDependencyFullType = z.infer<typeof DecisionDependencyFull>;
