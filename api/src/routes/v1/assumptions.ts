import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import { idSchema, requireTenantId, requestCompanyId, stableUuidFromText } from './_shared';

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

type FamilyRouteKey = 'demand' | 'cost' | 'funding' | 'working-capital';
type PackFamily = 'market' | 'product' | 'operations' | 'funding';

type ResolvedAssumptionContext = {
  tenantId: string;
  companyId: string;
  scenarioId?: string;
  versionId?: string;
  assumptionSetId?: string | null;
};

const VARIABLE_SPECS: Record<string, {
  familyKey: FamilyRouteKey;
  packFamily: PackFamily;
  label: string;
  unit: string;
}> = {
  gross_demand: { familyKey: 'demand', packFamily: 'market', label: 'Gross Demand', unit: 'count' },
  reach_rate: { familyKey: 'demand', packFamily: 'market', label: 'Reach Rate', unit: 'percentage' },
  conversion_rate: { familyKey: 'demand', packFamily: 'market', label: 'Conversion Rate', unit: 'percentage' },
  retention_rate: { familyKey: 'demand', packFamily: 'market', label: 'Retention Rate', unit: 'percentage' },
  average_order_value: { familyKey: 'demand', packFamily: 'market', label: 'Average Order Value', unit: 'currency' },
  discount_rate: { familyKey: 'demand', packFamily: 'market', label: 'Discount Rate', unit: 'percentage' },
  refund_rate: { familyKey: 'demand', packFamily: 'market', label: 'Refund Rate', unit: 'percentage' },
  channel_fee_rate: { familyKey: 'demand', packFamily: 'market', label: 'Channel Fee Rate', unit: 'percentage' },
  cogs_per_unit: { familyKey: 'cost', packFamily: 'product', label: 'COGS per Unit', unit: 'currency' },
  variable_marketing_promo: { familyKey: 'cost', packFamily: 'operations', label: 'Variable Marketing Promo', unit: 'currency' },
  variable_labor_fulfillment: { familyKey: 'cost', packFamily: 'operations', label: 'Variable Labor Fulfillment', unit: 'currency' },
  site_controllable_opex: { familyKey: 'cost', packFamily: 'operations', label: 'Site Controllable Opex', unit: 'currency' },
  fixed_site_costs: { familyKey: 'cost', packFamily: 'operations', label: 'Fixed Site Costs', unit: 'currency' },
  shared_operating_allocations: { familyKey: 'cost', packFamily: 'operations', label: 'Shared Operating Allocations', unit: 'currency' },
  capex_launch: { familyKey: 'cost', packFamily: 'operations', label: 'Capex Launch', unit: 'currency' },
  capex_maintenance: { familyKey: 'cost', packFamily: 'operations', label: 'Capex Maintenance', unit: 'currency' },
  capex_scaleup: { familyKey: 'cost', packFamily: 'operations', label: 'Capex Scale-Up', unit: 'currency' },
  depreciation: { familyKey: 'cost', packFamily: 'operations', label: 'Depreciation', unit: 'currency' },
  amortization: { familyKey: 'cost', packFamily: 'operations', label: 'Amortization', unit: 'currency' },
  minimum_cash_buffer: { familyKey: 'funding', packFamily: 'funding', label: 'Minimum Cash Buffer', unit: 'currency' },
  tax_rate: { familyKey: 'funding', packFamily: 'funding', label: 'Tax Rate', unit: 'percentage' },
  interest_rate: { familyKey: 'funding', packFamily: 'funding', label: 'Interest Rate', unit: 'percentage' },
  equity_inflows: { familyKey: 'funding', packFamily: 'funding', label: 'Equity Inflows', unit: 'currency' },
  debt_drawdowns: { familyKey: 'funding', packFamily: 'funding', label: 'Debt Drawdowns', unit: 'currency' },
  debt_repayments: { familyKey: 'funding', packFamily: 'funding', label: 'Debt Repayments', unit: 'currency' },
  debt_outstanding: { familyKey: 'funding', packFamily: 'funding', label: 'Debt Outstanding', unit: 'currency' },
  hurdle_rate: { familyKey: 'funding', packFamily: 'funding', label: 'Hurdle Rate', unit: 'percentage' },
  receivables_days: { familyKey: 'working-capital', packFamily: 'operations', label: 'Receivables Days', unit: 'days' },
  payables_days: { familyKey: 'working-capital', packFamily: 'operations', label: 'Payables Days', unit: 'days' },
  inventory_days: { familyKey: 'working-capital', packFamily: 'operations', label: 'Inventory Days', unit: 'days' },
};

