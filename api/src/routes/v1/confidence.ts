import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { validate, validateParams, validateQuery } from '../../middleware/validate';

const router = Router();

const ID_PATTERN = /^[0-9a-fA-F-]{36}$/;
const idSchema = z.string().regex(ID_PATTERN, 'Invalid identifier format');

const ConfidenceQuery = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  periodId: idSchema.optional(),
  scopeRef: z.string().optional(),
});

const ListQuery = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  periodId: idSchema.optional(),
  scopeRef: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const AssessmentCreateBody = z.object({
  companyId: idSchema,
  entityType: z.string().trim().min(1),
  entityId: idSchema,
  confidenceLevel: z.enum(['high', 'medium', 'low', 'unknown']).optional(),
  numericScore: z.number().min(0).max(100).optional(),
  rationale: z.string().optional(),
});

const AssessmentUpdateBody = z.object({
  confidenceLevel: z.enum(['high', 'medium', 'low', 'unknown']).optional(),
  numericScore: z.number().min(0).max(100).optional(),
  rationale: z.string().optional(),
});

const EvidenceCreateBody = z.object({
  companyId: idSchema,
  title: z.string().trim().min(1).max(300),
  sourceType: z.string().trim().min(1),
  sourceUrl: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

const DqiBody = z.object({
  companyId: idSchema,
  entityType: z.string().trim().min(1),
  entityId: idSchema,
  sourceQualityScore: z.number().min(0).max(100).optional(),
  freshnessScore: z.number().min(0).max(100).optional(),
  completenessScore: z.number().min(0).max(100).optional(),
  relevanceScore: z.number().min(0).max(100).optional(),
  granularityScore: z.number().min(0).max(100).optional(),
  consistencyScore: z.number().min(0).max(100).optional(),
  traceabilityScore: z.number().min(0).max(100).optional(),
});

const ResearchTaskCreateBody = z.object({
  companyId: idSchema,
  entityType: z.string().trim().min(1),
  entityId: idSchema,
  title: z.string().trim().min(1).max(300),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
});

const ResearchTaskUpdateBody = z.object({
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional(),
  assignee: z.string().optional(),
  title: z.string().trim().min(1).max(300).optional(),
});

const AssessmentIdParam = z.object({ assessmentId: idSchema });
const EvidenceIdParam = z.object({ evidenceId: idSchema });
const TaskIdParam = z.object({ taskId: idSchema });

function traceId(req: Request): string {
  return (req.headers['x-trace-id'] as string) || 'no-trace-id';
}

function meta(extra?: Record<string, unknown>) {
  return {
    freshness: { source: 'database', timestamp: new Date().toISOString() },
    ...(extra || {}),
  };
}

function mapConfidenceState(level: string): string {
  const mapping: Record<string, string> = { high: 'high', medium: 'medium', low: 'low', unknown: 'unknown' };
  return mapping[level] || 'unknown';
}

// ─── GET /summary ───
router.get('/summary', validateQuery(ConfidenceQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.query as unknown as z.infer<typeof ConfidenceQuery>;

    const assessments = await db.query(
      `SELECT state::text, COUNT(*)::int AS cnt, AVG(COALESCE(numeric_score, 0))::float8 AS avg_score
         FROM confidence_assessments
        WHERE company_id::text = $1
        GROUP BY state`,
      [companyId],
    );

    const byStage: Record<string, { count: number; avgScore: number }> = {};
    let totalCount = 0;
    let weightedSum = 0;
    for (const row of assessments.rows as Array<{ state: string; cnt: number; avg_score: number }>) {
      byStage[row.state] = { count: row.cnt, avgScore: Number(row.avg_score.toFixed(1)) };
      totalCount += row.cnt;
      weightedSum += row.avg_score * row.cnt;
    }

    const overallScore = totalCount > 0 ? weightedSum / totalCount : 0;
    const overallConfidence = overallScore >= 75 ? 'high' : overallScore >= 50 ? 'medium' : overallScore > 0 ? 'low' : 'unknown';

    const lowItems = await db.query(
      `SELECT assessment_id, entity_type, entity_id, numeric_score
         FROM confidence_assessments
        WHERE company_id::text = $1 AND (numeric_score IS NOT NULL AND numeric_score < 50)
        ORDER BY numeric_score ASC LIMIT 10`,
      [companyId],
    );

    const evidenceCount = await db.query(
      `SELECT COUNT(*)::int AS cnt FROM evidence_items WHERE company_id::text = $1`,
      [companyId],
    );

    res.json({
      data: {
        overallConfidence,
        byStage,
        lowConfidenceItems: lowItems.rows.map((r: any) => ({ assessmentId: r.assessment_id, entityType: r.entity_type, entityId: r.entity_id, score: Number(r.numeric_score) })),
        evidenceCount: evidenceCount.rows[0]?.cnt || 0,
      },
      meta: meta({ companyId }),
    });
  } catch (error) { next(error); }
});

// ─── GET /evidence ───
router.get('/evidence', validateQuery(ListQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, entityType, entityId, limit = 50, offset = 0 } = req.query as unknown as z.infer<typeof ListQuery>;
    const params: unknown[] = [companyId, limit, offset];
    let where = 'ei.company_id::text = $1';

    if (entityType && entityId) {
      where += ` AND EXISTS (
        SELECT 1 FROM evidence_links el
        WHERE el.evidence_id = ei.evidence_id
          AND el.entity_type = $${params.length + 1}
          AND el.entity_id::text = $${params.length + 2}
      )`;
      params.push(entityType, entityId);
    }

    const { rows } = await db.query(
      `SELECT ei.evidence_id, ei.title, ei.source_type, ei.created_at, ei.source_url
         FROM evidence_items ei
        WHERE ${where}
        ORDER BY ei.created_at DESC
        LIMIT $2 OFFSET $3`,
      params,
    );

    res.json({
      data: rows.map((r: any) => ({
        evidenceId: r.evidence_id,
        title: r.title,
        type: r.source_type,
        attachedTo: {},
        createdAt: r.created_at,
        quality: 'unscored',
      })),
      meta: meta({ companyId }),
    });
  } catch (error) { next(error); }
});

