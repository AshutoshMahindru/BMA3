/**
 * Compute routes — /api/v1/compute
 * Generated from specos/artifacts/api_contracts.json (api_compute_001 – api_compute_011)
 * Column names sourced from specos/artifacts/canonical_schema.json
 *
 * Tables:
 *   compute_validation_results — id, compute_run_id, validation_job_id, issue_code,
 *       severity, stage_family, surface_code, entity_type, entity_id, message,
 *       resolution_state, resolved_by, resolved_at, metadata, created_at, updated_at
 *   compute_runs — id, company_id, scenario_id, version_id, scope_bundle_id,
 *       trigger_type, status, started_at, completed_at, triggered_by,
 *       error_message, run_config, metadata, created_at, updated_at
 *   compute_run_steps — id, compute_run_id, step_code, step_label, step_order,
 *       status, started_at, completed_at, output_summary, error_message,
 *       metadata, created_at, updated_at
 *   compute_run_artifacts — id, compute_run_id, artifact_type, artifact_ref,
 *       row_count, checksum, metadata, created_at, updated_at
 *   compute_dependency_snapshots — id, compute_run_id, snapshot_hash,
 *       dependency_manifest, assumption_set_ids, scope_bundle_state,
 *       metadata, created_at, updated_at
 */
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import crypto from 'crypto';

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

// ─── Zod schemas for request bodies ──────────────────────────────────────────

const ValidationCreateBody = z.object({
  companyId: z.string().uuid(),
  scenarioId: z.string().uuid(),
  versionId: z.string().uuid(),
});

const ComputeRunCreateBody = z.object({
  companyId: z.string().uuid(),
  scenarioId: z.string().uuid(),
  versionId: z.string().uuid(),
  triggerType: z.enum(['manual', 'auto', 'publish_gate', 'compare_prep', 'scheduled']).optional(),
});

const CancelRunBody = z.object({
  reason: z.string().min(1),
});

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATIONS  (api_compute_001 – 003)
// ═══════════════════════════════════════════════════════════════════════════════

