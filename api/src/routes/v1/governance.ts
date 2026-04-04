import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { validate, validateParams, validateQuery } from '../../middleware/validate';

const router = Router();

const ID_PATTERN = /^[0-9a-fA-F-]{36}$/;
const idSchema = z.string().regex(ID_PATTERN, 'Invalid identifier format');

const GovernanceListQuery = z.object({
  companyId: idSchema,
  status: z.string().optional(),
  versionId: idSchema.optional(),
  eventType: z.string().optional(),
  entityType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  family: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const WorkflowIdParam = z.object({ workflowId: idSchema });
const VersionIdParam = z.object({ versionId: idSchema });
const DecisionRecordIdParam = z.object({ decisionRecordId: idSchema });

const SubmitBody = z.object({
  versionId: idSchema,
  submitter: z.string().optional(),
  comment: z.string().optional(),
});

const ApproveBody = z.object({
  approver: z.string().trim().min(1),
  comment: z.string().optional(),
});

const RejectBody = z.object({
  reviewer: z.string().trim().min(1),
  reason: z.string().trim().min(1),
});

const PublishBody = z.object({
  actor: z.string().optional(),
  comment: z.string().optional(),
});

const UnpublishBody = z.object({
  actor: z.string().optional(),
  reason: z.string().optional(),
});

const DecisionMemoryCreateBody = z.object({
  companyId: idSchema,
  title: z.string().trim().min(1).max(300),
  family: z.string().optional(),
  owner: z.string().optional(),
  linkedVersionId: idSchema.optional(),
  rationale: z.string().optional(),
  outcome: z.string().optional(),
  lessons: z.string().optional(),
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

// ─── GET /versions ───
router.get('/versions', validateQuery(GovernanceListQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, status, limit = 50, offset = 0 } = req.query as unknown as z.infer<typeof GovernanceListQuery>;
    const params: unknown[] = [companyId, limit, offset];
    let where = `pv.scenario_id IN (SELECT id FROM scenarios WHERE company_id::text = $1 AND is_deleted = FALSE)`;
    if (status) {
      where += ` AND pv.governance_state::text = $${params.length + 1}`;
      params.push(status);
    }

    const { rows } = await db.query(
      `SELECT pv.id, pv.label, pv.scenario_id, pv.governance_state::text,
              pv.created_at,
              pe_pub.occurred_at AS published_at,
              pe_appr.acted_at AS approved_at
         FROM plan_versions pv
         LEFT JOIN LATERAL (
           SELECT occurred_at FROM publication_events pe
           WHERE pe.version_id = pv.id AND pe.action = 'publish'
           ORDER BY pe.occurred_at DESC LIMIT 1
         ) pe_pub ON TRUE
         LEFT JOIN LATERAL (
           SELECT acted_at FROM approval_workflow_steps aws
           WHERE aws.workflow_id IN (
             SELECT id FROM approval_workflows aw WHERE aw.plan_version_id = pv.id
           ) AND aws.action = 'approve'
           ORDER BY aws.acted_at DESC LIMIT 1
         ) pe_appr ON TRUE
        WHERE ${where}
        ORDER BY pv.created_at DESC
        LIMIT $2 OFFSET $3`,
      params,
    );

    res.json({
      data: rows.map((r: any) => ({
        versionId: r.id,
        label: r.label || '',
        scenarioId: r.scenario_id,
        governanceState: r.governance_state,
        approvedAt: r.approved_at || null,
        publishedAt: r.published_at || null,
      })),
      meta: meta({ companyId }),
    });
  } catch (error) { next(error); }
});

// ─── GET /approval-workflows ───
router.get('/approval-workflows', validateQuery(GovernanceListQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, versionId, limit = 50, offset = 0 } = req.query as unknown as z.infer<typeof GovernanceListQuery>;
    const params: unknown[] = [companyId, limit, offset];
    let where = `aw.tenant_id IN (SELECT tenant_id FROM companies WHERE id::text IN (SELECT company_id::text FROM scenarios WHERE company_id::text = $1))`;

    if (versionId) {
      where += ` AND aw.plan_version_id::text = $${params.length + 1}`;
      params.push(versionId);
    }

    const { rows } = await db.query(
      `SELECT aw.id, aw.plan_version_id, aw.status::text, aw.created_at
         FROM approval_workflows aw
        WHERE ${where}
        ORDER BY aw.created_at DESC
        LIMIT $2 OFFSET $3`,
      params,
    );

    const workflows = [];
    for (const row of rows as Array<{ id: string; plan_version_id: string; status: string; created_at: string }>) {
      const steps = await db.query(
        `SELECT step_order, approver, action, acted_at, comment
           FROM approval_workflow_steps
          WHERE workflow_id::text = $1
          ORDER BY step_order ASC`,
        [row.id],
      );
      workflows.push({
        workflowId: row.id,
        versionId: row.plan_version_id,
        status: row.status,
        submittedAt: row.created_at,
        steps: steps.rows.map((s: any) => ({
          stepOrder: s.step_order,
          approver: s.approver,
          action: s.action,
          actedAt: s.acted_at,
          comment: s.comment,
        })),
      });
    }

    res.json({ data: workflows, meta: meta({ companyId }) });
  } catch (error) { next(error); }
});