// ─── POST /evidence ───
router.post('/evidence', validate(EvidenceCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, title, sourceType, sourceUrl, entityType, entityId } = req.body as z.infer<typeof EvidenceCreateBody>;
    const id = crypto.randomUUID();

    await db.query(
      `INSERT INTO evidence_items (evidence_id, company_id, source_type, source_url, title)
       VALUES ($1, $2::uuid, $3, $4, $5)`,
      [id, companyId, sourceType, sourceUrl || null, title],
    );

    if (entityType && entityId) {
      await db.query(
        `INSERT INTO evidence_links (id, evidence_id, entity_type, entity_id)
         VALUES ($1, $2::uuid, $3, $4::uuid)`,
        [crypto.randomUUID(), id, entityType, entityId],
      );
    }

    res.status(201).json({ data: { evidenceId: id, title, createdAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── GET /evidence/:evidenceId ───
router.get('/evidence/:evidenceId', validateParams(EvidenceIdParam), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { evidenceId } = req.params as z.infer<typeof EvidenceIdParam>;
    const { rows } = await db.query(
      `SELECT ei.evidence_id, ei.title, ei.source_type, ei.source_url, ei.method_note, ei.created_at
         FROM evidence_items ei
        WHERE ei.evidence_id::text = $1`,
      [evidenceId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'EVIDENCE_NOT_FOUND', message: `Evidence ${evidenceId} not found`, trace_id: traceId(req) } });
    }
    const r = rows[0];
    res.json({
      data: {
        evidenceId: r.evidence_id,
        title: r.title,
        description: r.method_note || '',
        entityType: '',
        entityId: '',
        sourceUrl: r.source_url || '',
        quality: 'unscored',
        createdAt: r.created_at,
      },
      meta: meta(),
    });
  } catch (error) { next(error); }
});

// ─── GET /assessments ───
router.get('/assessments', validateQuery(ListQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, limit = 50, offset = 0 } = req.query as unknown as z.infer<typeof ListQuery>;
    const { rows } = await db.query(
      `SELECT assessment_id, entity_type, entity_id, state::text AS confidence_level, evidence_count, updated_at
         FROM confidence_assessments
        WHERE company_id::text = $1
        ORDER BY updated_at DESC
        LIMIT $2 OFFSET $3`,
      [companyId, limit, offset],
    );

    res.json({
      data: rows.map((r: any) => ({
        assessmentId: r.assessment_id,
        entityType: r.entity_type,
        entityId: r.entity_id,
        confidenceLevel: r.confidence_level,
        evidenceCount: r.evidence_count || 0,
        updatedAt: r.updated_at,
      })),
      meta: meta({ companyId }),
    });
  } catch (error) { next(error); }
});

