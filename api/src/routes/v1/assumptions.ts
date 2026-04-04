/**
 * Assumption routes — /api/v1/assumptions
 * Generated from specos/artifacts/api_contracts.json (api_assumptions_001 – api_assumptions_017)
 * Column names sourced from specos/artifacts/canonical_schema.json
 *
 * Entities: assumption_sets, assumption_packs, assumption_pack_bindings,
 *           assumption_field_bindings, assumption_override_log
 *
 * The demand / cost / funding / working-capital endpoints read from
 * assumption_field_bindings filtered by assumption_family on the parent pack.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { validate } from '../../middleware/validate';
import { z } from 'zod';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function traceId(req: Request): string {
  return (req.headers['x-trace-id'] as string) || 'no-trace-id';
}

function meta() {
  return { freshness: { source: 'database', timestamp: new Date().toISOString() } };
}

function paginate(query: Record<string, any>): { limit: number; offset: number } {
  const limit = Math.min(Math.max(parseInt(query.limit as string, 10) || 50, 1), 200);
  const offset = Math.max(parseInt(query.offset as string, 10) || 0, 0);
  return { limit, offset };
}

/** Extract planning-context query params common to most assumption endpoints */
function planningContext(query: Record<string, any>) {
  return {
    companyId: query.companyId as string | undefined,
    scenarioId: query.scenarioId as string | undefined,
    versionId: query.versionId as string | undefined,
    periodId: query.periodId as string | undefined,
    scopeRef: query.scopeRef as string | undefined,
  };
}

// ─── Zod schemas for request bodies ──────────────────────────────────────────

const AssumptionSetCreateBody = z.object({
  companyId: z.string().uuid(),
  scenarioId: z.string().uuid(),
  versionId: z.string().uuid().optional(),
  name: z.string().min(1),
  baseSetId: z.string().uuid().optional(),
});

const AssumptionSetPatchBody = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['draft', 'review', 'approved', 'frozen', 'archived']).optional(),
  reason: z.string().optional(),
});

const AssumptionPackCreateBody = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  fields: z.array(z.object({
    variableName: z.string(),
    value: z.any(),
    unit: z.string().optional(),
    grainSignature: z.record(z.string(), z.unknown()).optional(),
  })).min(1),
  description: z.string().optional(),
});

const ApplyPackBody = z.object({
  targetSetId: z.string().uuid(),
  scopeBundleId: z.string().uuid().optional(),
});

const BulkUpdateBody = z.object({
  companyId: z.string().uuid(),
  scenarioId: z.string().uuid(),
  versionId: z.string().uuid(),
  updates: z.array(z.object({
    fieldId: z.string().uuid().optional(),
    variableName: z.string().optional(),
    value: z.any(),
    unit: z.string().optional(),
    grainSignature: z.record(z.string(), z.unknown()).optional(),
  })).min(1),
});

