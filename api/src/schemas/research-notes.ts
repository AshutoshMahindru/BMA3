// Generated from specos/artifacts/canonical_schema.json → entities[name="research_notes"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a ResearchNote */
export const ResearchNoteInsert = z.object({
  research_task_id: z.string().uuid().nullable(),
  company_id: z.string().uuid(),
  note_type: z.enum(['observation', 'benchmark_summary', 'gap_analysis', 'recommendation', 'methodology', 'review_comment']).optional(),
  title: z.string().nullable(),
  content: z.string(),
  authored_by: z.string().uuid().nullable(),
  evidence_refs: z.record(z.string(), z.unknown()).nullable(),
  confidence_impact: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const ResearchNoteUpdate = ResearchNoteInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const ResearchNoteFull = ResearchNoteInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ResearchNoteInsertType = z.infer<typeof ResearchNoteInsert>;
export type ResearchNoteUpdateType = z.infer<typeof ResearchNoteUpdate>;
export type ResearchNoteFullType = z.infer<typeof ResearchNoteFull>;
