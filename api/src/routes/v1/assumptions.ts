import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import { idSchema, requireTenantId } from './_shared';

const router = Router();

const AssumptionSetCreateBody = z.object({
  companyId: idSchema,
  scenarioId: idSchema,
  versionId: idSchema.optional(),
  name: z.string().min(1),
  baseSetId: idSchema.optional(),
});

const AssumptionSetPatchBody = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['draft', 'review', 'approved', 'frozen', 'archived']).optional(),
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
  targetSetId: idSchema,
  scopeBundleId: idSchema.optional(),
});

const BulkUpdateBody = z.object({
  companyId: idSchema,
  scenarioId: idSchema,
  versionId: idSchema.optional(),
  updates: z.array(z.object({
    fieldId: idSchema.optional(),
    variableName: z.string().optional(),
    value: z.any(),
    unit: z.string().optional(),
    grainSignature: z.record(z.string(), z.unknown()).optional(),
  })).min(1),
});

const OverrideCreateBody = z.object({
  fieldId: idSchema,
  overrideValue: z.any(),
  reason: z.string().min(1),
  evidenceRef: idSchema.optional(),
});

function traceId(req: Request): string {
  return (req.headers['x-trace-id'] as string) || 'no-trace-id';
}

function meta() {
  return { freshness: { source: 'database', timestamp: new Date().toISOString() } };
}

function paginate(query: Record<string, unknown>) {
  const limit = Math.min(Math.max(parseInt(String(query.limit ?? '50'), 10) || 50, 1), 200);
  const offset = Math.max(parseInt(String(query.offset ?? '0'), 10) || 0, 0);
  return { limit, offset };
}

function planningContext(query: Record<string, unknown>) {
  return {
    companyId: query.companyId as string | undefined,
    scenarioId: query.scenarioId as string | undefined,
    versionId: query.versionId as string | undefined,
  };
}

function setStatus(row: any): string {
  return row.is_active === false ? 'archived' : 'draft';
}

function notImplemented(req: Request, res: Response, message: string) {
  return res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message,
      trace_id: traceId(req),
    },
  });
}

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

    if (ctx.scenarioId) {
      clauses += ` AND s.id::text = $${idx++}`;
      params.push(ctx.scenarioId);
    }
    if (ctx.versionId) {
      clauses += ` AND EXISTS (
        SELECT 1
          FROM plan_versions pv
         WHERE pv.assumption_set_id = aset.id
           AND pv.id::text = $${idx++}
           AND pv.is_deleted = FALSE
      )`;
      params.push(ctx.versionId);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT aset.id, aset.name, aset.is_active, aset.created_at, aset.updated_at
         FROM assumption_sets aset
         JOIN scenarios s ON s.id = aset.scenario_id
        WHERE s.company_id::text = $1
          AND aset.is_deleted = FALSE
          AND s.is_deleted = FALSE
          ${clauses}
        ORDER BY aset.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({
      data: rows.map((row: any) => ({
        assumptionSetId: row.id,
        name: row.name,
        status: setStatus(row),
        createdAt: row.created_at,
      })),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/sets', validate(AssumptionSetCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  const client = await db.connect();
  let started = false;
  try {
    const { companyId, scenarioId, versionId, name, baseSetId } = req.body;

    const scenario = await client.query(
      `SELECT s.id, s.tenant_id
         FROM scenarios s
        WHERE s.id = $1 AND s.company_id = $2 AND s.is_deleted = FALSE`,
      [scenarioId, companyId],
    );

    if (scenario.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'SCENARIO_NOT_FOUND', message: `Scenario ${scenarioId} not found`, trace_id: traceId(req) },
      });
    }

    if (versionId) {
      const version = await client.query(
        'SELECT status, is_frozen FROM plan_versions WHERE id = $1 AND is_deleted = FALSE',
        [versionId],
      );
      if (version.rowCount && (version.rows[0].status === 'published' || version.rows[0].is_frozen)) {
        return res.status(409).json({
          error: { code: 'VERSION_FROZEN', message: 'Cannot create assumption set on a frozen or published version', trace_id: traceId(req) },
        });
      }
    }

    await client.query('BEGIN');
    started = true;

    const created = await client.query(
      `INSERT INTO assumption_sets (tenant_id, scenario_id, name, is_active, overall_confidence, review_cadence)
       VALUES ($1, $2, $3, TRUE, 'medium', 'Monthly')
       RETURNING id, name, is_active, created_at`,
      [scenario.rows[0].tenant_id || requireTenantId(req), scenarioId, name],
    );

    if (baseSetId) {
      await client.query(
        `INSERT INTO assumption_lineage (tenant_id, assumption_set_id, parent_assumption_set_id, change_reason)
         VALUES ($1, $2, $3, 'Created from base assumption set')`,
        [scenario.rows[0].tenant_id || requireTenantId(req), created.rows[0].id, baseSetId],
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      data: {
        assumptionSetId: created.rows[0].id,
        name: created.rows[0].name,
        createdAt: created.rows[0].created_at,
      },
      meta: meta(),
    });
  } catch (error) {
    if (started) {
      await client.query('ROLLBACK');
    }
    next(error);
  } finally {
    client.release();
  }
});