const FAMILY_VARIABLES: Record<FamilyRouteKey, string[]> = {
  demand: Object.entries(VARIABLE_SPECS).filter(([, spec]) => spec.familyKey === 'demand').map(([name]) => name),
  cost: Object.entries(VARIABLE_SPECS).filter(([, spec]) => spec.familyKey === 'cost').map(([name]) => name),
  funding: Object.entries(VARIABLE_SPECS).filter(([, spec]) => spec.familyKey === 'funding').map(([name]) => name),
  'working-capital': Object.entries(VARIABLE_SPECS).filter(([, spec]) => spec.familyKey === 'working-capital').map(([name]) => name),
};

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(numeric) ? numeric : null;
}

function periodIdFromGrainSignature(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '';
  }
  const record = value as Record<string, unknown>;
  return typeof record.period_id === 'string' ? record.period_id : '';
}

function asJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizePackCategory(value?: string | null): 'demand' | 'cost' | 'funding' | 'working_capital' | undefined {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  switch (normalized) {
    case 'demand':
    case 'market':
      return 'demand';
    case 'cost':
    case 'operations':
    case 'product':
    case 'capacity':
      return 'cost';
    case 'funding':
      return 'funding';
    case 'working_capital':
    case 'workingcapital':
      return 'working_capital';
    default:
      return undefined;
  }
}

function derivePackCategory(row: any): string {
  const metadata = asJsonObject(row?.metadata);
  const fromMetadata = normalizePackCategory(typeof metadata.uiCategory === 'string' ? metadata.uiCategory : undefined);
  if (fromMetadata) {
    return fromMetadata;
  }

  const variableNames = Array.isArray(row?.variable_names)
    ? row.variable_names.filter((value: unknown): value is string => typeof value === 'string')
    : [];
  if (variableNames.length > 0 && variableNames.every((name: string) => VARIABLE_SPECS[name]?.familyKey === 'working-capital')) {
    return 'working_capital';
  }

  const family = String(row?.assumption_family || row?.family || '').trim().toLowerCase();
  switch (family) {
    case 'market':
      return 'demand';
    case 'funding':
      return 'funding';
    default:
      return 'cost';
  }
}

function packFamilyForCategory(category?: string | null): PackFamily {
  switch (normalizePackCategory(category)) {
    case 'demand':
      return 'market';
    case 'funding':
      return 'funding';
    default:
      return 'operations';
  }
}

function packNameForCategory(category?: string | null): string {
  const normalized = normalizePackCategory(category) || 'cost';
  switch (normalized) {
    case 'demand':
      return 'Demand assumptions';
    case 'funding':
      return 'Funding assumptions';
    case 'working_capital':
      return 'Working capital assumptions';
    default:
      return 'Cost assumptions';
  }
}

async function inferSingleCompanyId(req: Request): Promise<string | null> {
  const tenantId = requireTenantId(req);
  const result = await db.query(
    `SELECT id
       FROM companies
      WHERE tenant_id::text = $1
        AND is_deleted = FALSE
      ORDER BY created_at ASC
      LIMIT 2`,
    [tenantId],
  );

  return Number(result.rowCount || 0) === 1 ? String(result.rows[0].id) : null;
}