// ─── POST /approval-workflows/:workflowId/submit ───
router.post('/approval-workflows/:workflowId/submit', validateParams(WorkflowIdParam), validate(SubmitBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflowId } = req.params as z.infer<typeof WorkflowIdParam>;
    const { submitter, comment } = req.body as z.infer<typeof SubmitBody>;

    await db.query(
      `UPDATE approval_workflows SET status = 'submitted', updated_at = NOW() WHERE id::text = $1`,
      [workflowId],
    );

    await db.query(
      `INSERT INTO approval_workflow_steps (id, workflow_id, step_order, approver, action, comment, acted_at)
       VALUES ($1, $2::uuid, 0, $3, 'submit', $4, NOW())`,
      [crypto.randomUUID(), workflowId, submitter || 'system', comment || null],
    );

    res.json({ data: { workflowId, status: 'submitted', submittedAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── POST /approval-workflows/:workflowId/approve ───
router.post('/approval-workflows/:workflowId/approve', validateParams(WorkflowIdParam), validate(ApproveBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflowId } = req.params as z.infer<typeof WorkflowIdParam>;
    const { approver, comment } = req.body as z.infer<typeof ApproveBody>;

    await db.query(`UPDATE approval_workflows SET status = 'approved', updated_at = NOW() WHERE id::text = $1`, [workflowId]);

    const maxStep = await db.query(`SELECT COALESCE(MAX(step_order), 0)::int AS max_step FROM approval_workflow_steps WHERE workflow_id::text = $1`, [workflowId]);
    const nextStep = (maxStep.rows[0]?.max_step || 0) + 1;

    await db.query(
      `INSERT INTO approval_workflow_steps (id, workflow_id, step_order, approver, action, comment, acted_at)
       VALUES ($1, $2::uuid, $3, $4, 'approve', $5, NOW())`,
      [crypto.randomUUID(), workflowId, nextStep, approver, comment || null],
    );

    res.json({ data: { workflowId, status: 'approved', approvedAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── POST /approval-workflows/:workflowId/reject ───
router.post('/approval-workflows/:workflowId/reject', validateParams(WorkflowIdParam), validate(RejectBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflowId } = req.params as z.infer<typeof WorkflowIdParam>;
    const { reviewer, reason } = req.body as z.infer<typeof RejectBody>;

    await db.query(`UPDATE approval_workflows SET status = 'rejected', updated_at = NOW() WHERE id::text = $1`, [workflowId]);

    const maxStep = await db.query(`SELECT COALESCE(MAX(step_order), 0)::int AS max_step FROM approval_workflow_steps WHERE workflow_id::text = $1`, [workflowId]);
    const nextStep = (maxStep.rows[0]?.max_step || 0) + 1;

    await db.query(
      `INSERT INTO approval_workflow_steps (id, workflow_id, step_order, approver, action, comment, acted_at)
       VALUES ($1, $2::uuid, $3, $4, 'reject', $5, NOW())`,
      [crypto.randomUUID(), workflowId, nextStep, reviewer, reason],
    );

    res.json({ data: { workflowId, status: 'rejected', rejectedAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── GET /events ───
router.get('/events', validateQuery(GovernanceListQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, eventType, limit = 50, offset = 0 } = req.query as unknown as z.infer<typeof GovernanceListQuery>;
    const params: unknown[] = [companyId, limit, offset];
    let where = `(ge.company_id::text = $1 OR ge.tenant_id IN (SELECT tenant_id FROM companies WHERE id::text = $1))`;
    if (eventType) {
      where += ` AND ge.event_type::text = $${params.length + 1}`;
      params.push(eventType);
    }

    const { rows } = await db.query(
      `SELECT ge.id, ge.event_type::text, COALESCE(ge.actor_id, ge.user_id::text, '') AS actor,
              ge.version_id, ge.plan_version_id, ge.occurred_at, ge.created_at,
              COALESCE(ge.metadata, ge.details) AS details
         FROM governance_events ge
        WHERE ${where}
        ORDER BY COALESCE(ge.occurred_at, ge.created_at) DESC
        LIMIT $2 OFFSET $3`,
      params,
    );

    res.json({
      data: rows.map((r: any) => ({
        eventId: r.id,
        eventType: r.event_type,
        entityType: 'version',
        entityId: r.version_id || r.plan_version_id || '',
        actor: r.actor,
        timestamp: r.occurred_at || r.created_at,
        details: r.details || {},
      })),
      meta: meta({ companyId }),
    });
  } catch (error) { next(error); }
});

// ─── GET /audit-log ───
router.get('/audit-log', validateQuery(GovernanceListQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, entityType, startDate, endDate, limit = 50, offset = 0 } = req.query as unknown as z.infer<typeof GovernanceListQuery>;
    const params: unknown[] = [companyId, limit, offset];
    let where = `(ge.company_id::text = $1 OR ge.tenant_id IN (SELECT tenant_id FROM companies WHERE id::text = $1))`;
    if (entityType) {
      where += ` AND ge.event_type::text ILIKE '%' || $${params.length + 1} || '%'`;
      params.push(entityType);
    }
    if (startDate) {
      where += ` AND COALESCE(ge.occurred_at, ge.created_at) >= $${params.length + 1}::timestamptz`;
      params.push(startDate);
    }
    if (endDate) {
      where += ` AND COALESCE(ge.occurred_at, ge.created_at) <= $${params.length + 1}::timestamptz`;
      params.push(endDate);
    }

    const { rows } = await db.query(
      `SELECT ge.id, ge.event_type::text AS action, COALESCE(ge.actor_id, ge.user_id::text, '') AS actor,
              'version' AS entity_type, COALESCE(ge.version_id, ge.plan_version_id)::text AS entity_id,
              COALESCE(ge.occurred_at, ge.created_at) AS ts,
              COALESCE(ge.metadata, ge.details) AS change_details
         FROM governance_events ge
        WHERE ${where}
        ORDER BY COALESCE(ge.occurred_at, ge.created_at) DESC
        LIMIT $2 OFFSET $3`,
      params,
    );

    res.json({
      data: rows.map((r: any) => ({
        logId: r.id,
        action: r.action,
        actor: r.actor,
        entityType: r.entity_type,
        entityId: r.entity_id || '',
        timestamp: r.ts,
        changeDetails: r.change_details || {},
        surfaceContext: 'governance',
      })),
      meta: meta({ companyId }),
    });
  } catch (error) { next(error); }
});

// ─── GET /decision-memory ───
router.get('/decision-memory', validateQuery(GovernanceListQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, family, limit = 50, offset = 0 } = req.query as unknown as z.infer<typeof GovernanceListQuery>;
    const params: unknown[] = [companyId, limit, offset];
    let where = `dr.company_id::text = $1 AND dr.is_deleted = FALSE`;
    if (family) {
      where += ` AND dr.family::text = $${params.length + 1}`;
      params.push(family);
    }

    const { rows } = await db.query(
      `SELECT dr.id, COALESCE(dr.title, dr.decision_title) AS title,
              dr.family::text, COALESCE(dr.owner_user_id, '') AS owner,
              dr.created_at AS decision_date,
              dr.version_id AS linked_version_id,
              COALESCE(dr.rationale_summary, '') AS outcome
         FROM decision_records dr
        WHERE ${where}
        ORDER BY dr.created_at DESC
        LIMIT $2 OFFSET $3`,
      params,
    );

    res.json({
      data: rows.map((r: any) => ({
        decisionRecordId: r.id,
        title: r.title || 'Untitled',
        family: r.family || '',
        owner: r.owner,
        decisionDate: r.decision_date,
        linkedVersionId: r.linked_version_id || '',
        outcome: r.outcome,
      })),
      meta: meta({ companyId }),
    });
  } catch (error) { next(error); }
});

// ─── POST /decision-memory ───
router.post('/decision-memory', validate(DecisionMemoryCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, title, family, owner, linkedVersionId, rationale, outcome, lessons } = req.body as z.infer<typeof DecisionMemoryCreateBody>;
    const id = crypto.randomUUID();

    await db.query(
      `INSERT INTO decision_records (id, company_id, version_id, family, title, owner_user_id, rationale_summary, metadata, status)
       VALUES ($1, $2::uuid, $3::uuid, $4::decision_family, $5, $6, $7, $8::jsonb, 'active')`,
      [id, companyId, linkedVersionId || null, family || null, title, owner || null, rationale || null, JSON.stringify({ outcome: outcome || '', lessons: lessons || '' })],
    );

    res.status(201).json({ data: { decisionRecordId: id, title, createdAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── GET /decision-memory/:decisionRecordId ───
router.get('/decision-memory/:decisionRecordId', validateParams(DecisionRecordIdParam), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decisionRecordId } = req.params as z.infer<typeof DecisionRecordIdParam>;
    const { rows } = await db.query(
      `SELECT dr.id, COALESCE(dr.title, dr.decision_title) AS title, dr.family::text,
              COALESCE(dr.rationale_summary, '') AS rationale,
              COALESCE(dr.owner_user_id, '') AS owner,
              dr.created_at AS decision_date,
              dr.version_id AS linked_version_id,
              dr.metadata
         FROM decision_records dr
        WHERE dr.id::text = $1 AND dr.is_deleted = FALSE`,
      [decisionRecordId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'DECISION_RECORD_NOT_FOUND', message: `Decision record ${decisionRecordId} not found`, trace_id: traceId(req) } });
    }
    const r = rows[0];
    const md = (r.metadata || {}) as Record<string, unknown>;
    res.json({
      data: {
        decisionRecordId: r.id,
        title: r.title || 'Untitled',
        family: r.family || '',
        rationale: r.rationale,
        owner: r.owner,
        decisionDate: r.decision_date,
        linkedVersionId: r.linked_version_id || '',
        outcome: String(md.outcome || ''),
        lessons: String(md.lessons || ''),
      },
      meta: meta(),
    });
  } catch (error) { next(error); }
});

// ─── POST /publication/:versionId/publish ───
router.post('/publication/:versionId/publish', validateParams(VersionIdParam), validate(PublishBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params as z.infer<typeof VersionIdParam>;
    const { actor } = req.body as z.infer<typeof PublishBody>;

    await db.query(`UPDATE plan_versions SET governance_state = 'published', updated_at = NOW() WHERE id::text = $1`, [versionId]);
    await db.query(
      `INSERT INTO publication_events (id, version_id, action, actor_id) VALUES ($1, $2::uuid, 'publish', $3)`,
      [crypto.randomUUID(), versionId, actor || 'system'],
    );

    res.json({ data: { versionId, governanceState: 'published', publishedAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── POST /publication/:versionId/unpublish ───
router.post('/publication/:versionId/unpublish', validateParams(VersionIdParam), validate(UnpublishBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params as z.infer<typeof VersionIdParam>;
    const { actor } = req.body as z.infer<typeof UnpublishBody>;

    await db.query(`UPDATE plan_versions SET governance_state = 'draft', updated_at = NOW() WHERE id::text = $1`, [versionId]);
    await db.query(
      `INSERT INTO publication_events (id, version_id, action, actor_id) VALUES ($1, $2::uuid, 'unpublish', $3)`,
      [crypto.randomUUID(), versionId, actor || 'system'],
    );

    res.json({ data: { versionId, governanceState: 'draft', unpublishedAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

export default router;