// ─── POST /assessments ───
router.post('/assessments', validate(AssessmentCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, entityType, entityId, confidenceLevel, numericScore, rationale } = req.body as z.infer<typeof AssessmentCreateBody>;
    const id = crypto.randomUUID();
    const state = mapConfidenceState(confidenceLevel || 'unknown');

    await db.query(
      `INSERT INTO confidence_assessments (assessment_id, company_id, entity_type, entity_id, state, numeric_score, rationale)
       VALUES ($1, $2::uuid, $3, $4::uuid, $5::confidence_state, $6, $7)`,
      [id, companyId, entityType, entityId, state, numericScore ?? null, rationale || null],
    );

    res.status(201).json({ data: { assessmentId: id, confidenceLevel: state, createdAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── PATCH /assessments/:assessmentId ───
router.patch('/assessments/:assessmentId', validateParams(AssessmentIdParam), validate(AssessmentUpdateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { assessmentId } = req.params as z.infer<typeof AssessmentIdParam>;
    const { confidenceLevel, numericScore, rationale } = req.body as z.infer<typeof AssessmentUpdateBody>;
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    if (confidenceLevel !== undefined) { params.push(mapConfidenceState(confidenceLevel)); sets.push(`state = $${params.length}::confidence_state`); }
    if (numericScore !== undefined) { params.push(numericScore); sets.push(`numeric_score = $${params.length}`); }
    if (rationale !== undefined) { params.push(rationale); sets.push(`rationale = $${params.length}`); }
    params.push(assessmentId);

    const { rowCount } = await db.query(`UPDATE confidence_assessments SET ${sets.join(', ')} WHERE assessment_id::text = $${params.length}`, params);
    if (Number(rowCount || 0) === 0) {
      return res.status(404).json({ error: { code: 'ASSESSMENT_NOT_FOUND', message: `Assessment ${assessmentId} not found`, trace_id: traceId(req) } });
    }
    res.json({ data: { assessmentId, confidenceLevel: confidenceLevel || '', updatedAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── GET /dqi ───
router.get('/dqi', validateQuery(ConfidenceQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.query as unknown as z.infer<typeof ConfidenceQuery>;

    const { rows } = await db.query(
      `SELECT dqi_score_id, entity_type, entity_id, overall_score,
              source_quality_score, freshness_score, completeness_score,
              relevance_score, granularity_score, consistency_score, traceability_score
         FROM dqi_scores ds
         WHERE EXISTS (
           SELECT 1 FROM confidence_assessments ca
           WHERE ca.entity_type = ds.entity_type AND ca.entity_id = ds.entity_id AND ca.company_id::text = $1
         )
         ORDER BY ds.computed_at DESC`,
      [companyId],
    );

    const totalScore = rows.length > 0
      ? rows.reduce((sum: number, r: any) => sum + Number(r.overall_score || 0), 0) / rows.length
      : 0;

    res.json({
      data: {
        overallDqi: Number(totalScore.toFixed(1)),
        factors: rows.map((r: any) => ({
          dqiScoreId: r.dqi_score_id,
          entityType: r.entity_type,
          entityId: r.entity_id,
          overallScore: Number(r.overall_score || 0),
          sourceQuality: Number(r.source_quality_score || 0),
          freshness: Number(r.freshness_score || 0),
          completeness: Number(r.completeness_score || 0),
          relevance: Number(r.relevance_score || 0),
          granularity: Number(r.granularity_score || 0),
          consistency: Number(r.consistency_score || 0),
          traceability: Number(r.traceability_score || 0),
        })),
      },
      meta: meta({ companyId }),
    });
  } catch (error) { next(error); }
});

// ─── POST /dqi ───
router.post('/dqi', validate(DqiBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof DqiBody>;
    const scores = [
      body.sourceQualityScore ?? 0, body.freshnessScore ?? 0, body.completenessScore ?? 0,
      body.relevanceScore ?? 0, body.granularityScore ?? 0, body.consistencyScore ?? 0, body.traceabilityScore ?? 0,
    ];
    const overallScore = scores.reduce((s, v) => s + v, 0) / scores.length;

    await db.query(
      `INSERT INTO dqi_scores (dqi_score_id, entity_type, entity_id, source_quality_score, freshness_score, completeness_score, relevance_score, granularity_score, consistency_score, traceability_score, overall_score)
       VALUES ($1, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [crypto.randomUUID(), body.entityType, body.entityId, body.sourceQualityScore ?? null, body.freshnessScore ?? null, body.completenessScore ?? null, body.relevanceScore ?? null, body.granularityScore ?? null, body.consistencyScore ?? null, body.traceabilityScore ?? null, overallScore],
    );

    res.json({ data: { overallDqi: Number(overallScore.toFixed(1)), updatedAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── GET /research-tasks ───
router.get('/research-tasks', validateQuery(ListQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, status, limit = 50, offset = 0 } = req.query as unknown as z.infer<typeof ListQuery>;
    const params: unknown[] = [companyId, limit, offset];
    let where = 'rt.company_id::text = $1';
    if (status) { where += ` AND rt.status = $${params.length + 1}`; params.push(status); }

    const { rows } = await db.query(
      `SELECT rt.id, rt.title, rt.assignee, rt.due_date, rt.status, rt.entity_type, rt.entity_id
         FROM research_tasks rt
        WHERE ${where}
        ORDER BY rt.created_at DESC
        LIMIT $2 OFFSET $3`,
      params,
    );

    res.json({
      data: rows.map((r: any) => ({
        taskId: r.id,
        title: r.title,
        assignee: r.assignee || '',
        dueDate: r.due_date || '',
        status: r.status,
        linkedEntity: { entityType: r.entity_type, entityId: r.entity_id },
      })),
      meta: meta({ companyId }),
    });
  } catch (error) { next(error); }
});

// ─── POST /research-tasks ───
router.post('/research-tasks', validate(ResearchTaskCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, entityType, entityId, title, assignee, dueDate } = req.body as z.infer<typeof ResearchTaskCreateBody>;
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO research_tasks (id, company_id, entity_type, entity_id, title, assignee, due_date)
       VALUES ($1, $2::uuid, $3, $4::uuid, $5, $6, $7::date)`,
      [id, companyId, entityType, entityId, title, assignee || null, dueDate || null],
    );
    res.status(201).json({ data: { taskId: id, title, createdAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── PATCH /research-tasks/:taskId ───
router.patch('/research-tasks/:taskId', validateParams(TaskIdParam), validate(ResearchTaskUpdateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskId } = req.params as z.infer<typeof TaskIdParam>;
    const { status, assignee, title } = req.body as z.infer<typeof ResearchTaskUpdateBody>;
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    if (status !== undefined) { params.push(status); sets.push(`status = $${params.length}`); }
    if (assignee !== undefined) { params.push(assignee); sets.push(`assignee = $${params.length}`); }
    if (title !== undefined) { params.push(title); sets.push(`title = $${params.length}`); }
    params.push(taskId);

    const { rowCount } = await db.query(`UPDATE research_tasks SET ${sets.join(', ')} WHERE id::text = $${params.length}`, params);
    if (Number(rowCount || 0) === 0) {
      return res.status(404).json({ error: { code: 'TASK_NOT_FOUND', message: `Research task ${taskId} not found`, trace_id: traceId(req) } });
    }
    res.json({ data: { taskId, status: status || '', updatedAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── GET /rollups ───
router.get('/rollups', validateQuery(ConfidenceQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.query as unknown as z.infer<typeof ConfidenceQuery>;
    const { rows } = await db.query(
      `SELECT id, rollup_scope, scope_id, weighted_score, lowest_critical_score, assessment_count
         FROM confidence_rollups
        WHERE company_id::text = $1
        ORDER BY computed_at DESC`,
      [companyId],
    );

    res.json({
      data: {
        rollups: rows.map((r: any) => ({
          rollupId: r.id,
          scope: r.rollup_scope,
          scopeId: r.scope_id,
          weightedScore: Number(r.weighted_score || 0),
          lowestCriticalScore: Number(r.lowest_critical_score || 0),
          assessmentCount: r.assessment_count || 0,
        })),
      },
      meta: meta({ companyId }),
    });
  } catch (error) { next(error); }
});

export default router;
