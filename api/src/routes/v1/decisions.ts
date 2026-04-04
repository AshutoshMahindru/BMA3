import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { validate, validateParams, validateQuery } from '../../middleware/validate';

const router = Router();

const ID_PATTERN = /^[0-9a-fA-F-]{36}$/;
const idSchema = z.string().regex(ID_PATTERN, 'Invalid identifier format');

const DecisionListQuery = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  periodId: idSchema.optional(),
  scopeRef: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const DecisionCreateBody = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  title: z.string().trim().min(1).max(300),
  rationaleNote: z.string().optional(),
  owner: z.string().optional(),
  effectivePeriodId: idSchema.optional(),
});

const DecisionUpdateBody = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  status: z.enum(['draft', 'active', 'frozen', 'archived']).optional(),
  owner: z.string().optional(),
});

const DecisionIdParam = z.object({ decisionId: idSchema });

const RationaleBody = z.object({
  rationale: z.string().trim().min(1),
  evidenceRefs: z.array(z.string()).optional(),
});

const LinkBody = z.object({
  targetDecisionId: idSchema,
  linkType: z.string().trim().min(1).max(50),
});

const SequenceBody = z.object({
  sequencePosition: z.number().int().min(0),
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

/**
 * List decisions filtered by family (product, market, marketing, operations).
 * decision_records table uses `family` column as decision_family enum.
 */
async function listDecisions(family: string, query: z.infer<typeof DecisionListQuery>) {
  const { companyId, scenarioId, limit = 50, offset = 0 } = query;
  const params: unknown[] = [companyId, family, limit, offset];
  let where = `dr.company_id::text = $1 AND dr.family::text = $2 AND dr.is_deleted = FALSE`;
  if (scenarioId) {
    where += ` AND dr.scenario_id::text = $${params.length + 1}`;
    params.push(scenarioId);
  }

  const { rows } = await db.query(
    `SELECT dr.id, dr.title, dr.status::text,
            dr.effective_period_id::text AS effective_period,
            COALESCE(dr.owner_user_id, '') AS owner,
            dr.created_at
       FROM decision_records dr
      WHERE ${where}
      ORDER BY dr.created_at DESC
      LIMIT $3 OFFSET $4`,
    params,
  );

  return rows.map((r: any) => ({
    decisionId: r.id,
    title: r.title || r.decision_title || 'Untitled',
    status: r.status,
    effectivePeriod: r.effective_period || '',
    owner: r.owner,
    createdAt: r.created_at,
  }));
}

async function createDecision(family: string, body: z.infer<typeof DecisionCreateBody>) {
  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO decision_records (id, company_id, scenario_id, version_id, family, title, owner_user_id, effective_period_id, status)
     VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::decision_family, $6, $7, $8::uuid, 'draft')`,
    [id, body.companyId, body.scenarioId || null, body.versionId || null, family, body.title, body.owner || null, body.effectivePeriodId || null],
  );
  return { decisionId: id, title: body.title, status: 'draft', createdAt: new Date().toISOString() };
}

async function updateDecision(decisionId: string, body: z.infer<typeof DecisionUpdateBody>) {
  const sets: string[] = ['updated_at = NOW()'];
  const params: unknown[] = [];
  if (body.title !== undefined) { params.push(body.title); sets.push(`title = $${params.length}`); }
  if (body.status !== undefined) { params.push(body.status); sets.push(`status = $${params.length}::governance_status`); }
  if (body.owner !== undefined) { params.push(body.owner); sets.push(`owner_user_id = $${params.length}`); }
  params.push(decisionId);

  const { rowCount } = await db.query(
    `UPDATE decision_records SET ${sets.join(', ')} WHERE id::text = $${params.length} AND is_deleted = FALSE`,
    params,
  );
  return Number(rowCount || 0) > 0;
}

// ─── Products CRUD ───
router.get('/products', validateQuery(DecisionListQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await listDecisions('product', req.query as unknown as z.infer<typeof DecisionListQuery>);
    res.json({ data, meta: meta() });
  } catch (error) { next(error); }
});

router.post('/products', validate(DecisionCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await createDecision('product', req.body);
    res.status(201).json({ data, meta: meta() });
  } catch (error) { next(error); }
});

router.patch('/products/:decisionId', validateParams(DecisionIdParam), validate(DecisionUpdateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decisionId } = req.params as z.infer<typeof DecisionIdParam>;
    const found = await updateDecision(decisionId, req.body);
    if (!found) return res.status(404).json({ error: { code: 'DECISION_NOT_FOUND', message: `Decision ${decisionId} not found`, trace_id: traceId(req) } });
    res.json({ data: { decisionId, title: req.body.title, updatedAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── Markets CRUD ───
router.get('/markets', validateQuery(DecisionListQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await listDecisions('market', req.query as unknown as z.infer<typeof DecisionListQuery>);
    res.json({ data, meta: meta() });
  } catch (error) { next(error); }
});

router.post('/markets', validate(DecisionCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await createDecision('market', req.body);
    res.status(201).json({ data, meta: meta() });
  } catch (error) { next(error); }
});

router.patch('/markets/:decisionId', validateParams(DecisionIdParam), validate(DecisionUpdateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decisionId } = req.params as z.infer<typeof DecisionIdParam>;
    const found = await updateDecision(decisionId, req.body);
    if (!found) return res.status(404).json({ error: { code: 'DECISION_NOT_FOUND', message: `Decision ${decisionId} not found`, trace_id: traceId(req) } });
    res.json({ data: { decisionId, title: req.body.title, updatedAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── POST /markets/:decisionId/sequence ───
router.post('/markets/:decisionId/sequence', validateParams(DecisionIdParam), validate(SequenceBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decisionId } = req.params as z.infer<typeof DecisionIdParam>;
    const { sequencePosition } = req.body as z.infer<typeof SequenceBody>;

    const { rowCount } = await db.query(
      `UPDATE decision_records SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('sequence_position', $1::int), updated_at = NOW()
       WHERE id::text = $2 AND is_deleted = FALSE`,
      [sequencePosition, decisionId],
    );
    if (Number(rowCount || 0) === 0) {
      return res.status(404).json({ error: { code: 'DECISION_NOT_FOUND', message: `Decision ${decisionId} not found`, trace_id: traceId(req) } });
    }
    res.json({ data: { decisionId, sequencePosition, updatedAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── Marketing CRUD ───
router.get('/marketing', validateQuery(DecisionListQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await listDecisions('marketing', req.query as unknown as z.infer<typeof DecisionListQuery>);
    res.json({ data, meta: meta() });
  } catch (error) { next(error); }
});

router.post('/marketing', validate(DecisionCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await createDecision('marketing', req.body);
    res.status(201).json({ data, meta: meta() });
  } catch (error) { next(error); }
});

router.patch('/marketing/:decisionId', validateParams(DecisionIdParam), validate(DecisionUpdateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decisionId } = req.params as z.infer<typeof DecisionIdParam>;
    const found = await updateDecision(decisionId, req.body);
    if (!found) return res.status(404).json({ error: { code: 'DECISION_NOT_FOUND', message: `Decision ${decisionId} not found`, trace_id: traceId(req) } });
    res.json({ data: { decisionId, title: req.body.title, updatedAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── Operations CRUD ───
router.get('/operations', validateQuery(DecisionListQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await listDecisions('operations', req.query as unknown as z.infer<typeof DecisionListQuery>);
    res.json({ data, meta: meta() });
  } catch (error) { next(error); }
});

router.post('/operations', validate(DecisionCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await createDecision('operations', req.body);
    res.status(201).json({ data, meta: meta() });
  } catch (error) { next(error); }
});

router.patch('/operations/:decisionId', validateParams(DecisionIdParam), validate(DecisionUpdateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decisionId } = req.params as z.infer<typeof DecisionIdParam>;
    const found = await updateDecision(decisionId, req.body);
    if (!found) return res.status(404).json({ error: { code: 'DECISION_NOT_FOUND', message: `Decision ${decisionId} not found`, trace_id: traceId(req) } });
    res.json({ data: { decisionId, title: req.body.title, updatedAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── GET /:decisionId/rationale ───
router.get('/:decisionId/rationale', validateParams(DecisionIdParam), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decisionId } = req.params as z.infer<typeof DecisionIdParam>;
    const { rows } = await db.query(
      `SELECT dr.rationale_summary, dr2.rationale_text, dr2.evidence_refs
         FROM decision_records dr
         LEFT JOIN decision_rationales dr2 ON dr2.decision_id = dr.id
        WHERE dr.id::text = $1 AND dr.is_deleted = FALSE
        LIMIT 1`,
      [decisionId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'DECISION_NOT_FOUND', message: `Decision ${decisionId} not found`, trace_id: traceId(req) } });
    }
    const r = rows[0];
    res.json({
      data: {
        decisionId,
        rationale: r.rationale_text || r.rationale_summary || '',
        evidenceRefs: r.evidence_refs ? (Array.isArray(r.evidence_refs) ? r.evidence_refs : []) : [],
        createdAt: new Date().toISOString(),
      },
      meta: meta(),
    });
  } catch (error) { next(error); }
});

// ─── POST /:decisionId/rationale ───
router.post('/:decisionId/rationale', validateParams(DecisionIdParam), validate(RationaleBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decisionId } = req.params as z.infer<typeof DecisionIdParam>;
    const { rationale, evidenceRefs } = req.body as z.infer<typeof RationaleBody>;

    const dr = await db.query(`SELECT id FROM decision_records WHERE id::text = $1 AND is_deleted = FALSE`, [decisionId]);
    if (Number(dr.rowCount || 0) === 0) {
      return res.status(404).json({ error: { code: 'DECISION_NOT_FOUND', message: `Decision ${decisionId} not found`, trace_id: traceId(req) } });
    }

    await db.query(
      `INSERT INTO decision_rationales (id, decision_id, rationale_text, evidence_refs)
       VALUES ($1, $2::uuid, $3, $4::jsonb)
       ON CONFLICT (decision_id) DO UPDATE SET rationale_text = $3, evidence_refs = $4::jsonb`,
      [crypto.randomUUID(), decisionId, rationale, JSON.stringify(evidenceRefs || [])],
    );

    await db.query(`UPDATE decision_records SET rationale_summary = $1, updated_at = NOW() WHERE id::text = $2`, [rationale.slice(0, 500), decisionId]);

    res.json({ data: { decisionId, rationale, updatedAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── GET /:decisionId/links ───
router.get('/:decisionId/links', validateParams(DecisionIdParam), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decisionId } = req.params as z.infer<typeof DecisionIdParam>;
    const { rows } = await db.query(
      `SELECT dd.id, dd.source_decision_id, dd.target_decision_id, dd.dependency_type
         FROM decision_dependencies dd
        WHERE dd.source_decision_id::text = $1 OR dd.target_decision_id::text = $1
        ORDER BY dd.created_at ASC`,
      [decisionId],
    );
    res.json({
      data: rows.map((r: any) => ({ linkId: r.id, sourceDecisionId: r.source_decision_id, targetDecisionId: r.target_decision_id, linkType: r.dependency_type || 'depends_on' })),
      meta: meta(),
    });
  } catch (error) { next(error); }
});

// ─── POST /:decisionId/links ───
router.post('/:decisionId/links', validateParams(DecisionIdParam), validate(LinkBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { decisionId } = req.params as z.infer<typeof DecisionIdParam>;
    const { targetDecisionId, linkType } = req.body as z.infer<typeof LinkBody>;
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO decision_dependencies (id, source_decision_id, target_decision_id, dependency_type)
       VALUES ($1, $2::uuid, $3::uuid, $4)`,
      [id, decisionId, targetDecisionId, linkType],
    );
    res.status(201).json({ data: { linkId: id, sourceDecisionId: decisionId, targetDecisionId, linkType }, meta: meta() });
  } catch (error) { next(error); }
});

export default router;
