import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { validate, validateParams, validateQuery } from '../../middleware/validate';

const router = Router();

const ID_PATTERN = /^[0-9a-fA-F-]{36}$/;
const idSchema = z.string().regex(ID_PATTERN, 'Invalid identifier format');

const BundleQuery = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  periodId: idSchema.optional(),
  scopeRef: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const BundleCreateBody = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  name: z.string().trim().min(1).max(200),
});

const BundleUpdateBody = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  status: z.enum(['draft', 'active', 'frozen', 'archived']).optional(),
});

const BundleApplyBody = z.object({
  scenarioId: idSchema,
  versionId: idSchema.optional(),
});

const ScopeReviewValidateBody = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  scopeBundleId: idSchema.optional(),
});

const DimensionQuery = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  periodId: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const ScopeReviewSummaryQuery = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  periodId: idSchema.optional(),
  scopeRef: z.string().optional(),
});

const BundleIdParam = z.object({ scopeBundleId: idSchema });

function traceId(req: Request): string {
  return (req.headers['x-trace-id'] as string) || 'no-trace-id';
}

function meta(extra?: Record<string, unknown>) {
  return {
    freshness: { source: 'database', timestamp: new Date().toISOString() },
    ...(extra || {}),
  };
}

// ─── GET /bundles ───
router.get('/bundles', validateQuery(BundleQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId, limit = 50, offset = 0 } = req.query as unknown as z.infer<typeof BundleQuery>;
    const params: unknown[] = [companyId, limit, offset];
    let where = 'sb.company_id::text = $1 AND sb.is_deleted = FALSE';
    if (scenarioId) {
      where += ` AND sb.scenario_id::text = $${params.length + 1}`;
      params.push(scenarioId);
    }

    const { rows } = await db.query(
      `SELECT sb.id, sb.name, sb.status::text,
              (SELECT COUNT(*)::int FROM scope_bundle_items sbi WHERE sbi.scope_bundle_id = sb.id) AS dimension_count
         FROM scope_bundles sb
        WHERE ${where}
        ORDER BY sb.created_at DESC
        LIMIT $2 OFFSET $3`,
      params,
    );

    res.json({
      data: rows.map((r: any) => ({
        scopeBundleId: r.id,
        name: r.name || 'Untitled',
        status: r.status,
        dimensionCount: r.dimension_count,
      })),
      meta: meta({ companyId }),
    });
  } catch (error) { next(error); }
});

// ─── POST /bundles ───
router.post('/bundles', validate(BundleCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId, versionId, name } = req.body as z.infer<typeof BundleCreateBody>;
    const id = crypto.randomUUID();
    await db.query(
      `INSERT INTO scope_bundles (id, company_id, scenario_id, version_id, name, status)
       VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5, 'draft')`,
      [id, companyId, scenarioId || null, versionId || null, name],
    );

    res.status(201).json({
      data: { scopeBundleId: id, name, status: 'draft', createdAt: new Date().toISOString() },
      meta: meta(),
    });
  } catch (error) { next(error); }
});

// ─── GET /bundles/:scopeBundleId ───
router.get('/bundles/:scopeBundleId', validateParams(BundleIdParam), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scopeBundleId } = req.params as z.infer<typeof BundleIdParam>;
    const { rows } = await db.query(
      `SELECT sb.id, sb.name, sb.status::text, sb.created_at, sb.updated_at
         FROM scope_bundles sb
        WHERE sb.id::text = $1 AND sb.is_deleted = FALSE`,
      [scopeBundleId],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: { code: 'SCOPE_BUNDLE_NOT_FOUND', message: `Scope bundle ${scopeBundleId} not found`, trace_id: traceId(req) } });
    }
    const items = await db.query(
      `SELECT sbi.id, sbi.dimension_family::text, sbi.node_type, sbi.node_id, sbi.grain_role
         FROM scope_bundle_items sbi
        WHERE sbi.scope_bundle_id::text = $1
        ORDER BY sbi.created_at ASC`,
      [scopeBundleId],
    );
    const bundle = rows[0];
    res.json({
      data: {
        scopeBundleId: bundle.id,
        name: bundle.name || 'Untitled',
        items: items.rows.map((i: any) => ({ itemId: i.id, dimensionFamily: i.dimension_family, nodeType: i.node_type, nodeId: i.node_id, grainRole: i.grain_role })),
        createdAt: bundle.created_at,
        updatedAt: bundle.updated_at,
      },
      meta: meta(),
    });
  } catch (error) { next(error); }
});

