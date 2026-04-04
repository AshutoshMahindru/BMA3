import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import crypto from 'crypto';

const router = Router();

const ID_PATTERN = /^[0-9a-fA-F-]{36}$/;
const idSchema = z.string().regex(ID_PATTERN, 'Invalid identifier format');

const ValidationCreateBody = z.object({
  companyId: idSchema,
  scenarioId: idSchema,
  versionId: idSchema,
});

const ComputeRunCreateBody = z.object({
  companyId: idSchema,
  scenarioId: idSchema,
  versionId: idSchema,
  triggerType: z.enum(['manual', 'auto', 'publish_gate', 'compare_prep', 'scheduled']).optional(),
});

const CancelRunBody = z.object({
  reason: z.string().min(1),
});

function traceId(req: Request): string {
  return (req.headers['x-trace-id'] as string) || 'no-trace-id';
}

function meta(extra?: Record<string, unknown>) {
  return {
    freshness: { source: 'database', timestamp: new Date().toISOString() },
    ...(extra || {}),
  };
}

function paginate(query: Record<string, unknown>) {
  const limit = Math.min(Math.max(parseInt(String(query.limit ?? '50'), 10) || 50, 1), 200);
  const offset = Math.max(parseInt(String(query.offset ?? '0'), 10) || 0, 0);
  return { limit, offset };
}

async function ensurePlanningContext(companyId: string, scenarioId: string, versionId: string) {
  const version = await db.query(
    `SELECT pv.id, pv.company_id, pv.scenario_id, pv.assumption_set_id, pv.status, pv.is_frozen
       FROM plan_versions pv
      WHERE pv.id::text = $1
        AND pv.company_id::text = $2
        AND pv.scenario_id::text = $3
        AND pv.is_deleted = FALSE`,
    [versionId, companyId, scenarioId],
  );

  if (version.rowCount === 0) {
    return null;
  }

  return version.rows[0];
}

async function projectionCounts(scenarioId: string) {
  const [pnl, cash, balance, unit, kpi, explainability] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS count FROM pnl_projections WHERE scenario_id::text = $1', [scenarioId]),
    db.query('SELECT COUNT(*)::int AS count FROM cashflow_projections WHERE scenario_id::text = $1', [scenarioId]),
    db.query('SELECT COUNT(*)::int AS count FROM balance_sheet_projections WHERE scenario_id::text = $1', [scenarioId]),
    db.query('SELECT COUNT(*)::int AS count FROM unit_economics_projections WHERE scenario_id::text = $1', [scenarioId]),
    db.query('SELECT COUNT(*)::int AS count FROM kpi_projections WHERE scenario_id::text = $1', [scenarioId]),
    db.query('SELECT COUNT(*)::int AS count FROM driver_explainability WHERE scenario_id::text = $1', [scenarioId]),
  ]);

  return {
    pnl: Number(pnl.rows[0]?.count || 0),
    cashflow: Number(cash.rows[0]?.count || 0),
    balanceSheet: Number(balance.rows[0]?.count || 0),
    unitEconomics: Number(unit.rows[0]?.count || 0),
    kpis: Number(kpi.rows[0]?.count || 0),
    explainability: Number(explainability.rows[0]?.count || 0),
  };
}

async function insertStep(client: { query: (sql: string, params?: any[]) => Promise<any> }, runId: string, stepOrder: number, stepCode: string, stepLabel: string, outputSummary?: Record<string, unknown>) {
  await client.query(
    `INSERT INTO compute_run_steps
       (compute_run_id, step_code, step_label, step_order, status, started_at, completed_at, output_summary, metadata)
     VALUES ($1, $2, $3, $4, 'completed', NOW(), NOW(), $5::jsonb, '{}'::jsonb)`,
    [runId, stepCode, stepLabel, stepOrder, JSON.stringify(outputSummary || {})],
  );
}

const dependencyGraph = {
  nodes: [
    { id: 'planning_spine', label: 'Resolve Planning Spine', stage: 'context' },
    { id: 'financial_aggregate', label: 'Aggregate Seeded Financials', stage: 'compute' },
    { id: 'artifact_manifest', label: 'Record Artifacts', stage: 'finalize' },
  ],
  edges: [
    { from: 'planning_spine', to: 'financial_aggregate' },
    { from: 'financial_aggregate', to: 'artifact_manifest' },
  ],
  criticalPath: ['planning_spine', 'financial_aggregate', 'artifact_manifest'],
};