// api_compute_001: POST /validations
router.post('/validations', validate(ValidationCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId, versionId } = req.body;

    // Verify version exists
    const ver = await db.query('SELECT id FROM plan_versions WHERE id = $1', [versionId]);
    if (ver.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'VERSION_NOT_FOUND', message: `Version ${versionId} not found`, trace_id: traceId(req) },
      });
    }

    // Create a validation job ID (we store validation results with this job ID)
    const validationJobId = crypto.randomUUID();

    // In a full implementation, this would queue a validation job via BullMQ.
    // For now, create a placeholder record that the worker will populate.
    await db.query(
      `INSERT INTO compute_validation_results
         (validation_job_id, issue_code, severity, stage_family, message, resolution_state, metadata)
       VALUES ($1, 'VALIDATION_STARTED', 'info', 'compute', 'Validation job queued', 'open',
               $2)`,
      [validationJobId, JSON.stringify({ company_id: companyId, scenario_id: scenarioId, version_id: versionId })],
    );

    res.status(201).json({
      data: {
        validationId: validationJobId,
        status: 'QUEUED',
        companyId,
        scenarioId,
        versionId,
        createdAt: new Date().toISOString(),
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

// api_compute_002: GET /validations/:validationId
router.get('/validations/:validationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { validationId } = req.params;

    const { rows, rowCount } = await db.query(
      `SELECT validation_job_id, COUNT(*) AS issue_count,
              MIN(created_at) AS started_at, MAX(updated_at) AS last_updated,
              metadata
         FROM compute_validation_results
        WHERE validation_job_id = $1
        GROUP BY validation_job_id, metadata`,
      [validationId],
    );

    if (rowCount === 0) {
      return res.status(404).json({
        error: { code: 'VALIDATION_NOT_FOUND', message: `Validation ${validationId} not found`, trace_id: traceId(req) },
      });
    }

    const row = rows[0];
    const issueCountResult = await db.query(
      `SELECT severity, COUNT(*) AS cnt
         FROM compute_validation_results
        WHERE validation_job_id = $1 AND issue_code != 'VALIDATION_STARTED'
        GROUP BY severity`,
      [validationId],
    );

    res.json({
      data: {
        validationId,
        issueCount: parseInt(row.issue_count) - 1, // exclude the STARTED marker
        issueSummary: issueCountResult.rows.reduce((acc: any, r: any) => {
          acc[r.severity] = parseInt(r.cnt);
          return acc;
        }, {}),
        startedAt: row.started_at,
        lastUpdated: row.last_updated,
        metadata: row.metadata,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

// api_compute_003: GET /validations/:validationId/issues
router.get('/validations/:validationId/issues', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { validationId } = req.params;
    const severityFilter = req.query.severity as string | undefined;
    const { limit, offset } = paginate(req.query);

    // Check validation exists
    const check = await db.query(
      'SELECT 1 FROM compute_validation_results WHERE validation_job_id = $1 LIMIT 1',
      [validationId],
    );
    if (check.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'VALIDATION_NOT_FOUND', message: `Validation ${validationId} not found`, trace_id: traceId(req) },
      });
    }

    const params: any[] = [validationId];
    let idx = 2;
    let severityClause = '';

    if (severityFilter) {
      severityClause = ` AND severity = $${idx++}`;
      params.push(severityFilter);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT id, validation_job_id, issue_code, severity, stage_family,
              surface_code, entity_type, entity_id, message,
              resolution_state, resolved_by, resolved_at,
              metadata, created_at, updated_at
         FROM compute_validation_results
        WHERE validation_job_id = $1
          AND issue_code != 'VALIDATION_STARTED'
          ${severityClause}
        ORDER BY
          CASE severity WHEN 'critical' THEN 1 WHEN 'error' THEN 2 WHEN 'warning' THEN 3 ELSE 4 END,
          created_at ASC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({ data: rows, meta: meta() });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPUTE RUNS  (api_compute_004 – 009)
// ═══════════════════════════════════════════════════════════════════════════════

// api_compute_004: POST /runs — Queue a compute run via BullMQ
router.post('/runs', validate(ComputeRunCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId, versionId, triggerType } = req.body;

    // Check version isn't frozen (unless trigger is publish_gate)
    if (triggerType !== 'publish_gate') {
      const ver = await db.query('SELECT status FROM plan_versions WHERE id = $1', [versionId]);
      if (ver.rowCount && (ver.rows[0].status === 'frozen' || ver.rows[0].status === 'published')) {
        return res.status(409).json({
          error: { code: 'VERSION_FROZEN', message: 'Cannot run compute on a frozen/published version', trace_id: traceId(req) },
        });
      }
    }

    // Insert compute_run record with status 'queued'
    const { rows } = await db.query(
      `INSERT INTO compute_runs
         (company_id, scenario_id, version_id, trigger_type, status)
       VALUES ($1, $2, $3, $4, 'queued')
       RETURNING id, company_id, scenario_id, version_id, scope_bundle_id,
                 trigger_type, status, started_at, completed_at, triggered_by,
                 error_message, run_config, metadata, created_at, updated_at`,
      [companyId, scenarioId, versionId, triggerType || 'manual'],
    );

    const runId = rows[0].id;

    // Queue BullMQ job (import dynamically to avoid breaking if BullMQ not installed)
    try {
      const { Queue } = await import('bullmq');
      const computeQueue = new Queue('compute', {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      });
      await computeQueue.add('compute-run', {
        runId,
        companyId,
        scenarioId,
        versionId,
        triggerType: triggerType || 'manual',
      });
      await computeQueue.close();
    } catch {
      // BullMQ not available — log but don't fail the request
      console.warn(`[compute] BullMQ not available. Run ${runId} queued in DB only.`);
    }

    res.status(201).json({
      data: {
        status: 'QUEUED',
        run_id: runId,
        ...rows[0],
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

// api_compute_005: GET /runs
router.get('/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string;
    const scenarioId = req.query.scenarioId as string;

    if (!companyId || !scenarioId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId and scenarioId query parameters are required', trace_id: traceId(req) },
      });
    }

    const versionId = req.query.versionId as string | undefined;
    const statusFilter = req.query.status as string | undefined;
    const { limit, offset } = paginate(req.query);

    const params: any[] = [companyId, scenarioId];
    let idx = 3;
    let clauses = '';

    if (versionId) { clauses += ` AND version_id = $${idx++}`; params.push(versionId); }
    if (statusFilter) { clauses += ` AND status = $${idx++}`; params.push(statusFilter); }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT id, company_id, scenario_id, version_id, scope_bundle_id,
              trigger_type, status, started_at, completed_at, triggered_by,
              error_message, run_config, metadata, created_at, updated_at
         FROM compute_runs
        WHERE company_id = $1 AND scenario_id = $2 ${clauses}
        ORDER BY created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({ data: rows, meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_compute_006: GET /runs/:runId
router.get('/runs/:runId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;
    const { rows, rowCount } = await db.query(
      `SELECT id, company_id, scenario_id, version_id, scope_bundle_id,
              trigger_type, status, started_at, completed_at, triggered_by,
              error_message, run_config, metadata, created_at, updated_at
         FROM compute_runs WHERE id = $1`,
      [runId],
    );

    if (rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPUTE_RUN_NOT_FOUND', message: `Compute run ${runId} not found`, trace_id: traceId(req) },
      });
    }
    res.json({ data: rows[0], meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_compute_007: POST /runs/:runId/cancel
router.post('/runs/:runId/cancel', validate(CancelRunBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;
    const { reason } = req.body;

    const current = await db.query('SELECT id, status FROM compute_runs WHERE id = $1', [runId]);
    if (current.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPUTE_RUN_NOT_FOUND', message: `Compute run ${runId} not found`, trace_id: traceId(req) },
      });
    }

    const st = current.rows[0].status;
    if (st !== 'queued' && st !== 'running') {
      return res.status(409).json({
        error: { code: 'COMPUTE_RUN_NOT_CANCELLABLE', message: `Run in status "${st}" cannot be cancelled`, trace_id: traceId(req) },
      });
    }

    const { rows } = await db.query(
      `UPDATE compute_runs
          SET status = 'cancelled', completed_at = now(), updated_at = now(),
              metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{cancel_reason}', $2::jsonb)
        WHERE id = $1
       RETURNING id, company_id, scenario_id, version_id, scope_bundle_id,
                 trigger_type, status, started_at, completed_at, triggered_by,
                 error_message, run_config, metadata, created_at, updated_at`,
      [runId, JSON.stringify(reason)],
    );

    res.json({ data: rows[0], meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_compute_008: GET /runs/:runId/steps
router.get('/runs/:runId/steps', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;
    const { limit, offset } = paginate(req.query);

    // Verify run exists
    const check = await db.query('SELECT id FROM compute_runs WHERE id = $1', [runId]);
    if (check.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPUTE_RUN_NOT_FOUND', message: `Compute run ${runId} not found`, trace_id: traceId(req) },
      });
    }

    const { rows } = await db.query(
      `SELECT id, compute_run_id, step_code, step_label, step_order,
              status, started_at, completed_at, output_summary,
              error_message, metadata, created_at, updated_at
         FROM compute_run_steps
        WHERE compute_run_id = $1
        ORDER BY step_order ASC
        LIMIT $2 OFFSET $3`,
      [runId, limit, offset],
    );

    res.json({ data: rows, meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_compute_009: GET /runs/:runId/results
router.get('/runs/:runId/results', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params;

    // Verify run exists
    const run = await db.query(
      `SELECT id, status, company_id, scenario_id, version_id, completed_at
         FROM compute_runs WHERE id = $1`,
      [runId],
    );
    if (run.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPUTE_RUN_NOT_FOUND', message: `Compute run ${runId} not found`, trace_id: traceId(req) },
      });
    }

    // Warn if results might be stale
    const runRow = run.rows[0];
    if (runRow.status !== 'completed') {
      return res.status(409).json({
        error: { code: 'STALE_COMPUTE_RESULT', message: `Run ${runId} status is "${runRow.status}", results may be incomplete`, trace_id: traceId(req) },
      });
    }

    // Fetch artifacts
    const artifacts = await db.query(
      `SELECT id, artifact_type, artifact_ref, row_count, checksum,
              metadata, created_at
         FROM compute_run_artifacts
        WHERE compute_run_id = $1
        ORDER BY artifact_type`,
      [runId],
    );

    // Fetch step summary
    const steps = await db.query(
      `SELECT step_code, step_label, status, output_summary
         FROM compute_run_steps
        WHERE compute_run_id = $1
        ORDER BY step_order`,
      [runId],
    );

    // Fetch dependency snapshot
    const deps = await db.query(
      `SELECT snapshot_hash, dependency_manifest, assumption_set_ids, scope_bundle_state
         FROM compute_dependency_snapshots
        WHERE compute_run_id = $1`,
      [runId],
    );

    res.json({
      data: {
        runId,
        status: runRow.status,
        completedAt: runRow.completed_at,
        artifacts: artifacts.rows,
        steps: steps.rows,
        dependencySnapshot: deps.rows[0] || null,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DEPENDENCIES & FRESHNESS  (api_compute_010 – 011)
// ═══════════════════════════════════════════════════════════════════════════════

// api_compute_010: GET /dependencies
router.get('/dependencies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId query parameter is required', trace_id: traceId(req) },
      });
    }

    const scenarioId = req.query.scenarioId as string | undefined;
    const versionId = req.query.versionId as string | undefined;

    // Get latest dependency snapshot from the most recent completed run
    const params: any[] = [companyId];
    let idx = 2;
    let clauses = '';

    if (scenarioId) { clauses += ` AND cr.scenario_id = $${idx++}`; params.push(scenarioId); }
    if (versionId) { clauses += ` AND cr.version_id = $${idx++}`; params.push(versionId); }

    const { rows } = await db.query(
      `SELECT cds.id, cds.compute_run_id, cds.snapshot_hash,
              cds.dependency_manifest, cds.assumption_set_ids,
              cds.scope_bundle_state, cds.metadata, cds.created_at
         FROM compute_dependency_snapshots cds
         JOIN compute_runs cr ON cr.id = cds.compute_run_id
        WHERE cr.company_id = $1 AND cr.status = 'completed' ${clauses}
        ORDER BY cr.completed_at DESC NULLS LAST
        LIMIT 1`,
      params,
    );

    res.json({
      data: rows[0] || null,
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

// api_compute_011: GET /freshness
router.get('/freshness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId query parameter is required', trace_id: traceId(req) },
      });
    }

    const scenarioId = req.query.scenarioId as string | undefined;
    const versionId = req.query.versionId as string | undefined;

    const params: any[] = [companyId];
    let idx = 2;
    let clauses = '';

    if (scenarioId) { clauses += ` AND cr.scenario_id = $${idx++}`; params.push(scenarioId); }
    if (versionId) { clauses += ` AND cr.version_id = $${idx++}`; params.push(versionId); }

    // Get latest completed compute run
    const latestRun = await db.query(
      `SELECT cr.id, cr.status, cr.completed_at, cr.created_at
         FROM compute_runs cr
        WHERE cr.company_id = $1 ${clauses}
        ORDER BY cr.completed_at DESC NULLS LAST
        LIMIT 1`,
      params,
    );

    // Check for any assumption/decision changes since the last completed run
    let assumptionsModifiedAfter: string | null = null;
    if (latestRun.rows[0]?.completed_at) {
      const afterParams: any[] = [companyId, latestRun.rows[0].completed_at];
      let afterIdx = 3;
      let afterClauses = '';
      if (scenarioId) { afterClauses += ` AND aset.scenario_id = $${afterIdx++}`; afterParams.push(scenarioId); }

      const modCheck = await db.query(
        `SELECT MAX(afb.updated_at) AS latest_update
           FROM assumption_field_bindings afb
           JOIN assumption_packs ap ON ap.id = afb.pack_id
           LEFT JOIN assumption_sets aset ON aset.id = ap.assumption_set_id
          WHERE ap.company_id = $1
            AND afb.updated_at > $2
            ${afterClauses}`,
        afterParams,
      );
      assumptionsModifiedAfter = modCheck.rows[0]?.latest_update || null;
    }

    const run = latestRun.rows[0];
    const isStale = !!assumptionsModifiedAfter;

    res.json({
      data: {
        latestRun: run ? {
          runId: run.id,
          status: run.status,
          completedAt: run.completed_at,
          createdAt: run.created_at,
        } : null,
        isFresh: !isStale,
        isStale,
        staleReason: isStale ? 'Assumptions modified after last compute run' : null,
        assumptionsModifiedAt: assumptionsModifiedAfter,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
