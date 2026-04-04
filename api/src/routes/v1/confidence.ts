import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { validate, validateParams, validateQuery } from '../../middleware/validate';
import {
  asRecord,
  confidenceStateFromLevel,
  confidenceStateFromNumeric,
  idSchema,
  meta,
  paginate,
  safeNumber,
  traceId,
} from './_shared';

const router = Router();

const PlanningQuery = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  periodId: idSchema.optional(),
  scopeRef: idSchema.optional(),
});

const EvidenceListQuery = PlanningQuery.extend({
  entityType: z.string().optional(),
  entityId: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const EvidenceCreateBody = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional(),
  entityType: z.string().trim().min(1),
  entityId: idSchema,
  sourceUrl: z.string().optional(),
  quality: z.string().optional(),
});

const AssessmentListQuery = PlanningQuery.extend({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const AssessmentCreateBody = z.object({
  entityType: z.string().trim().min(1),
  entityId: idSchema,
  confidenceLevel: z.string().trim().min(1),
  rationale: z.string().optional(),
  evidenceRefs: z.array(idSchema).optional(),
});

const AssessmentPatchBody = z.object({
  confidenceLevel: z.string().trim().min(1).optional(),
  rationale: z.string().optional(),
  evidenceRefs: z.array(idSchema).optional(),
});

const DqiCreateBody = z.object({
  companyId: idSchema.optional(),
  scenarioId: idSchema.optional(),
  factors: z.array(z.object({
    name: z.string().trim().min(1),
    score: z.coerce.number(),
    notes: z.string().optional(),
  })).min(1),
});

const ResearchTasksQuery = PlanningQuery.extend({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const ResearchTaskCreateBody = z.object({
  title: z.string().trim().min(1),
  description: z.string().optional(),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
  linkedEntityType: z.string().optional(),
  linkedEntityId: idSchema.optional(),
  companyId: idSchema.optional(),
});

const ResearchTaskPatchBody = z.object({
  title: z.string().optional(),
  status: z.string().optional(),
  assignee: z.string().optional(),
  notes: z.string().optional(),
});

const EvidenceParams = z.object({ evidenceId: idSchema });
const AssessmentParams = z.object({ assessmentId: idSchema });
const TaskParams = z.object({ taskId: idSchema });

async function resolveEntityScope(entityType: string, entityId: string): Promise<{ companyId: string; scenarioId?: string | null; versionId?: string | null } | null> {
  const normalized = entityType.trim().toLowerCase();

  if (normalized === 'company') {
    const company = await db.query(
      `SELECT id
         FROM companies
        WHERE id::text = $1
          AND is_deleted = FALSE`,
      [entityId],
    );
    return company.rowCount ? { companyId: company.rows[0].id } : null;
  }

  if (normalized === 'scenario') {
    const scenario = await db.query(
      `SELECT company_id, id AS scenario_id
         FROM scenarios
        WHERE id::text = $1
          AND is_deleted = FALSE`,
      [entityId],
    );
    return scenario.rowCount ? { companyId: scenario.rows[0].company_id, scenarioId: scenario.rows[0].scenario_id } : null;
  }

  if (normalized === 'version') {
    const version = await db.query(
      `SELECT company_id, scenario_id, id AS version_id
         FROM plan_versions
        WHERE id::text = $1
          AND is_deleted = FALSE`,
      [entityId],
    );
    return version.rowCount
      ? { companyId: version.rows[0].company_id, scenarioId: version.rows[0].scenario_id, versionId: version.rows[0].version_id }
      : null;
  }

  if (normalized === 'assumption' || normalized === 'assumption_set') {
    const assumption = await db.query(
      `SELECT COALESCE(aset.company_id, s.company_id) AS company_id,
              aset.scenario_id,
              aset.version_id
         FROM assumption_sets aset
         JOIN scenarios s
           ON s.id = aset.scenario_id
        WHERE aset.id::text = $1
          AND aset.is_deleted = FALSE
          AND s.is_deleted = FALSE`,
      [entityId],
    );
    return assumption.rowCount
      ? { companyId: assumption.rows[0].company_id, scenarioId: assumption.rows[0].scenario_id, versionId: assumption.rows[0].version_id }
      : null;
  }

  if (normalized === 'decision' || normalized === 'decision_record') {
    const decision = await db.query(
      `SELECT COALESCE(dr.company_id, pv.company_id) AS company_id,
              COALESCE(dr.scenario_id, pv.scenario_id) AS scenario_id,
              COALESCE(dr.version_id, dr.plan_version_id) AS version_id
         FROM decision_records dr
         LEFT JOIN plan_versions pv
           ON pv.id = COALESCE(dr.version_id, dr.plan_version_id)
        WHERE dr.id::text = $1
          AND COALESCE(dr.is_deleted, FALSE) = FALSE`,
      [entityId],
    );
    return decision.rowCount
      ? { companyId: decision.rows[0].company_id, scenarioId: decision.rows[0].scenario_id, versionId: decision.rows[0].version_id }
      : null;
  }

  if (normalized === 'compute' || normalized === 'compute_run') {
    const computeRun = await db.query(
      `SELECT company_id, scenario_id, version_id
         FROM compute_runs
        WHERE id::text = $1`,
      [entityId],
    );
    return computeRun.rowCount
      ? { companyId: computeRun.rows[0].company_id, scenarioId: computeRun.rows[0].scenario_id, versionId: computeRun.rows[0].version_id }
      : null;
  }

  return null;
}

async function resolveCompanyTenant(companyId: string): Promise<string | null> {
  const company = await db.query(
    `SELECT tenant_id
       FROM companies
      WHERE id::text = $1
        AND is_deleted = FALSE`,
    [companyId],
  );
  return company.rowCount ? String(company.rows[0].tenant_id) : null;
}

router.get('/summary', validateQuery(PlanningQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.query as unknown as z.infer<typeof PlanningQuery>;

    const [assessments, evidenceCount] = await Promise.all([
      db.query(
        `SELECT assessment_id, entity_type, entity_id, state::text AS state,
                COALESCE(numeric_score, 0)::float8 AS numeric_score,
                COALESCE(evidence_count, 0)::int AS evidence_count,
                updated_at
           FROM confidence_assessments
          WHERE company_id::text = $1
          ORDER BY COALESCE(numeric_score, 0) ASC, updated_at DESC`,
        [companyId],
      ),
      db.query(
        `SELECT COUNT(*)::int AS count
           FROM evidence_items
          WHERE company_id::text = $1`,
        [companyId],
      ),
    ]);

    const rows = assessments.rows as Array<any>;
    const overallScore = rows.length
      ? rows.reduce((sum, row) => sum + safeNumber(row.numeric_score), 0) / rows.length
      : 0;

    const byStage = rows.reduce((acc: Record<string, { score: number; count: number }>, row) => {
      const key = String(row.entity_type || 'unknown');
      const current = acc[key] || { score: 0, count: 0 };
      current.score += safeNumber(row.numeric_score);
      current.count += 1;
      acc[key] = current;
      return acc;
    }, {});

    const normalizedByStage = Object.entries(byStage).reduce((acc: Record<string, unknown>, [key, value]) => {
      acc[key] = {
        confidenceLevel: confidenceStateFromNumeric(value.score / Math.max(value.count, 1)),
        averageScore: Math.round(value.score / Math.max(value.count, 1)),
        count: value.count,
      };
      return acc;
    }, {});

    res.json({
      data: {
        overallConfidence: confidenceStateFromNumeric(overallScore),
        byStage: normalizedByStage,
        lowConfidenceItems: rows
          .filter((row) => ['low', 'estimated', 'unknown'].includes(String(row.state || '').toLowerCase()))
          .slice(0, 8)
          .map((row) => ({
            assessmentId: row.assessment_id,
            entityType: row.entity_type,
            entityId: row.entity_id,
            confidenceLevel: row.state,
            evidenceCount: row.evidence_count,
            updatedAt: row.updated_at,
          })),
        evidenceCount: safeNumber(evidenceCount.rows[0]?.count),
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/evidence', validateQuery(EvidenceListQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, entityType, entityId } = req.query as unknown as z.infer<typeof EvidenceListQuery>;
    const { limit, offset } = paginate(req.query);
    const params: any[] = [companyId];
    let idx = 2;
    let clauses = '';

    if (entityType) {
      clauses += ` AND el.entity_type = $${idx++}`;
      params.push(entityType);
    }
    if (entityId) {
      clauses += ` AND el.entity_id::text = $${idx++}`;
      params.push(entityId);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT ei.evidence_id,
              ei.title,
              ei.source_type,
              ei.source_url,
              ei.created_at,
              ei.metadata,
              el.entity_type,
              el.entity_id
         FROM evidence_items ei
         LEFT JOIN evidence_links el
           ON el.evidence_id = ei.evidence_id
        WHERE ei.company_id::text = $1
          ${clauses}
        ORDER BY ei.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({
      data: rows.map((row: any) => {
        const metadata = asRecord(row.metadata);
        return {
          evidenceId: row.evidence_id,
          title: row.title,
          type: row.source_type,
          attachedTo: {
            entityType: row.entity_type,
            entityId: row.entity_id,
          },
          createdAt: row.created_at,
          quality: String(metadata.quality || 'unknown'),
        };
      }),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/evidence', validate(EvidenceCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  const client = await db.connect();
  let started = false;
  try {
    const { title, description, entityType, entityId, sourceUrl, quality } = req.body as z.infer<typeof EvidenceCreateBody>;
    const scope = await resolveEntityScope(entityType, entityId);

    if (!scope) {
      return res.status(404).json({
        error: { code: 'ENTITY_NOT_FOUND', message: `Entity ${entityId} could not be resolved`, trace_id: traceId(req) },
      });
    }

    const tenantId = await resolveCompanyTenant(scope.companyId);
    if (!tenantId) {
      return res.status(404).json({
        error: { code: 'COMPANY_NOT_FOUND', message: `Company ${scope.companyId} not found`, trace_id: traceId(req) },
      });
    }

    await client.query('BEGIN');
    started = true;

    const created = await client.query(
      `INSERT INTO evidence_items
         (company_id, source_type, source_name, source_url, title, metadata)
       VALUES ($1, 'manual', 'BMA3', $2, $3, $4::jsonb)
       RETURNING evidence_id, title, created_at`,
      [
        scope.companyId,
        sourceUrl || null,
        title,
        JSON.stringify({
          description: description || null,
          quality: quality || 'medium',
          tenantId,
        }),
      ],
    );

    await client.query(
      `INSERT INTO evidence_links (evidence_id, entity_type, entity_id)
       VALUES ($1, $2, $3)`,
      [created.rows[0].evidence_id, entityType, entityId],
    );

    await client.query('COMMIT');

    res.status(201).json({
      data: {
        evidenceId: created.rows[0].evidence_id,
        title: created.rows[0].title,
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

router.get('/evidence/:evidenceId', validateParams(EvidenceParams), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { evidenceId } = req.params as z.infer<typeof EvidenceParams>;
    const result = await db.query(
      `SELECT ei.evidence_id,
              ei.title,
              ei.source_url,
              ei.created_at,
              ei.metadata,
              el.entity_type,
              el.entity_id
         FROM evidence_items ei
         LEFT JOIN evidence_links el
           ON el.evidence_id = ei.evidence_id
        WHERE ei.evidence_id::text = $1`,
      [evidenceId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'EVIDENCE_NOT_FOUND', message: `Evidence ${evidenceId} not found`, trace_id: traceId(req) },
      });
    }

    const row = result.rows[0] as any;
    const metadata = asRecord(row.metadata);

    res.json({
      data: {
        evidenceId: row.evidence_id,
        title: row.title,
        description: String(metadata.description || ''),
        entityType: row.entity_type,
        entityId: row.entity_id,
        sourceUrl: row.source_url || '',
        quality: String(metadata.quality || 'unknown'),
        createdAt: row.created_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/assessments', validateQuery(AssessmentListQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.query as unknown as z.infer<typeof AssessmentListQuery>;
    const { limit, offset } = paginate(req.query);
    const { rows } = await db.query(
      `SELECT assessment_id, entity_type, entity_id, state::text AS state,
              COALESCE(evidence_count, 0)::int AS evidence_count, updated_at
         FROM confidence_assessments
        WHERE company_id::text = $1
        ORDER BY updated_at DESC
        LIMIT $2 OFFSET $3`,
      [companyId, limit, offset],
    );

    res.json({
      data: rows.map((row: any) => ({
        assessmentId: row.assessment_id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        confidenceLevel: row.state,
        evidenceCount: row.evidence_count,
        updatedAt: row.updated_at,
      })),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/assessments', validate(AssessmentCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId, confidenceLevel, rationale, evidenceRefs } = req.body as z.infer<typeof AssessmentCreateBody>;
    const scope = await resolveEntityScope(entityType, entityId);

    if (!scope) {
      return res.status(404).json({
        error: { code: 'ENTITY_NOT_FOUND', message: `Entity ${entityId} could not be resolved`, trace_id: traceId(req) },
      });
    }

    const { state, numericScore } = confidenceStateFromLevel(confidenceLevel);
    const created = await db.query(
      `INSERT INTO confidence_assessments
         (company_id, entity_type, entity_id, state, numeric_score, status, rationale, evidence_count)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7)
       RETURNING assessment_id, state::text AS state, created_at`,
      [scope.companyId, entityType, entityId, state, numericScore, rationale || null, (evidenceRefs || []).length],
    );

    res.status(201).json({
      data: {
        assessmentId: created.rows[0].assessment_id,
        confidenceLevel: created.rows[0].state,
        createdAt: created.rows[0].created_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/assessments/:assessmentId', validateParams(AssessmentParams), validate(AssessmentPatchBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assessmentId } = req.params as z.infer<typeof AssessmentParams>;
    const existing = await db.query(
      `SELECT assessment_id, state::text AS state, rationale, evidence_count
         FROM confidence_assessments
        WHERE assessment_id::text = $1`,
      [assessmentId],
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'ASSESSMENT_NOT_FOUND', message: `Assessment ${assessmentId} not found`, trace_id: traceId(req) },
      });
    }

    const body = req.body as z.infer<typeof AssessmentPatchBody>;
    const level = body.confidenceLevel
      ? confidenceStateFromLevel(body.confidenceLevel)
      : { state: existing.rows[0].state, numericScore: null as number | null };

    const updated = await db.query(
      `UPDATE confidence_assessments
          SET state = $2,
              numeric_score = COALESCE($3, numeric_score),
              rationale = $4,
              evidence_count = $5,
              updated_at = NOW()
        WHERE assessment_id::text = $1
        RETURNING assessment_id, state::text AS state, updated_at`,
      [
        assessmentId,
        level.state,
        level.numericScore,
        body.rationale ?? existing.rows[0].rationale,
        body.evidenceRefs ? body.evidenceRefs.length : existing.rows[0].evidence_count,
      ],
    );

    res.json({
      data: {
        assessmentId: updated.rows[0].assessment_id,
        confidenceLevel: updated.rows[0].state,
        updatedAt: updated.rows[0].updated_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/dqi', validateQuery(PlanningQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId } = req.query as unknown as z.infer<typeof PlanningQuery>;
    const entityType = scenarioId ? 'scenario' : 'company';
    const entityId = scenarioId || companyId;

    const result = await db.query(
      `SELECT source_quality_score, freshness_score, completeness_score, relevance_score,
              granularity_score, consistency_score, traceability_score, overall_score
         FROM dqi_scores
        WHERE entity_type = $1
          AND entity_id::text = $2
        ORDER BY computed_at DESC, created_at DESC
        LIMIT 1`,
      [entityType, entityId],
    );

    const row = result.rows[0] || {};
    const factors = [
      { name: 'source_quality', score: safeNumber(row.source_quality_score), weight: 1 },
      { name: 'freshness', score: safeNumber(row.freshness_score), weight: 1 },
      { name: 'completeness', score: safeNumber(row.completeness_score), weight: 1 },
      { name: 'relevance', score: safeNumber(row.relevance_score), weight: 1 },
      { name: 'granularity', score: safeNumber(row.granularity_score), weight: 1 },
      { name: 'consistency', score: safeNumber(row.consistency_score), weight: 1 },
      { name: 'traceability', score: safeNumber(row.traceability_score), weight: 1 },
    ];

    const overallDqi = safeNumber(row.overall_score) || (
      factors.reduce((sum, factor) => sum + factor.score, 0) / Math.max(factors.length, 1)
    );

    res.json({
      data: { overallDqi, factors },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/dqi', validate(DqiCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId, factors } = req.body as z.infer<typeof DqiCreateBody>;
    const entityType = scenarioId ? 'scenario' : 'company';
    const entityId = scenarioId || companyId;

    if (!entityId) {
      return res.status(400).json({
        error: { code: 'MISSING_COMPANY_CONTEXT', message: 'companyId or scenarioId is required', trace_id: traceId(req) },
      });
    }

    const factorMap = factors.reduce((acc: Record<string, number>, factor) => {
      acc[factor.name.toLowerCase()] = safeNumber(factor.score);
      return acc;
    }, {});
    const scores = [
      factorMap.source_quality,
      factorMap.freshness,
      factorMap.completeness,
      factorMap.relevance,
      factorMap.granularity,
      factorMap.consistency,
      factorMap.traceability,
    ].map(safeNumber);
    const overallDqi = scores.reduce((sum, score) => sum + score, 0) / Math.max(scores.length, 1);

    const updated = await db.query(
      `INSERT INTO dqi_scores
         (entity_type, entity_id, source_quality_score, freshness_score, completeness_score, relevance_score, granularity_score, consistency_score, traceability_score, overall_score, computed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING created_at`,
      [
        entityType,
        entityId,
        scores[0],
        scores[1],
        scores[2],
        scores[3],
        scores[4],
        scores[5],
        scores[6],
        overallDqi,
      ],
    );

    res.status(201).json({
      data: {
        overallDqi,
        updatedAt: updated.rows[0].created_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/research-tasks', validateQuery(ResearchTasksQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, status } = req.query as unknown as z.infer<typeof ResearchTasksQuery>;
    const { limit, offset } = paginate(req.query);
    const params: any[] = [companyId];
    let idx = 2;
    let clauses = '';

    if (status) {
      clauses += ` AND status = $${idx++}`;
      params.push(status);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT id, title, assignee, due_date, status, entity_type, entity_id
         FROM research_tasks
        WHERE company_id::text = $1
          ${clauses}
        ORDER BY due_date ASC NULLS LAST, created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({
      data: rows.map((row: any) => ({
        taskId: row.id,
        title: row.title,
        assignee: row.assignee || '',
        dueDate: row.due_date,
        status: row.status,
        linkedEntity: {
          entityType: row.entity_type,
          entityId: row.entity_id,
        },
      })),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/research-tasks', validate(ResearchTaskCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof ResearchTaskCreateBody>;
    let resolvedCompanyId = body.companyId || null;
    let resolvedEntityType = body.linkedEntityType || 'company';
    let resolvedEntityId = body.linkedEntityId || body.companyId || null;

    if (body.linkedEntityType && body.linkedEntityId) {
      const scope = await resolveEntityScope(body.linkedEntityType, body.linkedEntityId);
      if (!scope) {
        return res.status(404).json({
          error: { code: 'ENTITY_NOT_FOUND', message: `Entity ${body.linkedEntityId} could not be resolved`, trace_id: traceId(req) },
        });
      }
      resolvedCompanyId = scope.companyId;
    }

    if (!resolvedCompanyId || !resolvedEntityId) {
      return res.status(400).json({
        error: { code: 'MISSING_COMPANY_CONTEXT', message: 'linkedEntityId or companyId is required', trace_id: traceId(req) },
      });
    }

    const created = await db.query(
      `INSERT INTO research_tasks
         (company_id, entity_type, entity_id, title, description, assignee, due_date, status, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', 'medium')
       RETURNING id, title, created_at`,
      [
        resolvedCompanyId,
        resolvedEntityType,
        resolvedEntityId,
        body.title,
        body.description || null,
        body.assignee || null,
        body.dueDate || null,
      ],
    );

    res.status(201).json({
      data: {
        taskId: created.rows[0].id,
        title: created.rows[0].title,
        createdAt: created.rows[0].created_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/research-tasks/:taskId', validateParams(TaskParams), validate(ResearchTaskPatchBody), async (req: Request, res: Response, next: NextFunction) => {
  const client = await db.connect();
  let started = false;
  try {
    const { taskId } = req.params as z.infer<typeof TaskParams>;
    const existing = await client.query(
      `SELECT id, title, status, assignee
         FROM research_tasks
        WHERE id::text = $1`,
      [taskId],
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'TASK_NOT_FOUND', message: `Research task ${taskId} not found`, trace_id: traceId(req) },
      });
    }

    const body = req.body as z.infer<typeof ResearchTaskPatchBody>;

    await client.query('BEGIN');
    started = true;

    const updated = await client.query(
      `UPDATE research_tasks
          SET title = $2,
              status = $3,
              assignee = $4,
              updated_at = NOW()
        WHERE id::text = $1
        RETURNING id, status, updated_at`,
      [
        taskId,
        body.title ?? existing.rows[0].title,
        body.status ?? existing.rows[0].status,
        body.assignee ?? existing.rows[0].assignee,
      ],
    );

    if (body.notes) {
      await client.query(
        `INSERT INTO research_notes (research_task_id, author, content)
         VALUES ($1, $2, $3)`,
        [taskId, body.assignee || 'system', body.notes],
      );
    }

    await client.query('COMMIT');

    res.json({
      data: {
        taskId: updated.rows[0].id,
        status: updated.rows[0].status,
        updatedAt: updated.rows[0].updated_at,
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

router.get('/rollups', validateQuery(PlanningQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.query as unknown as z.infer<typeof PlanningQuery>;
    const stored = await db.query(
      `SELECT id, rollup_scope, scope_id, weighted_score, lowest_critical_score, assessment_count
         FROM confidence_rollups
        WHERE company_id::text = $1
        ORDER BY computed_at DESC NULLS LAST, id DESC`,
      [companyId],
    );

    const rollups = Number(stored.rowCount || 0) > 0
      ? stored.rows.map((row: any) => ({
          entityType: row.rollup_scope,
          entityId: row.scope_id,
          aggregateConfidence: confidenceStateFromNumeric(row.weighted_score),
          weakestLink: {
            score: safeNumber(row.lowest_critical_score),
          },
          evidenceCount: safeNumber(row.assessment_count),
        }))
      : (await db.query(
          `SELECT entity_type, entity_id,
                  AVG(COALESCE(numeric_score, 0))::float8 AS avg_score,
                  MIN(COALESCE(numeric_score, 0))::float8 AS weakest_score,
                  SUM(COALESCE(evidence_count, 0))::int AS evidence_count
             FROM confidence_assessments
            WHERE company_id::text = $1
            GROUP BY entity_type, entity_id
            ORDER BY avg_score ASC`,
          [companyId],
        )).rows.map((row: any) => ({
          entityType: row.entity_type,
          entityId: row.entity_id,
          aggregateConfidence: confidenceStateFromNumeric(row.avg_score),
          weakestLink: {
            score: safeNumber(row.weakest_score),
          },
          evidenceCount: safeNumber(row.evidence_count),
        }));

    res.json({
      data: { rollups },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