// ─── PATCH /bundles/:scopeBundleId ───
router.patch('/bundles/:scopeBundleId', validateParams(BundleIdParam), validate(BundleUpdateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scopeBundleId } = req.params as z.infer<typeof BundleIdParam>;
    const { name, status } = req.body as z.infer<typeof BundleUpdateBody>;
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    if (name !== undefined) { params.push(name); sets.push(`name = $${params.length}`); }
    if (status !== undefined) { params.push(status); sets.push(`status = $${params.length}::governance_status`); }
    params.push(scopeBundleId);

    const { rowCount } = await db.query(
      `UPDATE scope_bundles SET ${sets.join(', ')} WHERE id::text = $${params.length} AND is_deleted = FALSE`,
      params,
    );
    if (Number(rowCount || 0) === 0) {
      return res.status(404).json({ error: { code: 'SCOPE_BUNDLE_NOT_FOUND', message: `Scope bundle ${scopeBundleId} not found`, trace_id: traceId(req) } });
    }
    res.json({ data: { scopeBundleId, name, updatedAt: new Date().toISOString() }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── POST /bundles/:scopeBundleId/apply ───
router.post('/bundles/:scopeBundleId/apply', validateParams(BundleIdParam), validate(BundleApplyBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scopeBundleId } = req.params as z.infer<typeof BundleIdParam>;
    const { scenarioId, versionId } = req.body as z.infer<typeof BundleApplyBody>;

    const bundle = await db.query(`SELECT id FROM scope_bundles WHERE id::text = $1 AND is_deleted = FALSE`, [scopeBundleId]);
    if (Number(bundle.rowCount || 0) === 0) {
      return res.status(404).json({ error: { code: 'SCOPE_BUNDLE_NOT_FOUND', message: `Scope bundle ${scopeBundleId} not found`, trace_id: traceId(req) } });
    }

    await db.query(
      `UPDATE scope_bundles SET scenario_id = $1::uuid, version_id = $2::uuid, status = 'active', updated_at = NOW() WHERE id::text = $3`,
      [scenarioId, versionId || null, scopeBundleId],
    );

    const items = await db.query(`SELECT COUNT(*)::int AS cnt FROM scope_bundle_items WHERE scope_bundle_id::text = $1`, [scopeBundleId]);

    res.json({ data: { applied: true, affectedEntities: items.rows[0]?.cnt || 0 }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── Dimension listing helpers ───
async function listDimensionNodes(tableName: string, companyId: string, limit: number, offset: number, extraColumns: string[] = []) {
  const cols = ['id', 'name', 'parent_id', 'level_depth', ...extraColumns];
  const select = cols.map(c => `t.${c}`).join(', ');
  const { rows } = await db.query(
    `SELECT ${select} FROM ${tableName} t WHERE t.company_id::text = $1 ORDER BY t.name ASC LIMIT $2 OFFSET $3`,
    [companyId, limit, offset],
  );
  return rows;
}

// ─── GET /formats ───
router.get('/formats', validateQuery(DimensionQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, limit = 100, offset = 0 } = req.query as unknown as z.infer<typeof DimensionQuery>;
    const rows = await listDimensionNodes('format_taxonomy_nodes', companyId, limit, offset);
    res.json({ data: rows.map((r: any) => ({ nodeId: r.id, name: r.name, parentId: r.parent_id, level: r.level_depth || 0 })), meta: meta({ companyId }) });
  } catch (error) { next(error); }
});

// ─── GET /categories ───
router.get('/categories', validateQuery(DimensionQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, limit = 100, offset = 0 } = req.query as unknown as z.infer<typeof DimensionQuery>;
    const rows = await listDimensionNodes('category_taxonomy_nodes', companyId, limit, offset);
    res.json({ data: rows.map((r: any) => ({ nodeId: r.id, name: r.name, parentId: r.parent_id, level: r.level_depth || 0 })), meta: meta({ companyId }) });
  } catch (error) { next(error); }
});

// ─── GET /portfolio-nodes ───
router.get('/portfolio-nodes', validateQuery(DimensionQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, limit = 100, offset = 0 } = req.query as unknown as z.infer<typeof DimensionQuery>;
    const rows = await listDimensionNodes('portfolio_nodes', companyId, limit, offset, ['node_type']);
    res.json({ data: rows.map((r: any) => ({ nodeId: r.id, name: r.name, parentId: r.parent_id, level: r.level_depth || 0, nodeType: r.node_type })), meta: meta({ companyId }) });
  } catch (error) { next(error); }
});

