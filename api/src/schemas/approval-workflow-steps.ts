// Generated from specos/artifacts/canonical_schema.json → entities[name="approval_workflow_steps"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a ApprovalWorkflowStep */
export const ApprovalWorkflowStepInsert = z.object({
  workflow_id: z.string().uuid(),
  step_order: z.number().int(),
  step_name: z.string(),
  required_role: z.string().nullable(),
  step_type: z.enum(['approval', 'review', 'sign_off', 'notification', 'conditional']).optional(),
  is_mandatory: z.boolean().optional(),
  condition_expression: z.record(z.string(), z.unknown()).nullable(),
  timeout_hours: z.number().int().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const ApprovalWorkflowStepUpdate = ApprovalWorkflowStepInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ApprovalWorkflowStepFull = ApprovalWorkflowStepInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ApprovalWorkflowStepInsertType = z.infer<typeof ApprovalWorkflowStepInsert>;
export type ApprovalWorkflowStepUpdateType = z.infer<typeof ApprovalWorkflowStepUpdate>;
export type ApprovalWorkflowStepFullType = z.infer<typeof ApprovalWorkflowStepFull>;
