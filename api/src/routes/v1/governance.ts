import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { validate, validateParams, validateQuery } from '../../middleware/validate';
import {
  governanceStateFromVersion,
  idSchema,
  meta,
  paginate,
  safeNumber,
  traceId,
} from './_shared';

const router = Router();

const VersionsQuery = z.object({
  companyId: idSchema,
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const WorkflowsQuery = z.object({
  companyId: idSchema,
  versionId: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const EventsQuery = z.object({
  companyId: idSchema,
  eventType: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const AuditQuery = z.object({
  companyId: idSchema,
  entityType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const DecisionMemoryQuery = z.object({
  companyId: idSchema,
  family: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const WorkflowActionBody = z.object({
  reason: z.string().trim().min(1),
  notes: z.string().optional(),
  suggestedActions: z.array(z.string()).optional(),
});

const DecisionMemoryBody = z.object({
  title: z.string().trim().min(1),
  family: z.string().trim().min(1),
  rationale: z.string().optional(),
  owner: z.string().optional(),
  decisionDate: z.string().trim().min(1),
  linkedVersionId: idSchema.optional(),
  linkedDecisionId: idSchema.optional(),
  companyId: idSchema.optional(),
  scenarioId: idSchema.optional(),
});

const PublicationBody = z.object({
  reason: z.string().trim().min(1),
});

const WorkflowParams = z.object({ workflowId: idSchema });
const DecisionRecordParams = z.object({ decisionRecordId: idSchema });
const VersionParams = z.object({ versionId: idSchema });

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

async function logGovernanceEvent(companyId: string, versionId: string | null, eventType: string, reason: string, metadataValue?: Record<string, unknown>) {
  const tenantId = await resolveCompanyTenant(companyId);
  if (!tenantId) return;

  await db.query(
    `INSERT INTO governance_events
       (tenant_id, plan_version_id, event_type, details, company_id, version_id, actor_id, occurred_at, metadata)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, 'system', NOW(), $7::jsonb)`,
    [
      tenantId,
      versionId,
      eventType,
      JSON.stringify({ reason, ...(metadataValue || {}) }),
      companyId,
      versionId,
      JSON.stringify({ reason, ...(metadataValue || {}) }),
    ],
  );
}

async function resolveWorkflow(workflowId: string) {
  const result = await db.query(
    `SELECT id,
            COALESCE(company_id, pv.company_id) AS company_id,
            COALESCE(version_id, plan_version_id) AS version_id,
            COALESCE(status::text, approval_status::text, 'draft') AS workflow_status,
            workflow_type,
            approval_status,
            approver_id,
            approval_step,
            comments
       FROM approval_workflows aw
       LEFT JOIN plan_versions pv
         ON pv.id = COALESCE(aw.version_id, aw.plan_version_id)
      WHERE aw.id::text = $1`,
    [workflowId],
  );
  return result.rowCount ? result.rows[0] : null;
}

router.get('/versions', validateQuery(VersionsQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, status } = req.query as unknown as z.infer<typeof VersionsQuery>;
    const { limit, offset } = paginate(req.query);
    const params: any[] = [companyId];
    let idx = 2;
    let clauses = '';

    if (status) {
      clauses += ` AND (
        pv.status::text = $${idx}
        OR (pv.is_frozen = TRUE AND $${idx} = 'frozen')
        OR (pv.published_at IS NOT NULL AND $${idx} = 'published')
      )`;
      params.push(status);
      idx += 1;
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT pv.id, COALESCE(pv.version_label, pv.name) AS label, pv.scenario_id,
              pv.status::text AS status, pv.is_frozen, pv.frozen_at, pv.published_at,
              (
                SELECT MAX(actioned_at)
                  FROM approval_workflows aw
                 WHERE COALESCE(aw.version_id, aw.plan_version_id)::text = pv.id::text
                   AND COALESCE(aw.approval_status::text, aw.status::text) = 'approved'
              ) AS approved_at
         FROM plan_versions pv
        WHERE pv.company_id::text = $1
          AND pv.is_deleted = FALSE
          ${clauses}
        ORDER BY pv.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({
      data: rows.map((row: any) => ({
        versionId: row.id,
        label: row.label,
        scenarioId: row.scenario_id,
        governanceState: governanceStateFromVersion(row),
        approvedAt: row.approved_at,
        publishedAt: row.published_at,
      })),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/approval-workflows', validateQuery(WorkflowsQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, versionId } = req.query as unknown as z.infer<typeof WorkflowsQuery>;
    const { limit, offset } = paginate(req.query);
    const params: any[] = [companyId];
    let idx = 2;
    let clauses = '';

    if (versionId) {
      clauses += ` AND COALESCE(aw.version_id, aw.plan_version_id)::text = $${idx++}`;
      params.push(versionId);
    }

    params.push(limit, offset);

    const workflows = await db.query(
      `SELECT aw.id,
              COALESCE(aw.version_id, aw.plan_version_id) AS version_id,
              COALESCE(aw.status::text, aw.approval_status::text, 'draft') AS status,
              aw.created_at AS submitted_at,
              aw.workflow_type,
              aw.approver_id,
              aw.approval_step,
              aw.comments,
              aw.actioned_at,
              COALESCE(
                json_agg(
                  json_build_object(
                    'stepOrder', aws.step_order,
                    'stepName', COALESCE(NULLIF(aws.action, ''), aw.workflow_type, 'Approval'),
                    'requiredRole', COALESCE(aws.approver, 'reviewer'),
                    'status', COALESCE(aws.action, 'pending'),
                    'actedAt', aws.acted_at,
                    'comment', aws.comment
                  )
                  ORDER BY aws.step_order ASC, aws.created_at ASC
                ) FILTER (WHERE aws.id IS NOT NULL),
                '[]'::json
              ) AS step_rows
         FROM approval_workflows aw
         LEFT JOIN plan_versions pv
           ON pv.id = COALESCE(aw.version_id, aw.plan_version_id)
         LEFT JOIN approval_workflow_steps aws
           ON aws.workflow_id = aw.id
        WHERE COALESCE(aw.company_id, pv.company_id)::text = $1
          ${clauses}
        GROUP BY aw.id,
                 COALESCE(aw.version_id, aw.plan_version_id),
                 COALESCE(aw.status::text, aw.approval_status::text, 'draft'),
                 aw.created_at,
                 aw.workflow_type,
                 aw.approver_id,
                 aw.approval_step,
                 aw.comments,
                 aw.actioned_at
        ORDER BY aw.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    const data = (workflows.rows as Array<any>).map((workflow) => {
      const steps = Array.isArray(workflow.step_rows) && workflow.step_rows.length > 0
        ? workflow.step_rows
        : [{
            stepOrder: workflow.approval_step || 1,
            stepName: workflow.workflow_type || 'Approval',
            requiredRole: workflow.approver_id ? String(workflow.approver_id) : 'reviewer',
            status: workflow.status,
            actedAt: workflow.actioned_at,
            comment: workflow.comments,
          }];

      return {
        workflowId: workflow.id,
        versionId: workflow.version_id,
        status: workflow.status,
        submittedAt: workflow.submitted_at,
        steps,
      };
    });

    res.json({ data, meta: meta() });
  } catch (error) {
    next(error);
  }
});

router.post('/approval-workflows/:workflowId/submit', validateParams(WorkflowParams), validate(WorkflowActionBody), async (req: Request, res: Response, next: NextFunction) => {
  const client = await db.connect();
  let started = false;
  try {
    const { workflowId } = req.params as z.infer<typeof WorkflowParams>;
    const workflow = await resolveWorkflow(workflowId);

    if (!workflow) {
      return res.status(404).json({
        error: { code: 'WORKFLOW_NOT_FOUND', message: `Workflow ${workflowId} not found`, trace_id: traceId(req) },
      });
    }

    const { reason, notes } = req.body as z.infer<typeof WorkflowActionBody>;

    await client.query('BEGIN');
    started = true;

    const updatedWorkflow = await client.query(
      `UPDATE approval_workflows
          SET approval_status = 'pending',
              comments = $2,
              actioned_at = NULL,
              completed_at = NULL,
              workflow_type = COALESCE(workflow_type, 'review'),
              status = 'submitted'
        WHERE id::text = $1
        RETURNING id`,
      [workflowId, notes || reason],
    );

    if (updatedWorkflow.rowCount === 0) {
      await client.query('ROLLBACK');
      started = false;
      return res.status(404).json({
        error: { code: 'WORKFLOW_NOT_FOUND', message: `Workflow ${workflowId} not found`, trace_id: traceId(req) },
      });
    }

    await client.query(
      `UPDATE plan_versions
          SET status = 'in_review',
              updated_at = NOW()
        WHERE id::text = $1`,
      [workflow.version_id],
    );

    await client.query(
      `INSERT INTO approval_workflow_steps (workflow_id, step_order, approver, action, acted_at, comment)
       VALUES ($1, 1, 'reviewer', 'submit', NOW(), $2)`,
      [workflowId, reason],
    );

    await client.query('COMMIT');
    started = false;

    await logGovernanceEvent(workflow.company_id, workflow.version_id, 'submit', reason, { workflowId });

    res.json({
      data: {
        workflowId,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      },
      meta: meta({ governanceState: 'under_review' }),
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

router.post('/approval-workflows/:workflowId/approve', validateParams(WorkflowParams), validate(WorkflowActionBody), async (req: Request, res: Response, next: NextFunction) => {
  const client = await db.connect();
  let started = false;
  try {
    const { workflowId } = req.params as z.infer<typeof WorkflowParams>;
    const workflow = await resolveWorkflow(workflowId);

    if (!workflow) {
      return res.status(404).json({
        error: { code: 'WORKFLOW_NOT_FOUND', message: `Workflow ${workflowId} not found`, trace_id: traceId(req) },
      });
    }

    const { reason } = req.body as z.infer<typeof WorkflowActionBody>;

    await client.query('BEGIN');
    started = true;

    const updatedWorkflow = await client.query(
      `UPDATE approval_workflows
          SET approval_status = 'approved',
              comments = $2,
              actioned_at = NOW(),
              completed_at = NOW(),
              status = 'approved'
        WHERE id::text = $1
        RETURNING id`,
      [workflowId, reason],
    );

    if (updatedWorkflow.rowCount === 0) {
      await client.query('ROLLBACK');
      started = false;
      return res.status(404).json({
        error: { code: 'WORKFLOW_NOT_FOUND', message: `Workflow ${workflowId} not found`, trace_id: traceId(req) },
      });
    }

    await client.query(
      `UPDATE plan_versions
          SET status = 'approved',
              updated_at = NOW()
        WHERE id::text = $1`,
      [workflow.version_id],
    );

    await client.query(
      `INSERT INTO approval_workflow_steps (workflow_id, step_order, approver, action, acted_at, comment)
       VALUES ($1, COALESCE($2, 1), 'approver', 'approve', NOW(), $3)`,
      [workflowId, workflow.approval_step, reason],
    );

    await client.query('COMMIT');
    started = false;

    await logGovernanceEvent(workflow.company_id, workflow.version_id, 'approve', reason, { workflowId });

    res.json({
      data: {
        workflowId,
        status: 'approved',
        approvedAt: new Date().toISOString(),
      },
      meta: meta({ governanceState: 'approved' }),
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

router.post('/approval-workflows/:workflowId/reject', validateParams(WorkflowParams), validate(WorkflowActionBody), async (req: Request, res: Response, next: NextFunction) => {
  const client = await db.connect();
  let started = false;
  try {
    const { workflowId } = req.params as z.infer<typeof WorkflowParams>;
    const workflow = await resolveWorkflow(workflowId);

    if (!workflow) {
      return res.status(404).json({
        error: { code: 'WORKFLOW_NOT_FOUND', message: `Workflow ${workflowId} not found`, trace_id: traceId(req) },
      });
    }

    const { reason, suggestedActions } = req.body as z.infer<typeof WorkflowActionBody>;
    const comment = suggestedActions && suggestedActions.length > 0
      ? `${reason}\nSuggested actions: ${suggestedActions.join(', ')}`
      : reason;

    await client.query('BEGIN');
    started = true;

    const updatedWorkflow = await client.query(
      `UPDATE approval_workflows
          SET approval_status = 'rejected',
              comments = $2,
              actioned_at = NOW(),
              completed_at = NOW(),
              status = 'rejected'
        WHERE id::text = $1
        RETURNING id`,
      [workflowId, comment],
    );

    if (updatedWorkflow.rowCount === 0) {
      await client.query('ROLLBACK');
      started = false;
      return res.status(404).json({
        error: { code: 'WORKFLOW_NOT_FOUND', message: `Workflow ${workflowId} not found`, trace_id: traceId(req) },
      });
    }

    await client.query(
      `UPDATE plan_versions
          SET status = 'archived',
              updated_at = NOW()
        WHERE id::text = $1`,
      [workflow.version_id],
    );

    await client.query(
      `INSERT INTO approval_workflow_steps (workflow_id, step_order, approver, action, acted_at, comment)
       VALUES ($1, COALESCE($2, 1), 'approver', 'reject', NOW(), $3)`,
      [workflowId, workflow.approval_step, comment],
    );

    await client.query('COMMIT');
    started = false;

    await logGovernanceEvent(workflow.company_id, workflow.version_id, 'reject', reason, { workflowId, suggestedActions: suggestedActions || [] });

    res.json({
      data: {
        workflowId,
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
      },
      meta: meta({ governanceState: 'rejected' }),
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

router.get('/events', validateQuery(EventsQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, eventType } = req.query as unknown as z.infer<typeof EventsQuery>;
    const { limit, offset } = paginate(req.query);
    const params: any[] = [companyId];
    let idx = 2;
    let clauses = '';

    if (eventType) {
      clauses += ` AND event_type = $${idx++}`;
      params.push(eventType);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT id, event_type, COALESCE(entity_type, 'version') AS entity_type,
              COALESCE(entity_id, version_id, plan_version_id) AS entity_id,
              COALESCE(actor_id, actor_role, user_id::text, 'system') AS actor,
              COALESCE(event_timestamp, occurred_at, created_at) AS ts,
              COALESCE(metadata, details, '{}'::jsonb) AS details
         FROM governance_events
        WHERE company_id::text = $1
          ${clauses}
        ORDER BY COALESCE(event_timestamp, occurred_at, created_at) DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({
      data: rows.map((row: any) => ({
        eventId: row.id,
        eventType: row.event_type,
        entityType: row.entity_type,
        entityId: row.entity_id,
        actor: row.actor,
        timestamp: row.ts,
        details: row.details || {},
      })),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/audit-log', validateQuery(AuditQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, entityType, startDate, endDate } = req.query as unknown as z.infer<typeof AuditQuery>;
    const { limit, offset } = paginate(req.query);
    const params: any[] = [companyId];
    let idx = 2;
    let clauses = '';

    if (entityType) {
      clauses += ` AND COALESCE(entity_type, 'version') = $${idx++}`;
      params.push(entityType);
    }
    if (startDate) {
      clauses += ` AND COALESCE(event_timestamp, occurred_at, created_at) >= $${idx++}`;
      params.push(startDate);
    }
    if (endDate) {
      clauses += ` AND COALESCE(event_timestamp, occurred_at, created_at) <= $${idx++}`;
      params.push(endDate);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT id, event_type, COALESCE(actor_id, actor_role, user_id::text, 'system') AS actor,
              COALESCE(entity_type, 'version') AS entity_type,
              COALESCE(entity_id, version_id, plan_version_id) AS entity_id,
              COALESCE(event_timestamp, occurred_at, created_at) AS ts,
              COALESCE(metadata, details, '{}'::jsonb) AS details
         FROM governance_events
        WHERE company_id::text = $1
          ${clauses}
        ORDER BY COALESCE(event_timestamp, occurred_at, created_at) DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({
      data: rows.map((row: any) => ({
        logId: row.id,
        action: row.event_type,
        actor: row.actor,
        entityType: row.entity_type,
        entityId: row.entity_id,
        timestamp: row.ts,
        changeDetails: row.details || {},
        surfaceContext: 'governance',
      })),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/decision-memory', validateQuery(DecisionMemoryQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, family } = req.query as unknown as z.infer<typeof DecisionMemoryQuery>;
    const { limit, offset } = paginate(req.query);
    const params: any[] = [companyId];
    let idx = 2;
    let clauses = '';

    if (family) {
      clauses += ` AND COALESCE(dr.family::text, dr.decision_type) = $${idx++}`;
      params.push(family);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT dr.id,
              COALESCE(dr.title, dr.decision_title) AS title,
              COALESCE(dr.family::text, dr.decision_type) AS family,
              COALESCE(dr.owner_user_id, dr.decided_by::text, 'system') AS owner,
              COALESCE(dr.decided_at::date, dr.created_at::date) AS decision_date,
              COALESCE(dr.version_id, dr.plan_version_id) AS linked_version_id,
              COALESCE(do.outcome_summary, 'Pending outcome capture') AS outcome
         FROM decision_records dr
         LEFT JOIN plan_versions pv
           ON pv.id = COALESCE(dr.version_id, dr.plan_version_id)
         LEFT JOIN LATERAL (
           SELECT outcome_summary
             FROM decision_outcomes dout
            WHERE COALESCE(dout.decision_id, dout.decision_record_id)::text = dr.id::text
            ORDER BY COALESCE(dout.recorded_at, dout.review_date::timestamptz, dout.created_at) DESC
            LIMIT 1
         ) do ON TRUE
        WHERE COALESCE(dr.company_id::text, pv.company_id::text) = $1
          AND COALESCE(dr.is_deleted, FALSE) = FALSE
          ${clauses}
        ORDER BY COALESCE(dr.decided_at, dr.created_at) DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({
      data: rows.map((row: any) => ({
        decisionRecordId: row.id,
        title: row.title,
        family: row.family,
        owner: row.owner,
        decisionDate: row.decision_date,
        linkedVersionId: row.linked_version_id,
        outcome: row.outcome,
      })),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/decision-memory', validate(DecisionMemoryBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as z.infer<typeof DecisionMemoryBody>;
    let companyId = body.companyId || null;
    let scenarioId = body.scenarioId || null;
    let versionId = body.linkedVersionId || null;

    if (versionId) {
      const version = await db.query(
        `SELECT company_id, scenario_id
           FROM plan_versions
          WHERE id::text = $1
            AND is_deleted = FALSE`,
        [versionId],
      );
      if (version.rowCount === 0) {
        return res.status(404).json({
          error: { code: 'VERSION_NOT_FOUND', message: `Version ${versionId} not found`, trace_id: traceId(req) },
        });
      }
      companyId = companyId || version.rows[0].company_id;
      scenarioId = scenarioId || version.rows[0].scenario_id;
    }

    if (!companyId) {
      return res.status(400).json({
        error: { code: 'MISSING_COMPANY_CONTEXT', message: 'linkedVersionId or companyId is required', trace_id: traceId(req) },
      });
    }

    const tenantId = await resolveCompanyTenant(companyId);
    if (!tenantId) {
      return res.status(404).json({
        error: { code: 'COMPANY_NOT_FOUND', message: `Company ${companyId} not found`, trace_id: traceId(req) },
      });
    }

    const created = await db.query(
      `INSERT INTO decision_records
         (tenant_id, plan_version_id, decision_title, decision_type, decision_context, rationale, decided_at, company_id, scenario_id, version_id, family, status, title, rationale_summary, owner_user_id, metadata, updated_at)
       VALUES ($1, $2, $3, $4, NULL, $5, $6::date, $7, $8, $9, $10, 'draft', $3, $5, $11, $12::jsonb, NOW())
       RETURNING id, created_at`,
      [
        tenantId,
        versionId,
        body.title,
        body.family,
        body.rationale || null,
        body.decisionDate,
        companyId,
        scenarioId,
        versionId,
        body.family,
        body.owner || null,
        JSON.stringify({ linkedDecisionId: body.linkedDecisionId || null }),
      ],
    );

    if (body.linkedDecisionId) {
      await db.query(
        `INSERT INTO decision_outcomes
           (tenant_id, decision_record_id, review_date, outcome_summary, created_at)
         VALUES ($1, $2, $3::date, 'Linked to prior decision context', NOW())`,
        [tenantId, body.linkedDecisionId, body.decisionDate],
      ).catch(() => undefined);
    }

    res.status(201).json({
      data: {
        decisionRecordId: created.rows[0].id,
        title: body.title,
        createdAt: created.rows[0].created_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/decision-memory/:decisionRecordId', validateParams(DecisionRecordParams), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decisionRecordId } = req.params as z.infer<typeof DecisionRecordParams>;
    const result = await db.query(
      `SELECT dr.id,
              COALESCE(dr.title, dr.decision_title) AS title,
              COALESCE(dr.family::text, dr.decision_type) AS family,
              COALESCE(dr.rationale_summary, dr.rationale, '') AS rationale,
              COALESCE(dr.owner_user_id, dr.decided_by::text, 'system') AS owner,
              COALESCE(dr.decided_at::date, dr.created_at::date) AS decision_date,
              COALESCE(dr.version_id, dr.plan_version_id) AS linked_version_id,
              COALESCE(do.outcome_summary, 'Pending outcome capture') AS outcome,
              COALESCE(do.lesson_learned, '') AS lessons
         FROM decision_records dr
         LEFT JOIN LATERAL (
           SELECT outcome_summary, lesson_learned
             FROM decision_outcomes dout
            WHERE COALESCE(dout.decision_id, dout.decision_record_id)::text = dr.id::text
            ORDER BY COALESCE(dout.recorded_at, dout.review_date::timestamptz, dout.created_at) DESC
            LIMIT 1
         ) do ON TRUE
        WHERE dr.id::text = $1
          AND COALESCE(dr.is_deleted, FALSE) = FALSE`,
      [decisionRecordId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'DECISION_RECORD_NOT_FOUND', message: `Decision record ${decisionRecordId} not found`, trace_id: traceId(req) },
      });
    }

    const row = result.rows[0] as any;
    res.json({
      data: {
        decisionRecordId: row.id,
        title: row.title,
        family: row.family,
        rationale: row.rationale,
        owner: row.owner,
        decisionDate: row.decision_date,
        linkedVersionId: row.linked_version_id,
        outcome: row.outcome,
        lessons: row.lessons,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/publication/:versionId/publish', validateParams(VersionParams), validate(PublicationBody), async (req: Request, res: Response, next: NextFunction) => {
  const client = await db.connect();
  let started = false;
  try {
    const { versionId } = req.params as z.infer<typeof VersionParams>;
    const { reason } = req.body as z.infer<typeof PublicationBody>;

    await client.query('BEGIN');
    started = true;

    const updatedVersion = await client.query(
      `UPDATE plan_versions
          SET status = 'published',
              is_frozen = TRUE,
              frozen_at = COALESCE(frozen_at, NOW()),
              published_at = NOW(),
              updated_at = NOW()
        WHERE id::text = $1
          AND is_deleted = FALSE
        RETURNING company_id`,
      [versionId],
    );

    if (updatedVersion.rowCount === 0) {
      await client.query('ROLLBACK');
      started = false;
      return res.status(404).json({
        error: { code: 'VERSION_NOT_FOUND', message: `Version ${versionId} not found`, trace_id: traceId(req) },
      });
    }

    await client.query(
      `INSERT INTO publication_events (version_id, action, actor_id, occurred_at)
       VALUES ($1, 'publish', 'system', NOW())`,
      [versionId],
    );

    await client.query('COMMIT');
    started = false;

    await logGovernanceEvent(updatedVersion.rows[0].company_id, versionId, 'publish', reason);

    res.json({
      data: {
        versionId,
        governanceState: 'published',
        publishedAt: new Date().toISOString(),
      },
      meta: meta({ governanceState: 'published' }),
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

router.post('/publication/:versionId/unpublish', validateParams(VersionParams), validate(PublicationBody), async (req: Request, res: Response, next: NextFunction) => {
  const client = await db.connect();
  let started = false;
  try {
    const { versionId } = req.params as z.infer<typeof VersionParams>;
    const { reason } = req.body as z.infer<typeof PublicationBody>;

    await client.query('BEGIN');
    started = true;

    const updatedVersion = await client.query(
      `UPDATE plan_versions
          SET status = 'approved',
              is_frozen = FALSE,
              published_at = NULL,
              updated_at = NOW()
        WHERE id::text = $1
          AND is_deleted = FALSE
        RETURNING company_id`,
      [versionId],
    );

    if (updatedVersion.rowCount === 0) {
      await client.query('ROLLBACK');
      started = false;
      return res.status(404).json({
        error: { code: 'VERSION_NOT_FOUND', message: `Version ${versionId} not found`, trace_id: traceId(req) },
      });
    }

    await client.query(
      `INSERT INTO publication_events (version_id, action, actor_id, occurred_at)
       VALUES ($1, 'unpublish', 'system', NOW())`,
      [versionId],
    );

    await client.query('COMMIT');
    started = false;

    await logGovernanceEvent(updatedVersion.rows[0].company_id, versionId, 'unpublish', reason);

    res.json({
      data: {
        versionId,
        governanceState: 'approved',
        unpublishedAt: new Date().toISOString(),
      },
      meta: meta({ governanceState: 'approved' }),
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

export default router;
