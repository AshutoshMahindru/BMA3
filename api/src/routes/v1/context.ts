/**
 * Context routes — /api/v1/context
 * Generated from specos/artifacts/api_contracts.json (api_context_001 – api_context_017)
 * Column names sourced from specos/artifacts/canonical_schema.json
 *
 * Entities: companies, scenarios, plan_versions, planning_calendars, planning_periods
 */
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { validate } from '../../middleware/validate';
import { z } from 'zod';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tenantId(req: Request): string {
  return (req.headers['x-tenant-id'] as string) || 'no-tenant-id';
}

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

const CompanyCreateBody = z.object({
  name: z.string().min(1),
  industry: z.string().min(1),
  baseCurrency: z.string().min(3).max(3),
  fiscalYearStart: z.number().int().min(1).max(12).optional(),
});

const CompanyPatchBody = z.object({
  name: z.string().min(1).optional(),
  industry: z.string().min(1).optional(),
  baseCurrency: z.string().min(3).max(3).optional(),
  reason: z.string().optional(),
});

const CalendarCreateBody = z.object({
  name: z.string().min(1),
  fiscalYearStart: z.number().int().min(1).max(12),
  periodGranularity: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annual']),
  horizonYears: z.number().int().min(1).optional(),
});

const ScenarioCreateBody = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  baseScenarioId: z.string().uuid().optional(),
});

const ScenarioCloneBody = z.object({
  name: z.string().min(1),
  includeAssumptions: z.boolean().optional(),
  includeDecisions: z.boolean().optional(),
});

const ScenarioPatchBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'review', 'approved', 'archived']).optional(),
  reason: z.string().optional(),
});

const VersionCreateBody = z.object({
  companyId: z.string().uuid(),
  scenarioId: z.string().uuid(),
  label: z.string().min(1),
  baseVersionId: z.string().uuid().optional(),
});