async function resolveAssumptionContext(
  req: Request,
  ctx: ReturnType<typeof planningContext>,
): Promise<ResolvedAssumptionContext | null> {
  const tenantId = requireTenantId(req);
  let companyId = requestCompanyId(req, ctx.companyId);
  let scenarioId = ctx.scenarioId;
  let versionId = ctx.versionId;
  let assumptionSetId: string | null | undefined = undefined;

  if (versionId) {
    const version = await db.query(
      `SELECT pv.company_id, pv.scenario_id, pv.assumption_set_id
         FROM plan_versions pv
         JOIN companies c ON c.id = pv.company_id
        WHERE pv.id::text = $1
          AND c.tenant_id::text = $2
          AND pv.is_deleted = FALSE
          AND c.is_deleted = FALSE`,
      [versionId, tenantId],
    );
    if (Number(version.rowCount || 0) > 0) {
      companyId = String(version.rows[0].company_id);
      scenarioId = String(version.rows[0].scenario_id);
      assumptionSetId = version.rows[0].assumption_set_id ? String(version.rows[0].assumption_set_id) : null;
    }
  }

  if (!companyId && scenarioId) {
    const scenario = await db.query(
      `SELECT s.company_id
         FROM scenarios s
         JOIN companies c ON c.id = s.company_id
        WHERE s.id::text = $1
          AND c.tenant_id::text = $2
          AND s.is_deleted = FALSE
          AND c.is_deleted = FALSE`,
      [scenarioId, tenantId],
    );
    if (Number(scenario.rowCount || 0) > 0) {
      companyId = String(scenario.rows[0].company_id);
    }
  }

  if (!companyId) {
    companyId = await inferSingleCompanyId(req) || undefined;
  }

  if (!companyId) {
    return null;
  }

  if (!assumptionSetId && scenarioId) {
    const params: Array<string> = [companyId, scenarioId];
    let versionClause = '';
    if (versionId) {
      params.push(versionId);
      versionClause = `
        AND (
          aset.version_id::text = $3
          OR EXISTS (
            SELECT 1
              FROM plan_versions pv
             WHERE pv.assumption_set_id = aset.id
               AND pv.id::text = $3
               AND pv.is_deleted = FALSE
          )
        )`;
    }

    const assumptionSet = await db.query(
      `SELECT aset.id
         FROM assumption_sets aset
         JOIN scenarios s ON s.id = aset.scenario_id
        WHERE s.company_id::text = $1
          AND s.id::text = $2
          AND aset.is_deleted = FALSE
          AND s.is_deleted = FALSE
          ${versionClause}
        ORDER BY aset.updated_at DESC, aset.created_at DESC
        LIMIT 1`,
      params,
    );
    if (Number(assumptionSet.rowCount || 0) > 0) {
      assumptionSetId = String(assumptionSet.rows[0].id);
    }
  }

  return {
    tenantId,
    companyId,
    ...(scenarioId ? { scenarioId } : {}),
    ...(versionId ? { versionId } : {}),
    ...(assumptionSetId !== undefined ? { assumptionSetId } : {}),
  };
}

async function ensureAssumptionSet(context: ResolvedAssumptionContext): Promise<string | null> {
  if (context.assumptionSetId) {
    return context.assumptionSetId;
  }
  if (!context.scenarioId) {
    return null;
  }

  const scenario = await db.query(
    `SELECT s.name
       FROM scenarios s
      WHERE s.id::text = $1
        AND s.company_id::text = $2
        AND s.is_deleted = FALSE`,
    [context.scenarioId, context.companyId],
  );
  if (Number(scenario.rowCount || 0) === 0) {
    return null;
  }

  const created = await db.query(
    `INSERT INTO assumption_sets (
        tenant_id,
        scenario_id,
        company_id,
        version_id,
        name,
        is_active,
        overall_confidence,
        review_cadence,
        status,
        confidence_state
      )
      VALUES ($1, $2, $3, $4, $5, TRUE, 'medium', 'Monthly', 'draft', 'medium')
      RETURNING id`,
    [
      context.tenantId,
      context.scenarioId,
      context.companyId,
      context.versionId || null,
      `${scenario.rows[0].name || 'Scenario'} assumptions`,
    ],
  );

  context.assumptionSetId = String(created.rows[0].id);
  return context.assumptionSetId;
}

