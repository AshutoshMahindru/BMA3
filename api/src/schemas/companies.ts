// Generated from specos/artifacts/canonical_schema.json → entities[name="companies"]
// DO NOT EDIT — regenerate from SpecOS artifacts

import { z } from 'zod';

/** Insert schema — validates POST body for creating a Company */
export const CompanyInsert = z.object({
  slug: z.string(),
  name: z.string(),
  legal_name: z.string().nullable(),
  status: z.enum(['active', 'suspended', 'archived']).optional(),
  default_currency: z.string().optional(),
  fiscal_year_start_month: z.number().int().min(1).max(12).optional(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/** Update schema — all fields optional */
export const CompanyUpdate = CompanyInsert.partial();

/** Full entity schema — includes auto-generated fields */
export const CompanyFull = CompanyInsert.extend({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type CompanyInsertType = z.infer<typeof CompanyInsert>;
export type CompanyUpdateType = z.infer<typeof CompanyUpdate>;
export type CompanyFullType = z.infer<typeof CompanyFull>;