// ─── GET /channels ───
router.get('/channels', validateQuery(DimensionQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, limit = 100, offset = 0 } = req.query as unknown as z.infer<typeof DimensionQuery>;
    const { rows } = await db.query(
      `SELECT id, name, taxonomy_family AS channel_type FROM channel_taxonomy_nodes WHERE company_id::text = $1 ORDER BY name ASC LIMIT $2 OFFSET $3`,
      [companyId, limit, offset],
    );
    res.json({ data: rows.map((r: any) => ({ nodeId: r.id, name: r.name, channelType: r.channel_type || 'general' })), meta: meta({ companyId }) });
  } catch (error) { next(error); }
});

// ─── GET /operating-models ───
router.get('/operating-models', validateQuery(DimensionQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, limit = 100, offset = 0 } = req.query as unknown as z.infer<typeof DimensionQuery>;
    const { rows } = await db.query(
      `SELECT id, name, taxonomy_family AS model_type FROM operating_model_nodes WHERE company_id::text = $1 ORDER BY name ASC LIMIT $2 OFFSET $3`,
      [companyId, limit, offset],
    );
    res.json({ data: rows.map((r: any) => ({ nodeId: r.id, name: r.name, modelType: r.model_type || 'standard' })), meta: meta({ companyId }) });
  } catch (error) { next(error); }
});

// ─── GET /geographies ───
router.get('/geographies', validateQuery(DimensionQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, limit = 100, offset = 0 } = req.query as unknown as z.infer<typeof DimensionQuery>;
    const rows = await listDimensionNodes('geography_nodes', companyId, limit, offset, ['iso_code']);
    res.json({ data: rows.map((r: any) => ({ nodeId: r.id, name: r.name, parentId: r.parent_id, level: r.level_depth || 0, isoCode: r.iso_code || '' })), meta: meta({ companyId }) });
  } catch (error) { next(error); }
});

// ─── POST /review/validate ───
router.post('/review/validate', validate(ScopeReviewValidateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scopeBundleId } = req.body as z.infer<typeof ScopeReviewValidateBody>;
    const issues: Array<{ code: string; message: string; severity: string }> = [];

    if (scopeBundleId) {
      const bundle = await db.query(`SELECT id FROM scope_bundles WHERE id::text = $1 AND company_id::text = $2 AND is_deleted = FALSE`, [scopeBundleId, companyId]);
      if (Number(bundle.rowCount || 0) === 0) {
        issues.push({ code: 'BUNDLE_NOT_FOUND', message: 'Scope bundle not found or not owned by company', severity: 'error' });
      } else {
        const items = await db.query(`SELECT COUNT(*)::int AS cnt FROM scope_bundle_items WHERE scope_bundle_id::text = $1`, [scopeBundleId]);
        if ((items.rows[0]?.cnt || 0) === 0) {
          issues.push({ code: 'EMPTY_BUNDLE', message: 'Scope bundle has no dimension items', severity: 'warning' });
        }
      }
    }

    res.json({ data: { valid: issues.filter(i => i.severity === 'error').length === 0, issues }, meta: meta() });
  } catch (error) { next(error); }
});

// ─── GET /review/summary ───
router.get('/review/summary', validateQuery(ScopeReviewSummaryQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.query as unknown as z.infer<typeof ScopeReviewSummaryQuery>;
    const bundles = await db.query(
      `SELECT COUNT(*)::int AS total FROM scope_bundles WHERE company_id::text = $1 AND is_deleted = FALSE`,
      [companyId],
    );
    const items = await db.query(
      `SELECT sbi.dimension_family::text, COUNT(*)::int AS cnt
         FROM scope_bundle_items sbi
         JOIN scope_bundles sb ON sbi.scope_bundle_id = sb.id
        WHERE sb.company_id::text = $1 AND sb.is_deleted = FALSE
        GROUP BY sbi.dimension_family`,
      [companyId],
    );

    const dimensionBreakdown: Record<string, number> = {};
    let includedNodes = 0;
    for (const row of items.rows as Array<{ dimension_family: string; cnt: number }>) {
      dimensionBreakdown[row.dimension_family || 'unknown'] = row.cnt;
      includedNodes += row.cnt;
    }

    res.json({
      data: {
        totalNodes: includedNodes,
        includedNodes,
        excludedNodes: 0,
        dimensionBreakdown,
        warnings: [],
      },
      meta: meta({ companyId }),
    });
  } catch (error) { next(error); }
});

export default router;
