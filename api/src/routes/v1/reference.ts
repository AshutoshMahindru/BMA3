import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { validateQuery } from '../../middleware/validate';
import {
  idSchema,
  meta,
  requestCompanyId,
  requestTenantId,
} from './_shared';

const router = Router();

const ReferenceQuery = z.object({
  companyId: idSchema.optional(),
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const TAXONOMY_TABLES = new Set([
  'geography_nodes',
  'format_taxonomy_nodes',
  'category_taxonomy_nodes',
  'portfolio_nodes',
  'channel_taxonomy_nodes',
  'operating_model_nodes',
]);

type ReferenceQueryValue = z.infer<typeof ReferenceQuery>;

async function resolveReferenceCompanyId(req: Request, fallbackCompanyId?: string): Promise<string | null> {
  const explicitCompanyId = requestCompanyId(req, fallbackCompanyId);
  if (explicitCompanyId) {
    return explicitCompanyId;
  }

  const tenantId = requestTenantId(req);
  if (!tenantId) {
    return null;
  }

  const firstCompany = await db.query(
    `SELECT id
       FROM companies
      WHERE tenant_id::text = $1
        AND is_deleted = FALSE
      ORDER BY created_at ASC
      LIMIT 1`,
    [tenantId],
  );

  return firstCompany.rows[0]?.id ? String(firstCompany.rows[0].id) : null;
}

function searchPattern(search?: string): string | null {
  return search ? `%${search}%` : null;
}

async function listHierarchyNodes(
  tableName: string,
  companyId: string,
  search: string | undefined,
  limit: number,
  offset: number,
) {
  if (!TAXONOMY_TABLES.has(tableName)) {
    throw new Error(`Unsupported reference taxonomy table: ${tableName}`);
  }

  const query = `
    WITH RECURSIVE tree AS (
      SELECT
        t.node_id,
        t.parent_node_id,
        t.label,
        t.code,
        0::int AS level
      FROM ${tableName} t
      WHERE t.company_id::text = $1
        AND t.parent_node_id IS NULL
        AND t.status = 'active'

      UNION ALL

      SELECT
        child.node_id,
        child.parent_node_id,
        child.label,
        child.code,
        tree.level + 1
      FROM ${tableName} child
      INNER JOIN tree ON tree.node_id = child.parent_node_id
      WHERE child.company_id::text = $1
        AND child.status = 'active'
    )
    SELECT
      tree.node_id,
      tree.parent_node_id,
      tree.label,
      tree.code,
      tree.level
    FROM tree
    WHERE (
      $2::text IS NULL
      OR tree.label ILIKE $2
      OR tree.code ILIKE $2
    )
    ORDER BY tree.level ASC, tree.label ASC
    LIMIT $3 OFFSET $4
  `;

  const { rows } = await db.query(query, [companyId, searchPattern(search), limit, offset]);
  return rows;
}

async function handleTaxonomyList(
  req: Request,
  res: Response,
  next: NextFunction,
  options: {
    tableName: string;
    mapRow: (row: any) => Record<string, unknown>;
  },
) {
  try {
    const { companyId, search, limit = 50, offset = 0 } = req.query as unknown as ReferenceQueryValue;
    const resolvedCompanyId = await resolveReferenceCompanyId(req, companyId);

    if (!resolvedCompanyId) {
      return res.json({ data: [], meta: meta() });
    }

    const rows = await listHierarchyNodes(
      options.tableName,
      resolvedCompanyId,
      search,
      limit,
      offset,
    );

    res.json({
      data: rows.map(options.mapRow),
      meta: meta({ companyId: resolvedCompanyId }),
    });
  } catch (error) {
    next(error);
  }
}

router.get('/geographies', validateQuery(ReferenceQuery), async (req: Request, res: Response, next: NextFunction) => {
  await handleTaxonomyList(req, res, next, {
    tableName: 'geography_nodes',
    mapRow: (row) => ({
      nodeId: row.node_id,
      name: row.label,
      parentId: row.parent_node_id,
      level: Number(row.level || 0),
      isoCode: row.code || '',
    }),
  });
});

router.get('/formats', validateQuery(ReferenceQuery), async (req: Request, res: Response, next: NextFunction) => {
  await handleTaxonomyList(req, res, next, {
    tableName: 'format_taxonomy_nodes',
    mapRow: (row) => ({
      nodeId: row.node_id,
      name: row.label,
      parentId: row.parent_node_id,
      level: Number(row.level || 0),
    }),
  });
});

router.get('/categories', validateQuery(ReferenceQuery), async (req: Request, res: Response, next: NextFunction) => {
  await handleTaxonomyList(req, res, next, {
    tableName: 'category_taxonomy_nodes',
    mapRow: (row) => ({
      nodeId: row.node_id,
      name: row.label,
      parentId: row.parent_node_id,
      level: Number(row.level || 0),
    }),
  });
});

router.get('/portfolio-hierarchy', validateQuery(ReferenceQuery), async (req: Request, res: Response, next: NextFunction) => {
  await handleTaxonomyList(req, res, next, {
    tableName: 'portfolio_nodes',
    mapRow: (row) => ({
      nodeId: row.node_id,
      name: row.label,
      parentId: row.parent_node_id,
      level: Number(row.level || 0),
      nodeType: 'portfolio',
    }),
  });
});

router.get('/channels', validateQuery(ReferenceQuery), async (req: Request, res: Response, next: NextFunction) => {
  await handleTaxonomyList(req, res, next, {
    tableName: 'channel_taxonomy_nodes',
    mapRow: (row) => ({
      nodeId: row.node_id,
      name: row.label,
      channelType: row.code || 'channel',
    }),
  });
});

router.get('/operating-models', validateQuery(ReferenceQuery), async (req: Request, res: Response, next: NextFunction) => {
  await handleTaxonomyList(req, res, next, {
    tableName: 'operating_model_nodes',
    mapRow: (row) => ({
      nodeId: row.node_id,
      name: row.label,
      modelType: row.code || 'operating_model',
    }),
  });
});

router.get('/platforms', validateQuery(ReferenceQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, search, limit = 50, offset = 0 } = req.query as unknown as ReferenceQueryValue;
    const resolvedCompanyId = await resolveReferenceCompanyId(req, companyId);

    if (!resolvedCompanyId) {
      return res.json({ data: [], meta: meta() });
    }

    const { rows } = await db.query(
      `SELECT id, name
         FROM platforms
        WHERE company_id::text = $1
          AND is_deleted = FALSE
          AND ($2::text IS NULL OR name ILIKE $2 OR platform_type::text ILIKE $2)
        ORDER BY name ASC
        LIMIT $3 OFFSET $4`,
      [resolvedCompanyId, searchPattern(search), limit, offset],
    );

    res.json({
      data: rows.map((row: any) => ({
        platformId: row.id,
        name: row.name,
        status: 'active',
      })),
      meta: meta({ companyId: resolvedCompanyId }),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/product-families', validateQuery(ReferenceQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, search, limit = 50, offset = 0 } = req.query as unknown as ReferenceQueryValue;
    const resolvedCompanyId = await resolveReferenceCompanyId(req, companyId);

    if (!resolvedCompanyId) {
      return res.json({ data: [], meta: meta() });
    }

    const { rows } = await db.query(
      `SELECT id, name
         FROM product_families
        WHERE company_id::text = $1
          AND is_deleted = FALSE
          AND ($2::text IS NULL OR name ILIKE $2 OR family_type::text ILIKE $2)
        ORDER BY name ASC
        LIMIT $3 OFFSET $4`,
      [resolvedCompanyId, searchPattern(search), limit, offset],
    );

    res.json({
      data: rows.map((row: any) => ({
        familyId: row.id,
        name: row.name,
        parentId: null,
        level: 0,
      })),
      meta: meta({ companyId: resolvedCompanyId }),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