const OverrideCreateBody = z.object({
  fieldId: z.string().uuid(),
  overrideValue: z.any(),
  reason: z.string().min(1),
  evidenceRef: z.string().uuid().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// ASSUMPTION SETS  (api_assumptions_001 – 004)
// Table: assumption_sets
//   id, company_id, scenario_id, version_id, name, status, owner,
//   confidence_state, parent_set_id, metadata, created_at, updated_at
// ═══════════════════════════════════════════════════════════════════════════════

// api_assumptions_001: GET /sets
router.get('/sets', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!ctx.companyId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId query parameter is required', trace_id: traceId(req) },
      });
    }

    const { limit, offset } = paginate(req.query);
    const params: any[] = [ctx.companyId];
    let idx = 2;
    let clauses = '';

    if (ctx.scenarioId) { clauses += ` AND scenario_id = $${idx++}`; params.push(ctx.scenarioId); }
    if (ctx.versionId) { clauses += ` AND version_id = $${idx++}`; params.push(ctx.versionId); }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT id, company_id, scenario_id, version_id, name, status, owner,
              confidence_state, parent_set_id, metadata, created_at, updated_at
         FROM assumption_sets
        WHERE company_id = $1 ${clauses}
        ORDER BY created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({ data: rows, meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_assumptions_002: POST /sets
router.post('/sets', validate(AssumptionSetCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId, versionId, name, baseSetId } = req.body;

    // If version is frozen, reject
    if (versionId) {
      const ver = await db.query('SELECT status FROM plan_versions WHERE id = $1', [versionId]);
      if (ver.rowCount && (ver.rows[0].status === 'frozen' || ver.rows[0].status === 'published')) {
        return res.status(409).json({
          error: { code: 'VERSION_FROZEN', message: 'Cannot create assumption set on a frozen/published version', trace_id: traceId(req) },
        });
      }
    }

    const { rows } = await db.query(
      `INSERT INTO assumption_sets (company_id, scenario_id, version_id, name, parent_set_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, company_id, scenario_id, version_id, name, status, owner,
                 confidence_state, parent_set_id, metadata, created_at, updated_at`,
      [companyId, scenarioId, versionId || null, name, baseSetId || null],
    );

    res.status(201).json({ data: rows[0], meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_assumptions_003: GET /sets/:assumptionSetId
router.get('/sets/:assumptionSetId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assumptionSetId } = req.params;
    const { rows, rowCount } = await db.query(
      `SELECT id, company_id, scenario_id, version_id, name, status, owner,
              confidence_state, parent_set_id, metadata, created_at, updated_at
         FROM assumption_sets WHERE id = $1`,
      [assumptionSetId],
    );

    if (rowCount === 0) {
      return res.status(404).json({
        error: { code: 'ASSUMPTION_SET_NOT_FOUND', message: `Assumption set ${assumptionSetId} not found`, trace_id: traceId(req) },
      });
    }
    res.json({ data: rows[0], meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_assumptions_004: PATCH /sets/:assumptionSetId
router.patch('/sets/:assumptionSetId', validate(AssumptionSetPatchBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assumptionSetId } = req.params;
    const { name, status } = req.body;

    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (name !== undefined) { setClauses.push(`name = $${idx++}`); params.push(name); }
    if (status !== undefined) { setClauses.push(`status = $${idx++}`); params.push(status); }

    if (setClauses.length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'No updatable fields provided', trace_id: traceId(req) },
      });
    }

    setClauses.push(`updated_at = now()`);
    params.push(assumptionSetId);

    // Check version freeze
    const setRow = await db.query('SELECT version_id FROM assumption_sets WHERE id = $1', [assumptionSetId]);
    if (setRow.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'ASSUMPTION_SET_NOT_FOUND', message: `Assumption set ${assumptionSetId} not found`, trace_id: traceId(req) },
      });
    }
    if (setRow.rows[0].version_id) {
      const ver = await db.query('SELECT status FROM plan_versions WHERE id = $1', [setRow.rows[0].version_id]);
      if (ver.rowCount && (ver.rows[0].status === 'frozen' || ver.rows[0].status === 'published')) {
        return res.status(409).json({
          error: { code: 'VERSION_FROZEN', message: 'Cannot update assumption set on a frozen/published version', trace_id: traceId(req) },
        });
      }
    }

    const { rows, rowCount } = await db.query(
      `UPDATE assumption_sets SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, company_id, scenario_id, version_id, name, status, owner,
                 confidence_state, parent_set_id, metadata, created_at, updated_at`,
      params,
    );

    if (rowCount === 0) {
      return res.status(404).json({
        error: { code: 'ASSUMPTION_SET_NOT_FOUND', message: `Assumption set ${assumptionSetId} not found`, trace_id: traceId(req) },
      });
    }
    res.json({ data: rows[0], meta: meta() });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ASSUMPTION PACKS  (api_assumptions_005 – 007)
// Table: assumption_packs
//   id, company_id, assumption_set_id, assumption_family, pack_name,
//   source_type, scope_bundle_id, decision_id,
//   default_confidence_assessment_id, status, effective_period_range,
//   description, metadata, created_at, updated_at
// ═══════════════════════════════════════════════════════════════════════════════

// api_assumptions_005: GET /packs
router.get('/packs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!ctx.companyId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId query parameter is required', trace_id: traceId(req) },
      });
    }

    const { limit, offset } = paginate(req.query);
    const params: any[] = [ctx.companyId];
    let idx = 2;
    let clauses = '';

    if (ctx.scenarioId) {
      clauses += ` AND ap.assumption_set_id IN (SELECT id FROM assumption_sets WHERE scenario_id = $${idx++})`;
      params.push(ctx.scenarioId);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT ap.id, ap.company_id, ap.assumption_set_id, ap.assumption_family,
              ap.pack_name, ap.source_type, ap.scope_bundle_id, ap.decision_id,
              ap.default_confidence_assessment_id, ap.status, ap.effective_period_range,
              ap.description, ap.metadata, ap.created_at, ap.updated_at
         FROM assumption_packs ap
        WHERE ap.company_id = $1 ${clauses}
        ORDER BY ap.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({ data: rows, meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_assumptions_006: POST /packs
router.post('/packs', validate(AssumptionPackCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, category, fields, description } = req.body;
    // category maps to assumption_family
    const family = category || 'product';

    // We need a company_id from context header or body — infer from tenant
    const companyId = (req.query.companyId as string) || (req.headers['x-company-id'] as string);

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const packResult = await client.query(
        `INSERT INTO assumption_packs (company_id, assumption_family, pack_name, source_type, description)
         VALUES ($1, $2, $3, 'scenario_specific', $4)
         RETURNING id, company_id, assumption_set_id, assumption_family, pack_name,
                   source_type, scope_bundle_id, decision_id,
                   default_confidence_assessment_id, status, effective_period_range,
                   description, metadata, created_at, updated_at`,
        [companyId, family, name, description || null],
      );

      const packId = packResult.rows[0].id;

      // Insert field bindings
      for (const field of fields) {
        await client.query(
          `INSERT INTO assumption_field_bindings
             (pack_id, variable_name, grain_signature, value, unit)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            packId,
            field.variableName,
            JSON.stringify(field.grainSignature || {}),
            JSON.stringify(typeof field.value === 'object' ? field.value : { v: field.value }),
            field.unit || null,
          ],
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ data: packResult.rows[0], meta: meta() });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// api_assumptions_007: POST /packs/:packId/apply
router.post('/packs/:packId/apply', validate(ApplyPackBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { packId } = req.params;
    const { targetSetId, scopeBundleId } = req.body;

    // Verify pack exists
    const pack = await db.query('SELECT id, company_id FROM assumption_packs WHERE id = $1', [packId]);
    if (pack.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'ASSUMPTION_PACK_NOT_FOUND', message: `Pack ${packId} not found`, trace_id: traceId(req) },
      });
    }

    // Verify target set exists and version isn't frozen
    const targetSet = await db.query('SELECT id, version_id FROM assumption_sets WHERE id = $1', [targetSetId]);
    if (targetSet.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'ASSUMPTION_SET_NOT_FOUND', message: `Target set ${targetSetId} not found`, trace_id: traceId(req) },
      });
    }
    if (targetSet.rows[0].version_id) {
      const ver = await db.query('SELECT status FROM plan_versions WHERE id = $1', [targetSet.rows[0].version_id]);
      if (ver.rowCount && (ver.rows[0].status === 'frozen' || ver.rows[0].status === 'published')) {
        return res.status(409).json({
          error: { code: 'VERSION_FROZEN', message: 'Cannot apply pack to a frozen/published version', trace_id: traceId(req) },
        });
      }
    }

    // Create pack binding
    const { rows } = await db.query(
      `INSERT INTO assumption_pack_bindings (pack_id, scope_bundle_id, binding_status, applied_at)
       VALUES ($1, $2, 'active', now())
       RETURNING id, pack_id, scenario_id, version_id, scope_bundle_id,
                 binding_status, applied_by, applied_at, metadata, created_at, updated_at`,
      [packId, scopeBundleId || null],
    );

    // Also update the pack's assumption_set_id to the target
    await db.query(
      'UPDATE assumption_packs SET assumption_set_id = $1, updated_at = now() WHERE id = $2',
      [targetSetId, packId],
    );

    res.json({ data: { applied: true, binding: rows[0] }, meta: meta() });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DEMAND / COST / FUNDING / WORKING-CAPITAL ASSUMPTIONS
// (api_assumptions_008 – 015)
//
// These all read from assumption_field_bindings joined to assumption_packs
// filtered by assumption_family. The canonical tables are:
//
// assumption_packs.assumption_family ∈ ('product','market','capacity','operations','funding')
//
// Demand → product + market families
// Cost → capacity + operations families
// Funding → funding family
// Working-capital → operations family with specific variable names
//
// Table: assumption_field_bindings
//   id, pack_id, variable_name, grain_signature, value, unit, data_type,
//   is_override, inherited_from_id, evidence_ref, confidence_assessment_id,
//   metadata, created_at, updated_at
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generic handler for GET /assumptions/:family and PUT /assumptions/:family/bulk
 * Reduces code duplication for the 4 assumption categories.
 */
function buildAssumptionFamilyRoutes(
  path: string,
  families: string[],
) {
  // GET /assumptions/:path
  router.get(`/${path}`, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = planningContext(req.query);
      if (!ctx.companyId) {
        return res.status(400).json({
          error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId query parameter is required', trace_id: traceId(req) },
        });
      }

      const { limit, offset } = paginate(req.query);

      // Build family IN clause
      const familyPlaceholders = families.map((_, i) => `$${i + 2}`).join(', ');
      const params: any[] = [ctx.companyId, ...families];
      let idx = families.length + 2;
      let clauses = '';

      if (ctx.scenarioId) {
        clauses += ` AND aset.scenario_id = $${idx++}`;
        params.push(ctx.scenarioId);
      }
      if (ctx.versionId) {
        clauses += ` AND aset.version_id = $${idx++}`;
        params.push(ctx.versionId);
      }
      if (ctx.scopeRef) {
        clauses += ` AND ap.scope_bundle_id = $${idx++}`;
        params.push(ctx.scopeRef);
      }

      params.push(limit, offset);

      const { rows } = await db.query(
        `SELECT afb.id AS field_id, afb.variable_name AS name,
                afb.value, afb.unit, afb.grain_signature,
                afb.data_type, afb.is_override,
                afb.confidence_assessment_id, afb.evidence_ref,
                afb.metadata, afb.created_at, afb.updated_at
           FROM assumption_field_bindings afb
           JOIN assumption_packs ap ON ap.id = afb.pack_id
           LEFT JOIN assumption_sets aset ON aset.id = ap.assumption_set_id
          WHERE ap.company_id = $1
            AND ap.assumption_family IN (${familyPlaceholders})
            ${clauses}
          ORDER BY afb.variable_name ASC
          LIMIT $${idx++} OFFSET $${idx++}`,
        params,
      );

      res.json({ data: rows, meta: meta() });
    } catch (error) {
      next(error);
    }
  });

  // PUT /assumptions/:path/bulk
  router.put(`/${path}/bulk`, validate(BulkUpdateBody), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { companyId, scenarioId, versionId, updates } = req.body;

      // Check version freeze
      const ver = await db.query('SELECT status FROM plan_versions WHERE id = $1', [versionId]);
      if (ver.rowCount && (ver.rows[0].status === 'frozen' || ver.rows[0].status === 'published')) {
        return res.status(409).json({
          error: { code: 'VERSION_FROZEN', message: 'Cannot update assumptions on a frozen/published version', trace_id: traceId(req) },
        });
      }

      const client = await db.connect();
      let updatedCount = 0;
      let skippedCount = 0;
      const errors: any[] = [];

      try {
        await client.query('BEGIN');

        for (const update of updates) {
          if (update.fieldId) {
            // Update existing field binding
            const result = await client.query(
              `UPDATE assumption_field_bindings
                  SET value = $1, unit = COALESCE($2, unit), updated_at = now()
                WHERE id = $3
                  AND pack_id IN (
                    SELECT ap.id FROM assumption_packs ap
                    JOIN assumption_sets aset ON aset.id = ap.assumption_set_id
                    WHERE ap.company_id = $4
                      AND aset.scenario_id = $5
                      AND ap.assumption_family IN (${families.map((_, i) => `$${i + 6}`).join(', ')})
                  )
               RETURNING id`,
              [
                JSON.stringify(typeof update.value === 'object' ? update.value : { v: update.value }),
                update.unit || null,
                update.fieldId,
                companyId,
                scenarioId,
                ...families,
              ],
            );
            if (result.rowCount && result.rowCount > 0) {
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else if (update.variableName) {
            // Upsert by variable name — find pack and update
            const result = await client.query(
              `UPDATE assumption_field_bindings
                  SET value = $1, unit = COALESCE($2, unit), updated_at = now()
                WHERE variable_name = $3
                  AND pack_id IN (
                    SELECT ap.id FROM assumption_packs ap
                    JOIN assumption_sets aset ON aset.id = ap.assumption_set_id
                    WHERE ap.company_id = $4
                      AND aset.scenario_id = $5
                      AND ap.assumption_family IN (${families.map((_, i) => `$${i + 6}`).join(', ')})
                  )
               RETURNING id`,
              [
                JSON.stringify(typeof update.value === 'object' ? update.value : { v: update.value }),
                update.unit || null,
                update.variableName,
                companyId,
                scenarioId,
                ...families,
              ],
            );
            if (result.rowCount && result.rowCount > 0) {
              updatedCount += result.rowCount;
            } else {
              skippedCount++;
            }
          } else {
            skippedCount++;
            errors.push({ message: 'Update must include fieldId or variableName' });
          }
        }

        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      res.json({
        data: { updated: updatedCount, skipped: skippedCount, errors },
        meta: meta(),
      });
    } catch (error) {
      next(error);
    }
  });
}

// api_assumptions_008/009: demand (product + market families)
buildAssumptionFamilyRoutes('demand', ['product', 'market']);

// api_assumptions_010/011: cost (capacity + operations families)
buildAssumptionFamilyRoutes('cost', ['capacity', 'operations']);

// api_assumptions_012/013: funding
buildAssumptionFamilyRoutes('funding', ['funding']);

// api_assumptions_014/015: working-capital (operations family)
buildAssumptionFamilyRoutes('working-capital', ['operations']);

// ═══════════════════════════════════════════════════════════════════════════════
// OVERRIDES  (api_assumptions_016 – 017)
// Table: assumption_override_log
//   id, binding_id, previous_value, new_value, changed_by, changed_at,
//   reason, change_source, metadata, created_at, updated_at
// ═══════════════════════════════════════════════════════════════════════════════

// api_assumptions_016: GET /overrides
router.get('/overrides', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!ctx.companyId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId query parameter is required', trace_id: traceId(req) },
      });
    }

    const { limit, offset } = paginate(req.query);
    const params: any[] = [ctx.companyId];
    let idx = 2;
    let clauses = '';

    if (ctx.scenarioId) {
      clauses += ` AND aset.scenario_id = $${idx++}`;
      params.push(ctx.scenarioId);
    }
    if (ctx.versionId) {
      clauses += ` AND aset.version_id = $${idx++}`;
      params.push(ctx.versionId);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT aol.id AS override_id, aol.binding_id AS field_id,
              aol.previous_value AS original_value, aol.new_value AS override_value,
              aol.reason, aol.changed_by AS actor, aol.changed_at,
              aol.change_source, aol.metadata, aol.created_at
         FROM assumption_override_log aol
         JOIN assumption_field_bindings afb ON afb.id = aol.binding_id
         JOIN assumption_packs ap ON ap.id = afb.pack_id
         LEFT JOIN assumption_sets aset ON aset.id = ap.assumption_set_id
        WHERE ap.company_id = $1 ${clauses}
        ORDER BY aol.changed_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({ data: rows, meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_assumptions_017: POST /overrides
router.post('/overrides', validate(OverrideCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fieldId, overrideValue, reason, evidenceRef } = req.body;

    // Verify field binding exists
    const field = await db.query(
      'SELECT id, value, pack_id FROM assumption_field_bindings WHERE id = $1',
      [fieldId],
    );

    if (field.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'ASSUMPTION_FIELD_NOT_FOUND', message: `Field ${fieldId} not found`, trace_id: traceId(req) },
      });
    }

    const previousValue = field.rows[0].value;
    const packId = field.rows[0].pack_id;

    // Check version freeze via pack → set → version
    const verCheck = await db.query(
      `SELECT pv.status
         FROM assumption_packs ap
         JOIN assumption_sets aset ON aset.id = ap.assumption_set_id
         JOIN plan_versions pv ON pv.id = aset.version_id
        WHERE ap.id = $1 AND aset.version_id IS NOT NULL`,
      [packId],
    );
    if (verCheck.rowCount && (verCheck.rows[0].status === 'frozen' || verCheck.rows[0].status === 'published')) {
      return res.status(409).json({
        error: { code: 'VERSION_FROZEN', message: 'Cannot create override on a frozen/published version', trace_id: traceId(req) },
      });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Create override log entry
      const newValueJson = JSON.stringify(typeof overrideValue === 'object' ? overrideValue : { v: overrideValue });

      const { rows } = await client.query(
        `INSERT INTO assumption_override_log
           (binding_id, previous_value, new_value, changed_at, reason, change_source, metadata)
         VALUES ($1, $2, $3, now(), $4, 'manual', $5)
         RETURNING id, binding_id, previous_value, new_value, changed_at, reason, created_at`,
        [fieldId, JSON.stringify(previousValue), newValueJson, reason, evidenceRef ? JSON.stringify({ evidence_ref: evidenceRef }) : null],
      );

      // Update the field binding with the new value
      await client.query(
        `UPDATE assumption_field_bindings SET value = $1, is_override = true, updated_at = now() WHERE id = $2`,
        [newValueJson, fieldId],
      );

      await client.query('COMMIT');

      res.status(201).json({
        data: {
          overrideId: rows[0].id,
          fieldId: rows[0].binding_id,
          overrideValue: rows[0].new_value,
          createdAt: rows[0].created_at,
        },
        meta: meta(),
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

export default router;