const FreezePublishBody = z.object({
  reason: z.string().min(1),
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANIES  (api_context_001 – 004)
// Table: companies
//   id, slug, name, legal_name, status, default_currency,
//   fiscal_year_start_month, metadata, created_at, updated_at
// ═══════════════════════════════════════════════════════════════════════════════

// api_context_001: GET /companies
router.get('/companies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset } = paginate(req.query);
    const statusFilter = req.query.status as string | undefined;

    const params: any[] = [];
    let where = '';
    let idx = 1;

    if (statusFilter) {
      where += ` AND c.status = $${idx++}`;
      params.push(statusFilter);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT c.id, c.name, c.status, c.default_currency, c.fiscal_year_start_month,
              c.slug, c.metadata, c.created_at, c.updated_at
         FROM companies c
        WHERE 1=1 ${where}
        ORDER BY c.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({ data: rows, meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_context_002: POST /companies
router.post('/companies', validate(CompanyCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, industry, baseCurrency, fiscalYearStart } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const { rows } = await db.query(
      `INSERT INTO companies (name, slug, default_currency, fiscal_year_start_month, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, slug, name, status, default_currency, fiscal_year_start_month, metadata, created_at, updated_at`,
      [name, slug, baseCurrency, fiscalYearStart || 1, JSON.stringify({ industry })],
    );

    res.status(201).json({ data: rows[0], meta: meta() });
  } catch (error: any) {
    if (error?.code === '23505' && error?.constraint?.includes('slug')) {
      return res.status(409).json({
        error: { code: 'DUPLICATE_COMPANY_NAME', message: `Company "${req.body.name}" already exists`, trace_id: traceId(req) },
      });
    }
    next(error);
  }
});

// api_context_003: GET /companies/:companyId
router.get('/companies/:companyId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.params;
    const { rows, rowCount } = await db.query(
      `SELECT id, slug, name, legal_name, status, default_currency,
              fiscal_year_start_month, metadata, created_at, updated_at
         FROM companies WHERE id = $1`,
      [companyId],
    );

    if (rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPANY_NOT_FOUND', message: `Company ${companyId} not found`, trace_id: traceId(req) },
      });
    }
    res.json({ data: rows[0], meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_context_004: PATCH /companies/:companyId
router.patch('/companies/:companyId', validate(CompanyPatchBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.params;
    const { name, industry, baseCurrency } = req.body;

    // Build dynamic SET clause from provided fields
    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (name !== undefined) { setClauses.push(`name = $${idx++}`); params.push(name); }
    if (baseCurrency !== undefined) { setClauses.push(`default_currency = $${idx++}`); params.push(baseCurrency); }
    if (industry !== undefined) { setClauses.push(`metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{industry}', $${idx++}::jsonb)`); params.push(JSON.stringify(industry)); }

    if (setClauses.length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'No updatable fields provided', trace_id: traceId(req) },
      });
    }

    setClauses.push(`updated_at = now()`);
    params.push(companyId);

    const { rows, rowCount } = await db.query(
      `UPDATE companies SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, slug, name, status, default_currency, fiscal_year_start_month, metadata, created_at, updated_at`,
      params,
    );

    if (rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPANY_NOT_FOUND', message: `Company ${companyId} not found`, trace_id: traceId(req) },
      });
    }
    res.json({ data: rows[0], meta: meta() });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDARS  (api_context_005 – 006)
// Table: planning_calendars
//   id, company_id, name, fiscal_year_label, start_date, end_date,
//   default_grain, status, metadata, created_at, updated_at
// ═══════════════════════════════════════════════════════════════════════════════

// api_context_005: GET /companies/:companyId/calendars
router.get('/companies/:companyId/calendars', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.params;
    const { limit, offset } = paginate(req.query);

    // Verify company exists
    const company = await db.query('SELECT id FROM companies WHERE id = $1', [companyId]);
    if (company.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPANY_NOT_FOUND', message: `Company ${companyId} not found`, trace_id: traceId(req) },
      });
    }

    const { rows } = await db.query(
      `SELECT id, company_id, name, fiscal_year_label, start_date, end_date,
              default_grain, status, metadata, created_at, updated_at
         FROM planning_calendars
        WHERE company_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [companyId, limit, offset],
    );

    res.json({ data: rows, meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_context_006: POST /companies/:companyId/calendars
router.post('/companies/:companyId/calendars', validate(CalendarCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.params;
    const { name, fiscalYearStart, periodGranularity, horizonYears } = req.body;

    // Verify company exists
    const company = await db.query('SELECT id FROM companies WHERE id = $1', [companyId]);
    if (company.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPANY_NOT_FOUND', message: `Company ${companyId} not found`, trace_id: traceId(req) },
      });
    }

    const startMonth = fiscalYearStart;
    const now = new Date();
    const startYear = startMonth <= now.getMonth() + 1 ? now.getFullYear() : now.getFullYear();
    const endYear = startYear + (horizonYears || 3);
    const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
    const endDate = `${endYear}-${String(startMonth).padStart(2, '0')}-01`;
    const fiscalYearLabel = `FY${startYear}–FY${endYear}`;

    const { rows } = await db.query(
      `INSERT INTO planning_calendars (company_id, name, fiscal_year_label, start_date, end_date, default_grain, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, company_id, name, fiscal_year_label, start_date, end_date, default_grain, status, metadata, created_at, updated_at`,
      [companyId, name, fiscalYearLabel, startDate, endDate, periodGranularity, JSON.stringify({ horizonYears: horizonYears || 3 })],
    );

    res.status(201).json({ data: rows[0], meta: meta() });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({
        error: { code: 'DUPLICATE_CALENDAR', message: 'A calendar with this name already exists for this company', trace_id: traceId(req) },
      });
    }
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PLANNING PERIODS  (api_context_007)
// Table: planning_periods
//   id, calendar_id, company_id, label, grain, start_date, end_date,
//   fiscal_year, fiscal_quarter, fiscal_month, sequence_number,
//   trading_days, is_actual, metadata, created_at, updated_at
// ═══════════════════════════════════════════════════════════════════════════════

// api_context_007: GET /planning-periods
router.get('/planning-periods', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId query parameter is required', trace_id: traceId(req) },
      });
    }

    const calendarId = req.query.calendarId as string | undefined;
    const { limit, offset } = paginate(req.query);

    const params: any[] = [companyId];
    let idx = 2;
    let calendarClause = '';

    if (calendarId) {
      calendarClause = ` AND calendar_id = $${idx++}`;
      params.push(calendarId);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT id, calendar_id, company_id, label, grain, start_date, end_date,
              fiscal_year, fiscal_quarter, fiscal_month, sequence_number,
              trading_days, is_actual, metadata, created_at, updated_at
         FROM planning_periods
        WHERE company_id = $1 ${calendarClause}
        ORDER BY sequence_number ASC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({ data: rows, meta: meta() });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIOS  (api_context_008 – 011)
// Table: scenarios
//   id, company_id, name, scenario_family, parent_scenario_id, status,
//   description, active_scope_bundle_id, metadata, created_at, updated_at
// ═══════════════════════════════════════════════════════════════════════════════

// api_context_008: GET /scenarios
router.get('/scenarios', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId query parameter is required', trace_id: traceId(req) },
      });
    }

    const statusFilter = req.query.status as string | undefined;
    const { limit, offset } = paginate(req.query);

    const params: any[] = [companyId];
    let idx = 2;
    let statusClause = '';

    if (statusFilter) {
      statusClause = ` AND status = $${idx++}`;
      params.push(statusFilter);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT id, company_id, name, scenario_family, parent_scenario_id, status,
              description, active_scope_bundle_id, metadata, created_at, updated_at
         FROM scenarios
        WHERE company_id = $1 ${statusClause}
        ORDER BY created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({ data: rows, meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_context_009: POST /scenarios
router.post('/scenarios', validate(ScenarioCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, name, description, baseScenarioId } = req.body;

    // Verify company exists
    const company = await db.query('SELECT id FROM companies WHERE id = $1', [companyId]);
    if (company.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPANY_NOT_FOUND', message: `Company ${companyId} not found`, trace_id: traceId(req) },
      });
    }

    const { rows } = await db.query(
      `INSERT INTO scenarios (company_id, name, description, parent_scenario_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, company_id, name, scenario_family, parent_scenario_id, status,
                 description, active_scope_bundle_id, metadata, created_at, updated_at`,
      [companyId, name, description || null, baseScenarioId || null],
    );

    res.status(201).json({ data: rows[0], meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_context_010: POST /scenarios/:scenarioId/clone
router.post('/scenarios/:scenarioId/clone', validate(ScenarioCloneBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scenarioId } = req.params;
    const { name, includeAssumptions, includeDecisions } = req.body;

    // Find source scenario
    const source = await db.query(
      `SELECT id, company_id, scenario_family, description, active_scope_bundle_id, metadata
         FROM scenarios WHERE id = $1`,
      [scenarioId],
    );

    if (source.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'SCENARIO_NOT_FOUND', message: `Scenario ${scenarioId} not found`, trace_id: traceId(req) },
      });
    }

    const src = source.rows[0];

    const { rows } = await db.query(
      `INSERT INTO scenarios (company_id, name, scenario_family, parent_scenario_id, description, active_scope_bundle_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, company_id, name, scenario_family, parent_scenario_id, status,
                 description, active_scope_bundle_id, metadata, created_at, updated_at`,
      [src.company_id, name, src.scenario_family, scenarioId, src.description, src.active_scope_bundle_id,
       JSON.stringify({ ...(src.metadata || {}), cloned_from: scenarioId, includeAssumptions: includeAssumptions ?? true, includeDecisions: includeDecisions ?? true })],
    );

    res.status(201).json({ data: rows[0], meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_context_011: PATCH /scenarios/:scenarioId
router.patch('/scenarios/:scenarioId', validate(ScenarioPatchBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scenarioId } = req.params;
    const { name, description, status, reason } = req.body;

    const setClauses: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (name !== undefined) { setClauses.push(`name = $${idx++}`); params.push(name); }
    if (description !== undefined) { setClauses.push(`description = $${idx++}`); params.push(description); }
    if (status !== undefined) { setClauses.push(`status = $${idx++}`); params.push(status); }

    if (setClauses.length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'No updatable fields provided', trace_id: traceId(req) },
      });
    }

    setClauses.push(`updated_at = now()`);
    params.push(scenarioId);

    const { rows, rowCount } = await db.query(
      `UPDATE scenarios SET ${setClauses.join(', ')} WHERE id = $${idx}
       RETURNING id, company_id, name, scenario_family, parent_scenario_id, status,
                 description, active_scope_bundle_id, metadata, created_at, updated_at`,
      params,
    );

    if (rowCount === 0) {
      return res.status(404).json({
        error: { code: 'SCENARIO_NOT_FOUND', message: `Scenario ${scenarioId} not found`, trace_id: traceId(req) },
      });
    }
    res.json({ data: rows[0], meta: meta() });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// VERSIONS  (api_context_012 – 016)
// Table: plan_versions
//   id, company_id, scenario_id, version_number, label, status,
//   created_by, frozen_at, published_at, approved_by, metadata,
//   created_at, updated_at
// ═══════════════════════════════════════════════════════════════════════════════

// api_context_012: GET /versions
router.get('/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string;
    const scenarioId = req.query.scenarioId as string;

    if (!companyId || !scenarioId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId and scenarioId query parameters are required', trace_id: traceId(req) },
      });
    }

    const statusFilter = req.query.status as string | undefined;
    const { limit, offset } = paginate(req.query);

    const params: any[] = [companyId, scenarioId];
    let idx = 3;
    let statusClause = '';

    if (statusFilter) {
      statusClause = ` AND status = $${idx++}`;
      params.push(statusFilter);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT id, company_id, scenario_id, version_number, label, status,
              created_by, frozen_at, published_at, approved_by, metadata,
              created_at, updated_at
         FROM plan_versions
        WHERE company_id = $1 AND scenario_id = $2 ${statusClause}
        ORDER BY version_number DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({ data: rows, meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_context_013: POST /versions
router.post('/versions', validate(VersionCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId, label, baseVersionId } = req.body;

    // Verify scenario exists
    const scenario = await db.query('SELECT id FROM scenarios WHERE id = $1 AND company_id = $2', [scenarioId, companyId]);
    if (scenario.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'SCENARIO_NOT_FOUND', message: `Scenario ${scenarioId} not found`, trace_id: traceId(req) },
      });
    }

    // Determine next version number
    const maxVersion = await db.query(
      'SELECT COALESCE(MAX(version_number), 0) AS max_ver FROM plan_versions WHERE scenario_id = $1',
      [scenarioId],
    );
    const nextVersion = (maxVersion.rows[0].max_ver || 0) + 1;

    const { rows } = await db.query(
      `INSERT INTO plan_versions (company_id, scenario_id, version_number, label, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, company_id, scenario_id, version_number, label, status,
                 created_by, frozen_at, published_at, approved_by, metadata,
                 created_at, updated_at`,
      [companyId, scenarioId, nextVersion, label, baseVersionId ? JSON.stringify({ base_version_id: baseVersionId }) : null],
    );

    res.status(201).json({ data: rows[0], meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_context_014: GET /versions/:versionId
router.get('/versions/:versionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const { rows, rowCount } = await db.query(
      `SELECT id, company_id, scenario_id, version_number, label, status,
              created_by, frozen_at, published_at, approved_by, metadata,
              created_at, updated_at
         FROM plan_versions WHERE id = $1`,
      [versionId],
    );

    if (rowCount === 0) {
      return res.status(404).json({
        error: { code: 'VERSION_NOT_FOUND', message: `Version ${versionId} not found`, trace_id: traceId(req) },
      });
    }
    res.json({ data: rows[0], meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_context_015: POST /versions/:versionId/freeze
router.post('/versions/:versionId/freeze', validate(FreezePublishBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const { reason } = req.body;

    // Fetch current version
    const current = await db.query('SELECT id, status FROM plan_versions WHERE id = $1', [versionId]);
    if (current.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'VERSION_NOT_FOUND', message: `Version ${versionId} not found`, trace_id: traceId(req) },
      });
    }

    if (current.rows[0].status === 'frozen' || current.rows[0].status === 'published') {
      return res.status(409).json({
        error: { code: 'VERSION_FROZEN', message: `Version ${versionId} is already frozen/published`, trace_id: traceId(req) },
      });
    }

    const { rows } = await db.query(
      `UPDATE plan_versions
          SET status = 'frozen', frozen_at = now(), updated_at = now(),
              metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{freeze_reason}', $2::jsonb)
        WHERE id = $1
       RETURNING id, company_id, scenario_id, version_number, label, status,
                 created_by, frozen_at, published_at, approved_by, metadata,
                 created_at, updated_at`,
      [versionId, JSON.stringify(reason)],
    );

    res.json({ data: rows[0], meta: meta() });
  } catch (error) {
    next(error);
  }
});

// api_context_016: POST /versions/:versionId/publish
router.post('/versions/:versionId/publish', validate(FreezePublishBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const { reason } = req.body;

    const current = await db.query('SELECT id, status FROM plan_versions WHERE id = $1', [versionId]);
    if (current.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'VERSION_NOT_FOUND', message: `Version ${versionId} not found`, trace_id: traceId(req) },
      });
    }

    const st = current.rows[0].status;
    if (st !== 'frozen' && st !== 'approved') {
      return res.status(409).json({
        error: { code: 'APPROVAL_STATE_INVALID', message: `Version must be frozen or approved before publishing (current: ${st})`, trace_id: traceId(req) },
      });
    }

    const { rows } = await db.query(
      `UPDATE plan_versions
          SET status = 'published', published_at = now(), updated_at = now(),
              metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{publish_reason}', $2::jsonb)
        WHERE id = $1
       RETURNING id, company_id, scenario_id, version_number, label, status,
                 created_by, frozen_at, published_at, approved_by, metadata,
                 created_at, updated_at`,
      [versionId, JSON.stringify(reason)],
    );

    res.json({ data: rows[0], meta: meta() });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// OVERVIEW  (api_context_017)
// Read-model: joins companies, scenarios, plan_versions, pnl_projections, etc.
// ═══════════════════════════════════════════════════════════════════════════════

// api_context_017: GET /overview
router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string;
    if (!companyId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId query parameter is required', trace_id: traceId(req) },
      });
    }

    const scenarioId = req.query.scenarioId as string | undefined;
    const versionId = req.query.versionId as string | undefined;

    // Fetch company
    const companyResult = await db.query(
      `SELECT id, name, slug, status, default_currency, fiscal_year_start_month, metadata, created_at
         FROM companies WHERE id = $1`,
      [companyId],
    );

    if (companyResult.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPANY_NOT_FOUND', message: `Company ${companyId} not found`, trace_id: traceId(req) },
      });
    }

    // Active scenario (param or most recent active)
    let scenarioRow = null;
    if (scenarioId) {
      const s = await db.query(
        `SELECT id, name, scenario_family, status, description, created_at
           FROM scenarios WHERE id = $1 AND company_id = $2`,
        [scenarioId, companyId],
      );
      scenarioRow = s.rows[0] || null;
    } else {
      const s = await db.query(
        `SELECT id, name, scenario_family, status, description, created_at
           FROM scenarios WHERE company_id = $1 AND status IN ('active','draft')
           ORDER BY created_at DESC LIMIT 1`,
        [companyId],
      );
      scenarioRow = s.rows[0] || null;
    }

    // Active version
    let versionRow = null;
    if (versionId) {
      const v = await db.query(
        `SELECT id, version_number, label, status, frozen_at, published_at, created_at
           FROM plan_versions WHERE id = $1`,
        [versionId],
      );
      versionRow = v.rows[0] || null;
    } else if (scenarioRow) {
      const v = await db.query(
        `SELECT id, version_number, label, status, frozen_at, published_at, created_at
           FROM plan_versions WHERE scenario_id = $1
           ORDER BY version_number DESC LIMIT 1`,
        [scenarioRow.id],
      );
      versionRow = v.rows[0] || null;
    }

    // Headline KPIs from latest pnl_projections
    let headlineKpis: Record<string, number | null> = { revenue: null, ebitda: null, burn: null, runway: null };
    if (scenarioRow) {
      const kpiResult = await db.query(
        `SELECT metric_name, SUM(value) AS total
           FROM pnl_projections
          WHERE company_id = $1 AND scenario_id = $2
                ${versionRow ? 'AND version_id = $3' : ''}
          GROUP BY metric_name`,
        versionRow ? [companyId, scenarioRow.id, versionRow.id] : [companyId, scenarioRow.id],
      );
      for (const row of kpiResult.rows) {
        if (row.metric_name === 'revenue') headlineKpis.revenue = parseFloat(row.total);
        if (row.metric_name === 'ebitda') headlineKpis.ebitda = parseFloat(row.total);
        if (row.metric_name === 'net_burn') headlineKpis.burn = parseFloat(row.total);
      }
    }

    // Alerts: open validation issues
    let alertsResult;
    if (scenarioRow) {
      alertsResult = await db.query(
        `SELECT cvr.id, cvr.issue_code, cvr.severity, cvr.message
           FROM compute_validation_results cvr
           JOIN compute_runs cr ON cr.id = cvr.compute_run_id
          WHERE cvr.resolution_state = 'open'
            AND cr.company_id = $1
            AND cr.scenario_id = $2
          ORDER BY cvr.severity DESC LIMIT 10`,
        [companyId, scenarioRow.id],
      );
    } else {
      alertsResult = await db.query(
        `SELECT cvr.id, cvr.issue_code, cvr.severity, cvr.message
           FROM compute_validation_results cvr
           JOIN compute_runs cr ON cr.id = cvr.compute_run_id
          WHERE cvr.resolution_state = 'open'
            AND cr.company_id = $1
          ORDER BY cvr.severity DESC LIMIT 10`,
        [companyId],
      );
    }

    res.json({
      data: {
        company: companyResult.rows[0],
        activeScenario: scenarioRow,
        activeVersion: versionRow,
        headlineKpis,
        alerts: alertsResult.rows,
        quickLinks: [],
      },
      meta: {
        ...meta(),
        governanceState: versionRow?.status || 'draft',
        confidenceState: 'unknown',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