router.post('/validations', validate(ValidationCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId, versionId } = req.body;
    const version = await ensurePlanningContext(companyId, scenarioId, versionId);

    if (!version) {
      return res.status(404).json({
        error: { code: 'VERSION_NOT_FOUND', message: `Version ${versionId} not found`, trace_id: traceId(req) },
      });
    }

    const validationId = crypto.randomUUID();
    const counts = await projectionCounts(scenarioId);
    const hasOutputs = Object.values(counts).some((count) => count > 0);

    await db.query(
      `INSERT INTO compute_validation_results
         (validation_job_id, issue_code, severity, stage_family, message, resolution_state, metadata)
       VALUES ($1, 'VALIDATION_STARTED', 'info', 'compute', 'Validation completed', 'open', $2::jsonb)`,
      [validationId, JSON.stringify({ companyId, scenarioId, versionId, hasOutputs })],
    );

    if (!hasOutputs) {
      await db.query(
        `INSERT INTO compute_validation_results
           (validation_job_id, issue_code, severity, stage_family, message, resolution_state, metadata)
         VALUES ($1, 'NO_PROJECTIONS', 'warning', 'compute', 'No seeded financial projections were found for this scenario.', 'open', '{}'::jsonb)`,
        [validationId],
      );
    }

    res.status(201).json({
      data: {
        validationId,
        status: 'COMPLETED',
        issueCounts: hasOutputs ? {} : { warning: 1 },
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/validations/:validationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { validationId } = req.params;
    const result = await db.query(
      `SELECT validation_job_id, MIN(created_at) AS created_at, MAX(updated_at) AS completed_at
         FROM compute_validation_results
        WHERE validation_job_id::text = $1
        GROUP BY validation_job_id`,
      [validationId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'VALIDATION_NOT_FOUND', message: `Validation ${validationId} not found`, trace_id: traceId(req) },
      });
    }

    const issueCounts = await db.query(
      `SELECT severity, COUNT(*)::int AS count
         FROM compute_validation_results
        WHERE validation_job_id::text = $1
          AND issue_code != 'VALIDATION_STARTED'
        GROUP BY severity`,
      [validationId],
    );

    res.json({
      data: {
        validationId,
        status: 'COMPLETED',
        issueCounts: issueCounts.rows.reduce((acc: Record<string, number>, row: any) => {
          acc[row.severity] = Number(row.count);
          return acc;
        }, {}),
        createdAt: result.rows[0].created_at,
        completedAt: result.rows[0].completed_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/validations/:validationId/issues', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { validationId } = req.params;
    const severity = req.query.severity as string | undefined;
    const { limit, offset } = paginate(req.query);
    const params: any[] = [validationId];
    let idx = 2;
    let severityClause = '';

    if (severity) {
      severityClause = ` AND severity = $${idx++}`;
      params.push(severity);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT issue_code, severity, stage_family, surface_code, message, metadata
         FROM compute_validation_results
        WHERE validation_job_id::text = $1
          AND issue_code != 'VALIDATION_STARTED'
          ${severityClause}
        ORDER BY created_at ASC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({
      data: rows.map((row: any) => ({
        code: row.issue_code,
        severity: row.severity,
        stage: row.stage_family,
        surface: row.surface_code,
        message: row.message,
        entityRefs: row.metadata || {},
      })),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/runs', validate(ComputeRunCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  const client = await db.connect();
  let started = false;
  try {
    const { companyId, scenarioId, versionId, triggerType } = req.body;
    const version = await ensurePlanningContext(companyId, scenarioId, versionId);

    if (!version) {
      return res.status(404).json({
        error: { code: 'VERSION_NOT_FOUND', message: `Version ${versionId} not found`, trace_id: traceId(req) },
      });
    }

    if (version.status === 'published' || version.is_frozen) {
      return res.status(409).json({
        error: { code: 'VERSION_FROZEN', message: 'Cannot run compute on a frozen or published version', trace_id: traceId(req) },
      });
    }

    const counts = await projectionCounts(scenarioId);
    const warnings = Object.values(counts).some((count) => count > 0)
      ? []
      : ['No seeded financial projections were found for this scenario.'];
    const runId = crypto.randomUUID();

    await client.query('BEGIN');
    started = true;

    const run = await client.query(
      `INSERT INTO compute_runs
         (id, company_id, scenario_id, version_id, trigger_type, status, started_at, completed_at, run_config, metadata)
       VALUES ($1, $2, $3, $4, $5, 'completed', NOW(), NOW(), $6::jsonb, $7::jsonb)
       RETURNING id, trigger_type, status, created_at, completed_at`,
      [
        runId,
        companyId,
        scenarioId,
        versionId,
        triggerType || 'manual',
        JSON.stringify({ assumptionSetId: version.assumption_set_id }),
        JSON.stringify({ warnings, outputCounts: counts }),
      ],
    );

    await insertStep(client, runId, 1, 'planning_spine', 'Resolve planning context', {
      companyId,
      scenarioId,
      versionId,
    });
    await insertStep(client, runId, 2, 'aggregate_financials', 'Aggregate seeded projections', counts);
    await insertStep(client, runId, 3, 'finalize', 'Finalize compute run', { warningCount: warnings.length });

    const artifactRows = [
      ['pnl_projections', counts.pnl],
      ['cashflow_projections', counts.cashflow],
      ['balance_sheet_projections', counts.balanceSheet],
      ['unit_economics_projections', counts.unitEconomics],
      ['kpi_projections', counts.kpis],
      ['driver_explainability', counts.explainability],
    ];

    for (const [artifactType, rowCount] of artifactRows) {
      await client.query(
        `INSERT INTO compute_run_artifacts (compute_run_id, artifact_type, row_count, metadata)
         VALUES ($1, $2, $3, '{}'::jsonb)`,
        [runId, artifactType, rowCount],
      );
    }

    await client.query(
      `INSERT INTO compute_dependency_snapshots
         (compute_run_id, snapshot_hash, dependency_manifest, assumption_set_ids, scope_bundle_state, metadata)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, '{}'::jsonb)`,
      [
        runId,
        crypto.createHash('sha1').update(`${companyId}:${scenarioId}:${versionId}`).digest('hex'),
        JSON.stringify(dependencyGraph),
        JSON.stringify([version.assumption_set_id]),
        JSON.stringify({ scopeBundleId: null }),
      ],
    );

    await client.query('COMMIT');

    res.status(201).json({
      data: {
        computeRunId: runId,
        status: run.rows[0].status,
        createdAt: run.rows[0].created_at,
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

router.get('/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string | undefined;
    const scenarioId = req.query.scenarioId as string | undefined;

    if (!companyId || !scenarioId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId and scenarioId query parameters are required', trace_id: traceId(req) },
      });
    }

    const versionId = req.query.versionId as string | undefined;
    const status = req.query.status as string | undefined;
    const { limit, offset } = paginate(req.query);
    const params: any[] = [companyId, scenarioId];
    let idx = 3;
    let clauses = '';

    if (versionId) {
      clauses += ` AND version_id::text = $${idx++}`;
      params.push(versionId);
    }
    if (status) {
      clauses += ` AND status = $${idx++}`;
      params.push(status);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT id, status, trigger_type, created_at, completed_at
         FROM compute_runs
        WHERE company_id::text = $1
          AND scenario_id::text = $2
          ${clauses}
        ORDER BY created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({
      data: rows.map((row: any) => ({
        computeRunId: row.id,
        status: row.status,
        triggerType: row.trigger_type,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      })),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/runs/:runId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;
    const run = await db.query(
      `SELECT id, status, trigger_type, created_at, completed_at
         FROM compute_runs
        WHERE id::text = $1`,
      [runId],
    );

    if (run.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPUTE_RUN_NOT_FOUND', message: `Compute run ${runId} not found`, trace_id: traceId(req) },
      });
    }

    const steps = await db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
         FROM compute_run_steps
        WHERE compute_run_id::text = $1`,
      [runId],
    );

    res.json({
      data: {
        computeRunId: run.rows[0].id,
        status: run.rows[0].status,
        triggerType: run.rows[0].trigger_type,
        stepsTotal: Number(steps.rows[0]?.total || 0),
        stepsCompleted: Number(steps.rows[0]?.completed || 0),
        createdAt: run.rows[0].created_at,
        completedAt: run.rows[0].completed_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/runs/:runId/cancel', validate(CancelRunBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;
    const current = await db.query('SELECT id, status, metadata FROM compute_runs WHERE id::text = $1', [runId]);

    if (current.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPUTE_RUN_NOT_FOUND', message: `Compute run ${runId} not found`, trace_id: traceId(req) },
      });
    }

    if (!['queued', 'running'].includes(current.rows[0].status)) {
      return res.status(409).json({
        error: { code: 'COMPUTE_RUN_NOT_CANCELLABLE', message: `Run in status "${current.rows[0].status}" cannot be cancelled`, trace_id: traceId(req) },
      });
    }

    const updated = await db.query(
      `UPDATE compute_runs
          SET status = 'cancelled',
              completed_at = NOW(),
              metadata = $2::jsonb,
              updated_at = NOW()
        WHERE id::text = $1
        RETURNING id, status, trigger_type, created_at, completed_at`,
      [runId, JSON.stringify({ ...(current.rows[0].metadata || {}), cancelReason: req.body.reason })],
    );

    res.json({
      data: {
        computeRunId: updated.rows[0].id,
        status: updated.rows[0].status,
        triggerType: updated.rows[0].trigger_type,
        createdAt: updated.rows[0].created_at,
        completedAt: updated.rows[0].completed_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/runs/:runId/steps', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;
    const { limit, offset } = paginate(req.query);

    const { rows } = await db.query(
      `SELECT id, step_label, status, started_at, completed_at,
              COALESCE(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000, 0) AS duration_ms
         FROM compute_run_steps
        WHERE compute_run_id::text = $1
        ORDER BY step_order ASC
        LIMIT $2 OFFSET $3`,
      [runId, limit, offset],
    );

    res.json({
      data: rows.map((row: any) => ({
        stepId: row.id,
        name: row.step_label,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        durationMs: Math.round(Number(row.duration_ms || 0)),
      })),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/runs/:runId/results', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;
    const run = await db.query(
      `SELECT id, status, metadata
         FROM compute_runs
        WHERE id::text = $1`,
      [runId],
    );

    if (run.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPUTE_RUN_NOT_FOUND', message: `Compute run ${runId} not found`, trace_id: traceId(req) },
      });
    }

    res.json({
      data: {
        computeRunId: run.rows[0].id,
        status: run.rows[0].status,
        outputSummary: run.rows[0].metadata?.outputCounts || {},
        warnings: run.rows[0].metadata?.warnings || [],
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/dependencies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string | undefined;
    if (!companyId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId query parameter is required', trace_id: traceId(req) },
      });
    }

    res.json({ data: dependencyGraph, meta: meta() });
  } catch (error) {
    next(error);
  }
});

router.get('/freshness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string | undefined;
    const scenarioId = req.query.scenarioId as string | undefined;
    if (!companyId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId query parameter is required', trace_id: traceId(req) },
      });
    }

    const params: any[] = [companyId];
    let clause = '';
    if (scenarioId) {
      clause = ' AND scenario_id::text = $2';
      params.push(scenarioId);
    }

    const run = await db.query(
      `SELECT id, status, completed_at, metadata
         FROM compute_runs
        WHERE company_id::text = $1
          ${clause}
        ORDER BY completed_at DESC NULLS LAST, created_at DESC
        LIMIT 1`,
      params,
    );

    const row = run.rows[0];
    const outputCounts = row?.metadata?.outputCounts || {};
    const staleSurfaces = Object.entries(outputCounts)
      .filter(([, count]) => Number(count) === 0)
      .map(([name]) => name);

    res.json({
      data: {
        freshness: row?.status === 'completed' ? 'fresh' : 'stale',
        lastRunId: row?.id || null,
        lastRunAt: row?.completed_at || null,
        staleSurfaces,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