router.get('/sets/:assumptionSetId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assumptionSetId } = req.params;
    const result = await db.query(
      `SELECT id, name, is_active, created_at, updated_at
         FROM assumption_sets
        WHERE id = $1 AND is_deleted = FALSE`,
      [assumptionSetId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'ASSUMPTION_SET_NOT_FOUND', message: `Assumption set ${assumptionSetId} not found`, trace_id: traceId(req) },
      });
    }

    const fieldCount = await db.query(
      'SELECT COUNT(*)::int AS count FROM assumption_override_log WHERE assumption_set_id = $1',
      [assumptionSetId],
    );

    res.json({
      data: {
        assumptionSetId: result.rows[0].id,
        name: result.rows[0].name,
        status: setStatus(result.rows[0]),
        fieldCount: Number(fieldCount.rows[0]?.count || 0),
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/sets/:assumptionSetId', validate(AssumptionSetPatchBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assumptionSetId } = req.params;
    const current = await db.query(
      `SELECT id, name, is_active
         FROM assumption_sets
        WHERE id = $1 AND is_deleted = FALSE`,
      [assumptionSetId],
    );

    if (current.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'ASSUMPTION_SET_NOT_FOUND', message: `Assumption set ${assumptionSetId} not found`, trace_id: traceId(req) },
      });
    }

    const nextIsActive = req.body.status === 'archived' ? false : current.rows[0].is_active;
    const updated = await db.query(
      `UPDATE assumption_sets
          SET name = $2,
              is_active = $3,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, updated_at`,
      [assumptionSetId, req.body.name ?? current.rows[0].name, nextIsActive],
    );

    res.json({
      data: {
        assumptionSetId: updated.rows[0].id,
        name: updated.rows[0].name,
        updatedAt: updated.rows[0].updated_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/packs', async (_req: Request, res: Response) => {
  res.json({ data: [], meta: meta() });
});

router.post('/packs', validate(AssumptionPackCreateBody), async (req: Request, res: Response) =>
  notImplemented(req, res, 'Assumption packs are not backed by the current SQL schema yet.'));

router.post('/packs/:packId/apply', validate(ApplyPackBody), async (req: Request, res: Response) =>
  notImplemented(req, res, 'Assumption pack application is not backed by the current SQL schema yet.'));

function registerReadOnlyFamily(path: string) {
  router.get(`/${path}`, async (_req: Request, res: Response) => {
    res.json({ data: [], meta: meta() });
  });

  router.put(`/${path}/bulk`, validate(BulkUpdateBody), async (req: Request, res: Response) => {
    res.json({
      data: {
        updated: 0,
        skipped: req.body.updates.length,
        errors: [{ message: 'Canonical assumption field bindings are not backed by the current SQL schema yet.' }],
      },
      meta: meta(),
    });
  });
}

registerReadOnlyFamily('demand');
registerReadOnlyFamily('cost');
registerReadOnlyFamily('funding');
registerReadOnlyFamily('working-capital');

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
      clauses += ` AND s.id::text = $${idx++}`;
      params.push(ctx.scenarioId);
    }
    if (ctx.versionId) {
      clauses += ` AND EXISTS (
        SELECT 1
          FROM plan_versions pv
         WHERE pv.assumption_set_id = aset.id
           AND pv.id::text = $${idx++}
           AND pv.is_deleted = FALSE
      )`;
      params.push(ctx.versionId);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT aol.id, aol.field_name, aol.old_value, aol.new_value, aol.override_reason,
              aol.overridden_by, aol.overridden_at, aol.created_at
         FROM assumption_override_log aol
         JOIN assumption_sets aset ON aset.id = aol.assumption_set_id
         JOIN scenarios s ON s.id = aset.scenario_id
        WHERE s.company_id::text = $1
          ${clauses}
        ORDER BY aol.overridden_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({
      data: rows.map((row: any) => ({
        overrideId: row.id,
        fieldId: row.field_name,
        originalValue: row.old_value,
        overrideValue: row.new_value,
        reason: row.override_reason,
        actor: row.overridden_by,
        createdAt: row.created_at,
      })),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/overrides', validate(OverrideCreateBody), async (req: Request, res: Response) =>
  notImplemented(req, res, 'Canonical assumption field overrides are not backed by the current SQL schema yet.'));

export default router;
