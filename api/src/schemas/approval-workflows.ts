// Generated from specos/artifacts/canonical_schema.json → entities[name="approval_workflows"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a ApprovalWorkflow */
export const ApprovalWorkflowInsert = z.object({
  company_id: z.string().uuid(),
  workflow_name: z.string(),
  entity_type: z.string(),
  status: z.enum(['active', 'draft', 'deprecated']).optional(),
  min_confidence_required: z.string().nullable(),
  description: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const ApprovalWorkflowUpdate = ApprovalWorkflowInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ApprovalWorkflowFull = ApprovalWorkflowInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ApprovalWorkflowInsertType = z.infer<typeof ApprovalWorkflowInsert>;
export type ApprovalWorkflowUpdateType = z.infer<typeof ApprovalWorkflowUpdate>;
export type ApprovalWorkflowFullType = z.infer<typeof ApprovalWorkflowFull>;