async function ensurePackBinding(packId: string, assumptionSetId: string, scopeBundleId?: string) {
  const existing = await db.query(
    `SELECT id, scope_bundle_id
       FROM assumption_pack_bindings
      WHERE pack_id = $1
        AND assumption_set_id = $2
      ORDER BY applied_at DESC
      LIMIT 1`,
    [packId, assumptionSetId],
  );

    if (Number(existing.rowCount || 0) > 0) {
      if (scopeBundleId && String(existing.rows[0].scope_bundle_id || '') !== scopeBundleId) {
        await db.query(
          `UPDATE assumption_pack_bindings
            SET scope_bundle_id = $2
          WHERE id = $1`,
          [existing.rows[0].id, scopeBundleId],
        );
      }
      return;
  }

  await db.query(
    `INSERT INTO assumption_pack_bindings (pack_id, assumption_set_id, scope_bundle_id)
     VALUES ($1, $2, $3)`,
    [packId, assumptionSetId, scopeBundleId || null],
  );
}

async function ensurePackForFamily(
  context: ResolvedAssumptionContext,
  assumptionSetId: string,
  packFamily: PackFamily,
  categoryLabel: string,
): Promise<string> {
  const existing = await db.query(
    `SELECT ap.id
       FROM assumption_packs ap
      WHERE ap.company_id::text = $1
        AND ap.is_deleted = FALSE
        AND COALESCE(ap.assumption_family::text, ap.family::text) = $2
        AND (
          ap.assumption_set_id = $3
          OR EXISTS (
            SELECT 1
              FROM assumption_pack_bindings apb
             WHERE apb.pack_id = ap.id
               AND apb.assumption_set_id = $3
          )
        )
      ORDER BY ap.updated_at DESC, ap.created_at DESC
      LIMIT 1`,
    [context.companyId, packFamily, assumptionSetId],
  );

  if (Number(existing.rowCount || 0) > 0) {
    await ensurePackBinding(String(existing.rows[0].id), assumptionSetId);
    return String(existing.rows[0].id);
  }

  const packName = packNameForCategory(categoryLabel);
  const created = await db.query(
    `INSERT INTO assumption_packs (
        company_id,
        family,
        name,
        status,
        source_type,
        is_deleted,
        assumption_set_id,
        assumption_family,
        pack_name,
        description,
        metadata
      )
      VALUES (
        $1,
        $2::assumption_family,
        $3,
        'draft'::governance_status,
        'scenario_specific'::assumption_source_type,
        FALSE,
        $4,
        $2::assumption_family,
        $3,
        $5,
        $6::jsonb
      )
      RETURNING id`,
    [
      context.companyId,
      packFamily,
      packName,
      assumptionSetId,
      `Auto-created ${packName.toLowerCase()} pack for the active assumption set.`,
      JSON.stringify({ uiCategory: normalizePackCategory(categoryLabel) || 'cost' }),
    ],
  );

  const packId = String(created.rows[0].id);
  await ensurePackBinding(packId, assumptionSetId);
  return packId;
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

router.get('/packs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = await resolveAssumptionContext(req, planningContext(req.query));
    if (!context?.companyId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId, scenarioId, or versionId is required', trace_id: traceId(req) },
      });
    }

    const { limit, offset } = paginate(req.query);
    const params: any[] = [context.companyId];
    let filter = '';
    if (context.assumptionSetId) {
      params.push(context.assumptionSetId);
      filter = `
        AND (
          ap.assumption_set_id = $2
          OR EXISTS (
            SELECT 1
              FROM assumption_pack_bindings apb
             WHERE apb.pack_id = ap.id
               AND apb.assumption_set_id = $2
          )
        )`;
    }

    params.push(limit, offset);
    const limitRef = context.assumptionSetId ? '$3' : '$2';
    const offsetRef = context.assumptionSetId ? '$4' : '$3';

    const { rows } = await db.query(
      `SELECT ap.id,
              COALESCE(ap.pack_name, ap.name) AS pack_name,
              COALESCE(ap.assumption_family::text, ap.family::text) AS assumption_family,
              ap.metadata,
              COUNT(afb.id)::int AS field_count,
              array_remove(array_agg(DISTINCT afb.variable_name), NULL) AS variable_names
         FROM assumption_packs ap
         LEFT JOIN assumption_field_bindings afb
           ON afb.pack_id = ap.id
        WHERE ap.company_id::text = $1
          AND ap.is_deleted = FALSE
          ${filter}
        GROUP BY ap.id, COALESCE(ap.pack_name, ap.name), COALESCE(ap.assumption_family::text, ap.family::text), ap.metadata, ap.updated_at, ap.created_at
        ORDER BY ap.updated_at DESC, ap.created_at DESC
        LIMIT ${limitRef} OFFSET ${offsetRef}`,
      params,
    );

    res.json({
      data: rows.map((row: any) => ({
        packId: row.id,
        name: row.pack_name || 'Untitled pack',
        category: derivePackCategory(row),
        fieldCount: Number(row.field_count || 0),
      })),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/packs', validate(AssumptionPackCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = await resolveAssumptionContext(req, planningContext(req.query));
    const companyId = context?.companyId || await inferSingleCompanyId(req);
    if (!companyId) {
      return res.status(400).json({
        error: { code: 'MISSING_COMPANY_CONTEXT', message: 'Company context is required to create an assumption pack', trace_id: traceId(req) },
      });
    }

    const category = normalizePackCategory(req.body.category)
      || normalizePackCategory(VARIABLE_SPECS[req.body.fields[0]?.variableName]?.familyKey)
      || 'cost';
    const packFamily = packFamilyForCategory(category);
    const created = await db.query(
      `INSERT INTO assumption_packs (
          company_id,
          family,
          name,
          status,
          source_type,
          is_deleted,
          assumption_set_id,
          assumption_family,
          pack_name,
          description,
          metadata
        )
        VALUES (
          $1,
          $2::assumption_family,
          $3,
          'draft'::governance_status,
          'scenario_specific'::assumption_source_type,
          FALSE,
          $4,
          $2::assumption_family,
          $3,
          $5,
          $6::jsonb
        )
        RETURNING id, created_at`,
      [
        companyId,
        packFamily,
        req.body.name,
        context?.assumptionSetId || null,
        req.body.description || null,
        JSON.stringify({ uiCategory: category }),
      ],
    );

    const packId = String(created.rows[0].id);
    if (context?.assumptionSetId) {
      await ensurePackBinding(packId, context.assumptionSetId);
    }

    for (const field of req.body.fields) {
      const numericValue = finiteNumber(field.value);
      if (numericValue === null) {
        continue;
      }
      await db.query(
        `INSERT INTO assumption_field_bindings (
            pack_id,
            variable_name,
            grain_signature,
            value,
            unit,
            is_override
          )
          VALUES ($1, $2, $3::jsonb, $4, $5, TRUE)
          ON CONFLICT (pack_id, variable_name, grain_signature) DO UPDATE
            SET value = EXCLUDED.value,
                unit = EXCLUDED.unit,
                is_override = TRUE,
                updated_at = NOW()`,
        [
          packId,
          field.variableName,
          JSON.stringify(field.grainSignature || {}),
          numericValue,
          field.unit || VARIABLE_SPECS[field.variableName]?.unit || null,
        ],
      );
    }

    res.status(201).json({
      data: {
        packId,
        name: req.body.name,
        createdAt: created.rows[0].created_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/packs/:packId/apply', validate(ApplyPackBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { packId } = req.params;
    const { targetSetId, scopeBundleId } = req.body;
    const tenantId = requireTenantId(req);

    const pack = await db.query(
      `SELECT ap.id,
              COUNT(afb.id)::int AS field_count
         FROM assumption_packs ap
         LEFT JOIN assumption_field_bindings afb
           ON afb.pack_id = ap.id
         JOIN assumption_sets aset
           ON aset.id::text = $2
         JOIN scenarios s
           ON s.id = aset.scenario_id
         JOIN companies c
           ON c.id = s.company_id
        WHERE ap.id::text = $1
          AND ap.company_id = s.company_id
          AND c.tenant_id::text = $3
          AND ap.is_deleted = FALSE
          AND aset.is_deleted = FALSE
          AND s.is_deleted = FALSE
          AND c.is_deleted = FALSE
        GROUP BY ap.id`,
      [packId, targetSetId, tenantId],
    );

    if (Number(pack.rowCount || 0) === 0) {
      return res.status(404).json({
        error: { code: 'ASSUMPTION_PACK_NOT_FOUND', message: `Assumption pack ${packId} not found`, trace_id: traceId(req) },
      });
    }

    await ensurePackBinding(packId, targetSetId, scopeBundleId);

    res.json({
      data: {
        applied: true,
        fieldsApplied: Number(pack.rows[0].field_count || 0),
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

function registerFamilyRoutes(path: FamilyRouteKey) {
  router.get(`/${path}`, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await resolveAssumptionContext(req, planningContext(req.query));
      if (!context?.companyId) {
        return res.status(400).json({
          error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId, scenarioId, or versionId is required', trace_id: traceId(req) },
        });
      }

      if (!context.assumptionSetId) {
        return res.json({ data: [], meta: meta() });
      }

      const { rows } = await db.query(
        `SELECT DISTINCT ON (afb.variable_name, COALESCE(afb.grain_signature->>'period_id', ''))
                afb.id,
                afb.variable_name,
                afb.value,
                afb.unit,
                afb.grain_signature,
                COALESCE(ap.pack_name, ap.name) AS pack_name
           FROM assumption_field_bindings afb
           JOIN assumption_packs ap
             ON ap.id = afb.pack_id
          WHERE ap.company_id::text = $1
            AND ap.is_deleted = FALSE
            AND afb.variable_name = ANY($2)
            AND (
              ap.assumption_set_id = $3
              OR EXISTS (
                SELECT 1
                  FROM assumption_pack_bindings apb
                 WHERE apb.pack_id = ap.id
                   AND apb.assumption_set_id = $3
              )
            )
          ORDER BY afb.variable_name,
                   COALESCE(afb.grain_signature->>'period_id', ''),
                   afb.is_override DESC,
                   afb.updated_at DESC,
                   afb.created_at DESC`,
        [context.companyId, FAMILY_VARIABLES[path], context.assumptionSetId],
      );

      res.json({
        data: rows.map((row: any) => ({
          fieldId: row.id,
          name: VARIABLE_SPECS[row.variable_name]?.label || row.variable_name,
          value: finiteNumber(row.value) ?? 0,
          unit: row.unit || VARIABLE_SPECS[row.variable_name]?.unit || '',
          periodId: periodIdFromGrainSignature(row.grain_signature),
          confidence: 'medium',
          source: row.pack_name || 'Assumption pack',
          variableName: row.variable_name,
          grainSignature: asJsonObject(row.grain_signature),
        })),
        meta: meta(),
      });
    } catch (error) {
      next(error);
    }
  });

  router.put(`/${path}/bulk`, validate(BulkUpdateBody), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await resolveAssumptionContext(req, planningContext(req.body));
      if (!context?.companyId || !context.scenarioId) {
        return res.status(400).json({
          error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId and scenarioId are required', trace_id: traceId(req) },
        });
      }

      const assumptionSetId = await ensureAssumptionSet(context);
      if (!assumptionSetId) {
        return res.status(404).json({
          error: { code: 'ASSUMPTION_SET_NOT_FOUND', message: 'No active assumption set exists for the requested context', trace_id: traceId(req) },
        });
      }

      const fieldIds = req.body.updates
        .map((update: any) => update.fieldId)
        .filter((value: unknown): value is string => typeof value === 'string');
      const existingById = new Map<string, any>();

      if (fieldIds.length > 0) {
        const existing = await db.query(
          `SELECT afb.id,
                  afb.variable_name,
                  afb.unit,
                  afb.grain_signature,
                  COALESCE(ap.assumption_family::text, ap.family::text) AS assumption_family
             FROM assumption_field_bindings afb
             JOIN assumption_packs ap
               ON ap.id = afb.pack_id
            WHERE afb.id = ANY($1)
              AND ap.company_id::text = $2
              AND ap.is_deleted = FALSE
              AND (
                ap.assumption_set_id = $3
                OR EXISTS (
                  SELECT 1
                    FROM assumption_pack_bindings apb
                   WHERE apb.pack_id = ap.id
                     AND apb.assumption_set_id = $3
                )
              )`,
          [fieldIds, context.companyId, assumptionSetId],
        );
        for (const row of existing.rows) {
          existingById.set(String(row.id), row);
        }
      }

      const packIdsByFamily = new Map<PackFamily, string>();
      const errors: Array<{ message: string }> = [];
      let updated = 0;
      let skipped = 0;

      for (const update of req.body.updates) {
        const existing = update.fieldId ? existingById.get(update.fieldId) : null;
        if (update.fieldId && !existing) {
          skipped += 1;
          errors.push({ message: `Field ${update.fieldId} is not available in the active assumption set.` });
          continue;
        }

        const variableName = existing?.variable_name || update.variableName;
        const spec = variableName ? VARIABLE_SPECS[variableName] : undefined;
        if (!variableName || !spec || spec.familyKey !== path) {
          skipped += 1;
          errors.push({ message: `Variable ${String(variableName || update.fieldId || 'unknown')} is not valid for ${path} assumptions.` });
          continue;
        }

        if (existing?.variable_name && update.variableName && update.variableName !== existing.variable_name) {
          skipped += 1;
          errors.push({ message: `Field ${update.fieldId} cannot be reassigned from ${existing.variable_name} to ${update.variableName}.` });
          continue;
        }

        const numericValue = finiteNumber(update.value);
        if (numericValue === null) {
          skipped += 1;
          errors.push({ message: `Variable ${variableName} received a non-numeric value.` });
          continue;
        }

        const grainSignature = update.grainSignature || existing?.grain_signature || {};
        const unit = update.unit || existing?.unit || spec.unit;

        if (existing) {
          await db.query(
            `UPDATE assumption_field_bindings
                SET value = $2,
                    unit = $3,
                    grain_signature = $4::jsonb,
                    is_override = TRUE,
                    updated_at = NOW()
              WHERE id = $1`,
            [existing.id, numericValue, unit, JSON.stringify(grainSignature)],
          );
        } else {
          let packId = packIdsByFamily.get(spec.packFamily);
          if (!packId) {
            packId = await ensurePackForFamily(context, assumptionSetId, spec.packFamily, path);
            packIdsByFamily.set(spec.packFamily, packId);
          }

          await db.query(
            `INSERT INTO assumption_field_bindings (
                pack_id,
                variable_name,
                grain_signature,
                value,
                unit,
                is_override
              )
              VALUES ($1, $2, $3::jsonb, $4, $5, TRUE)
              ON CONFLICT (pack_id, variable_name, grain_signature) DO UPDATE
                SET value = EXCLUDED.value,
                    unit = EXCLUDED.unit,
                    is_override = TRUE,
                    updated_at = NOW()`,
            [packId, variableName, JSON.stringify(grainSignature), numericValue, unit],
          );
        }

        updated += 1;
      }

      res.json({
        data: {
          updated,
          skipped,
          errors,
        },
        meta: meta(),
      });
    } catch (error) {
      next(error);
    }
  });
}

registerFamilyRoutes('demand');
registerFamilyRoutes('cost');
registerFamilyRoutes('funding');
registerFamilyRoutes('working-capital');

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
      `SELECT aol.id,
              aol.binding_id,
              aol.field_name,
              aol.previous_value,
              aol.old_value,
              aol.new_value,
              aol.reason,
              aol.override_reason,
              aol.changed_by,
              aol.overridden_by,
              aol.changed_at,
              aol.overridden_at,
              aol.created_at
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
        fieldId: row.binding_id || row.field_name,
        originalValue: finiteNumber(row.previous_value) ?? finiteNumber(row.old_value) ?? 0,
        overrideValue: finiteNumber(row.new_value) ?? 0,
        reason: row.reason || row.override_reason || '',
        actor: row.changed_by || row.overridden_by || 'system',
        createdAt: row.created_at,
      })),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/overrides', validate(OverrideCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = requireTenantId(req);
    const actorId = (req.user?.sub as string) || 'system';
    const actorUuid = idSchema.safeParse(actorId).success ? actorId : stableUuidFromText(actorId);
    const binding = await db.query(
      `SELECT afb.id,
              afb.variable_name,
              afb.value,
              afb.unit
         FROM assumption_field_bindings afb
         JOIN assumption_packs ap
           ON ap.id = afb.pack_id
         LEFT JOIN LATERAL (
           SELECT apb.assumption_set_id
             FROM assumption_pack_bindings apb
            WHERE apb.pack_id = ap.id
            ORDER BY apb.applied_at DESC
            LIMIT 1
         ) apb ON TRUE
         LEFT JOIN assumption_sets aset
           ON aset.id = COALESCE(ap.assumption_set_id, apb.assumption_set_id)
         LEFT JOIN scenarios s
           ON s.id = aset.scenario_id
         LEFT JOIN companies c
           ON c.id = COALESCE(s.company_id, ap.company_id)
        WHERE afb.id = $1
          AND ap.is_deleted = FALSE
          AND c.tenant_id::text = $2
          AND c.is_deleted = FALSE
        LIMIT 1`,
      [req.body.fieldId, tenantId],
    );

    if (Number(binding.rowCount || 0) === 0) {
      return res.status(404).json({
        error: { code: 'ASSUMPTION_FIELD_NOT_FOUND', message: `Assumption field ${req.body.fieldId} not found`, trace_id: traceId(req) },
      });
    }

    const currentValue = finiteNumber(binding.rows[0].value);
    const overrideValue = finiteNumber(req.body.overrideValue);
    if (overrideValue === null) {
      return res.status(400).json({
        error: { code: 'INVALID_OVERRIDE_VALUE', message: 'overrideValue must be numeric', trace_id: traceId(req) },
      });
    }

    await db.query(
      `UPDATE assumption_field_bindings
          SET value = $2,
              is_override = TRUE,
              evidence_ref = COALESCE($3, evidence_ref),
              updated_at = NOW()
        WHERE id = $1`,
      [req.body.fieldId, overrideValue, req.body.evidenceRef || null],
    );

    const created = await db.query(
      `INSERT INTO assumption_override_log (
          tenant_id,
          assumption_set_id,
          field_name,
          old_value,
          new_value,
          override_reason,
          overridden_by,
          overridden_at,
          binding_id,
          previous_value,
          changed_by,
          changed_at,
          reason
        )
        SELECT $1,
               COALESCE(ap.assumption_set_id, apb.assumption_set_id),
               $2,
               $3,
               $4,
               $5,
               $6::uuid,
               NOW(),
               $7::uuid,
               $8,
               $9,
               NOW(),
               $5
          FROM assumption_field_bindings afb
          JOIN assumption_packs ap
            ON ap.id = afb.pack_id
          LEFT JOIN LATERAL (
            SELECT assumption_set_id
              FROM assumption_pack_bindings
             WHERE pack_id = ap.id
             ORDER BY applied_at DESC
             LIMIT 1
          ) apb ON TRUE
         WHERE afb.id = $7::uuid
         RETURNING id, created_at`,
        [
        tenantId,
        binding.rows[0].variable_name,
        currentValue !== null ? String(currentValue) : null,
        String(overrideValue),
        req.body.reason,
        actorUuid,
        req.body.fieldId,
        currentValue,
        actorId,
      ],
    );

    res.status(201).json({
      data: {
        overrideId: created.rows[0].id,
        fieldId: req.body.fieldId,
        overrideValue,
        createdAt: created.rows[0].created_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
