import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { validate } from '../../middleware/validate';
import { z } from 'zod';
import { idSchema, uuidSchema } from './_shared';

const router = Router();

const DEFAULT_TENANT_ID = '10000000-0000-4000-8000-000000000001';

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
});

const CalendarCreateBody = z.object({
  name: z.string().min(1),
  fiscalYearStart: z.number().int().min(1).max(12),
  periodGranularity: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'annual']),
  horizonYears: z.number().int().min(1).optional(),
});

const ScenarioCreateBody = z.object({
  companyId: idSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  baseScenarioId: idSchema.optional(),
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
});

const VersionCreateBody = z.object({
  companyId: idSchema,
  scenarioId: idSchema,
  label: z.string().min(1),
  baseVersionId: idSchema.optional(),
});

const FreezePublishBody = z.object({
  reason: z.string().min(1),
});

function traceId(req: Request): string {
  return (req.headers['x-trace-id'] as string) || 'no-trace-id';
}

function tenantId(req: Request): string {
  const value = req.headers['x-tenant-id'] as string | undefined;
  return value && uuidSchema.safeParse(value).success ? value : DEFAULT_TENANT_ID;
}

function meta(extra?: Record<string, unknown>) {
  return {
    freshness: { source: 'database', timestamp: new Date().toISOString() },
    ...(extra || {}),
  };
}

function paginate(query: Record<string, unknown>) {
  const limit = Math.min(Math.max(parseInt(String(query.limit ?? '50'), 10) || 50, 1), 200);
  const offset = Math.max(parseInt(String(query.offset ?? '0'), 10) || 0, 0);
  return { limit, offset };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function companySummary(row: any) {
  return {
    companyId: row.id,
    name: row.name,
    status: 'active',
    createdAt: row.created_at,
  };
}

function companyDetail(row: any) {
  const metadata = asRecord(row.metadata);
  return {
    companyId: row.id,
    name: row.name,
    industry: String(metadata.industry ?? ''),
    baseCurrency: row.base_currency,
    fiscalYearStart: row.fiscal_year_start_month,
    status: 'active',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function versionStatus(row: any): string {
  if (!row) return 'draft';
  if (row.status === 'published') return 'published';
  if (row.is_frozen) return 'frozen';
  return row.status || 'draft';
}

function mapScenarioSummary(row: any) {
  return {
    scenarioId: row.id,
    name: row.name,
    status: versionStatus(row.latest_version_id ? row : null),
    createdAt: row.created_at,
    latestVersionId: row.latest_version_id || '',
  };
}

function mapVersionSummary(row: any) {
  return {
    versionId: row.id,
    label: row.name,
    status: row.status,
    governanceState: versionStatus(row),
    createdAt: row.created_at,
  };
}

function periodLabelFor(date: Date, periodType: string, index: number): string {
  if (periodType === 'quarterly') {
    return `Q${Math.floor(index / 3) + 1} ${date.getUTCFullYear()}`;
  }
  if (periodType === 'annual') {
    return `FY ${date.getUTCFullYear()}`;
  }
  if (periodType === 'weekly') {
    return `Week ${index + 1} ${date.getUTCFullYear()}`;
  }
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function addPeriod(date: Date, periodType: string): Date {
  const next = new Date(date);
  if (periodType === 'annual') {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else if (periodType === 'quarterly') {
    next.setUTCMonth(next.getUTCMonth() + 3);
  } else if (periodType === 'weekly') {
    next.setUTCDate(next.getUTCDate() + 7);
  } else if (periodType === 'daily') {
    next.setUTCDate(next.getUTCDate() + 1);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

async function ensureScenarioVersionStatus(scenarioId: string, status?: string) {
  if (!status) return;

  const mappedStatus =
    status === 'review' ? 'in_review' :
    status === 'approved' ? 'approved' :
    status === 'archived' ? 'archived' :
    'draft';

  await db.query(
    `UPDATE plan_versions
        SET status = $2, updated_at = NOW()
      WHERE id = (
        SELECT id
        FROM plan_versions
        WHERE scenario_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      )`,
    [scenarioId, mappedStatus],
  );
}

router.get('/companies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, offset } = paginate(req.query);
    const statusFilter = req.query.status as string | undefined;
    if (statusFilter && statusFilter !== 'active') {
      return res.json({ data: [], meta: meta() });
    }

    const { rows } = await db.query(
      `SELECT id, name, base_currency, fiscal_year_start_month, metadata, created_at, updated_at
         FROM companies
        WHERE is_deleted = FALSE
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2`,
      [limit, offset],
    );

    res.json({ data: rows.map(companySummary), meta: meta() });
  } catch (error) {
    next(error);
  }
});

router.post('/companies', validate(CompanyCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, industry, baseCurrency, fiscalYearStart } = req.body;
    const { rows } = await db.query(
      `INSERT INTO companies (tenant_id, name, base_currency, fiscal_year_start_month, country_code, metadata)
       VALUES ($1, $2, $3, $4, 'US', $5::jsonb)
       RETURNING id, name, base_currency, fiscal_year_start_month, metadata, created_at, updated_at`,
      [tenantId(req), name, baseCurrency, fiscalYearStart || 1, JSON.stringify({ industry })],
    );

    res.status(201).json({ data: companySummary(rows[0]), meta: meta() });
  } catch (error) {
    next(error);
  }
});

router.get('/companies/:companyId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.params;
    const result = await db.query(
      `SELECT id, name, base_currency, fiscal_year_start_month, metadata, created_at, updated_at
         FROM companies
        WHERE id = $1 AND is_deleted = FALSE`,
      [companyId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPANY_NOT_FOUND', message: `Company ${companyId} not found`, trace_id: traceId(req) },
      });
    }

    res.json({ data: companyDetail(result.rows[0]), meta: meta() });
  } catch (error) {
    next(error);
  }
});

router.patch('/companies/:companyId', validate(CompanyPatchBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.params;
    const current = await db.query(
      `SELECT id, name, base_currency, fiscal_year_start_month, metadata, created_at, updated_at
         FROM companies
        WHERE id = $1 AND is_deleted = FALSE`,
      [companyId],
    );

    if (current.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPANY_NOT_FOUND', message: `Company ${companyId} not found`, trace_id: traceId(req) },
      });
    }

    const row = current.rows[0];
    const mergedMetadata = { ...asRecord(row.metadata) };
    if (req.body.industry !== undefined) {
      mergedMetadata.industry = req.body.industry;
    }

    const updated = await db.query(
      `UPDATE companies
          SET name = $2,
              base_currency = $3,
              metadata = $4::jsonb,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, base_currency, fiscal_year_start_month, metadata, created_at, updated_at`,
      [
        companyId,
        req.body.name ?? row.name,
        req.body.baseCurrency ?? row.base_currency,
        JSON.stringify(mergedMetadata),
      ],
    );

    res.json({
      data: {
        companyId: updated.rows[0].id,
        name: updated.rows[0].name,
        updatedAt: updated.rows[0].updated_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/companies/:companyId/calendars', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.params;
    const { limit, offset } = paginate(req.query);

    const company = await db.query('SELECT id, fiscal_year_start_month FROM companies WHERE id = $1 AND is_deleted = FALSE', [companyId]);
    if (company.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPANY_NOT_FOUND', message: `Company ${companyId} not found`, trace_id: traceId(req) },
      });
    }

    const { rows } = await db.query(
      `SELECT id, name, start_date, end_date, created_at, metadata
         FROM planning_calendars
        WHERE company_id = $1 AND is_deleted = FALSE
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [companyId, limit, offset],
    );

    res.json({
      data: rows.map((row: any) => ({
        calendarId: row.id,
        name: row.name,
        fiscalYearStart: company.rows[0].fiscal_year_start_month,
        periodGranularity: String(asRecord(row.metadata).periodGranularity ?? 'monthly'),
        periods: [],
      })),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/companies/:companyId/calendars', validate(CalendarCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  const client = await db.connect();
  let started = false;
  try {
    const { companyId } = req.params;
    const { name, fiscalYearStart, periodGranularity, horizonYears } = req.body;

    const company = await client.query('SELECT id FROM companies WHERE id = $1 AND is_deleted = FALSE', [companyId]);
    if (company.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPANY_NOT_FOUND', message: `Company ${companyId} not found`, trace_id: traceId(req) },
      });
    }

    const years = horizonYears || 1;
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), fiscalYearStart - 1, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear() + years, fiscalYearStart - 1, 1));

    await client.query('BEGIN');
    started = true;

    const calendar = await client.query(
      `INSERT INTO planning_calendars (tenant_id, company_id, name, start_date, end_date, metadata)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)
       RETURNING id, name, created_at`,
      [tenantId(req), companyId, name, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10), JSON.stringify({ periodGranularity, horizonYears: years })],
    );

    let sequence = 1;
    let cursor = new Date(start);
    const periodType =
      periodGranularity === 'monthly' ? 'month' :
      periodGranularity === 'quarterly' ? 'quarterly' :
      periodGranularity === 'annual' ? 'annual' :
      periodGranularity === 'weekly' ? 'weekly' :
      'day';

    while (cursor < end) {
      const next = addPeriod(cursor, periodGranularity);
      const periodEnd = new Date(next.getTime() - 24 * 60 * 60 * 1000);

      await client.query(
        `INSERT INTO planning_periods
           (tenant_id, calendar_id, name, start_date, end_date, period_type, sequence_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          tenantId(req),
          calendar.rows[0].id,
          periodLabelFor(cursor, periodGranularity, sequence - 1),
          cursor.toISOString().slice(0, 10),
          periodEnd.toISOString().slice(0, 10),
          periodType,
          sequence,
        ],
      );

      cursor = next;
      sequence += 1;
    }

    await client.query('COMMIT');

    res.status(201).json({
      data: {
        calendarId: calendar.rows[0].id,
        name: calendar.rows[0].name,
        createdAt: calendar.rows[0].created_at,
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

router.get('/planning-periods', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string | undefined;
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
      calendarClause = ` AND pc.id = $${idx++}`;
      params.push(calendarId);
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT pp.id AS period_id, pp.name AS label, pp.start_date, pp.end_date, pp.period_type,
              pp.sequence_order, pc.id AS calendar_id
         FROM planning_periods pp
         JOIN planning_calendars pc ON pc.id = pp.calendar_id
        WHERE pc.company_id = $1 AND pc.is_deleted = FALSE AND pp.is_deleted = FALSE ${calendarClause}
        ORDER BY pp.sequence_order ASC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({
      data: rows.map((row: any) => ({
        periodId: row.period_id,
        label: row.label,
        startDate: row.start_date,
        endDate: row.end_date,
        granularity: row.period_type,
      })),
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/scenarios', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string | undefined;
    if (!companyId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId query parameter is required', trace_id: traceId(req) },
      });
    }

    const statusFilter = req.query.status as string | undefined;
    const { limit, offset } = paginate(req.query);

    const { rows } = await db.query(
      `SELECT s.id, s.name, s.description, s.created_at,
              pv.id AS latest_version_id, pv.status AS latest_version_status, pv.is_frozen AS latest_version_is_frozen
         FROM scenarios s
         LEFT JOIN LATERAL (
           SELECT id, status, is_frozen
             FROM plan_versions
            WHERE scenario_id = s.id AND is_deleted = FALSE
            ORDER BY created_at DESC
            LIMIT 1
         ) pv ON TRUE
        WHERE s.company_id = $1 AND s.is_deleted = FALSE
        ORDER BY s.created_at DESC
        LIMIT $2 OFFSET $3`,
      [companyId, limit, offset],
    );

    const data = rows.map(mapScenarioSummary).filter((row: any) => !statusFilter || row.status === statusFilter);
    res.json({ data, meta: meta() });
  } catch (error) {
    next(error);
  }
});

router.post('/scenarios', validate(ScenarioCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  const client = await db.connect();
  try {
    const { companyId, name, description, baseScenarioId } = req.body;
    const company = await client.query('SELECT id, tenant_id FROM companies WHERE id = $1 AND is_deleted = FALSE', [companyId]);
    if (company.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPANY_NOT_FOUND', message: `Company ${companyId} not found`, trace_id: traceId(req) },
      });
    }

    await client.query('BEGIN');

    const scenario = await client.query(
      `INSERT INTO scenarios (tenant_id, company_id, name, scenario_type, description, base_scenario_id)
       VALUES ($1, $2, $3, 'custom', $4, $5)
       RETURNING id, name, created_at`,
      [company.rows[0].tenant_id, companyId, name, description || null, baseScenarioId || null],
    );

    const assumptionSet = await client.query(
      `INSERT INTO assumption_sets (tenant_id, scenario_id, name, overall_confidence, review_cadence)
       VALUES ($1, $2, $3, 'medium', 'Monthly')
       RETURNING id`,
      [company.rows[0].tenant_id, scenario.rows[0].id, `${name} — Assumptions v1.0`],
    );

    const version = await client.query(
      `INSERT INTO plan_versions (tenant_id, company_id, scenario_id, assumption_set_id, name, version_type, status, is_frozen)
       VALUES ($1, $2, $3, $4, $5, 'forecast', 'draft', FALSE)
       RETURNING id`,
      [company.rows[0].tenant_id, companyId, scenario.rows[0].id, assumptionSet.rows[0].id, `${name} Forecast v1`],
    );

    await client.query('COMMIT');

    res.status(201).json({
      data: {
        scenarioId: scenario.rows[0].id,
        name: scenario.rows[0].name,
        status: 'draft',
        createdAt: scenario.rows[0].created_at,
        latestVersionId: version.rows[0].id,
      },
      meta: meta(),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

router.post('/scenarios/:scenarioId/clone', validate(ScenarioCloneBody), async (req: Request, res: Response, next: NextFunction) => {
  const client = await db.connect();
  let started = false;
  try {
    const { scenarioId } = req.params;
    const { name, includeAssumptions, includeDecisions } = req.body;

    const source = await client.query(
      `SELECT id, tenant_id, company_id, scenario_type, description
         FROM scenarios
        WHERE id = $1 AND is_deleted = FALSE`,
      [scenarioId],
    );

    if (source.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'SCENARIO_NOT_FOUND', message: `Scenario ${scenarioId} not found`, trace_id: traceId(req) },
      });
    }

    await client.query('BEGIN');
    started = true;

    const clonedScenario = await client.query(
      `INSERT INTO scenarios (tenant_id, company_id, name, scenario_type, description, base_scenario_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, created_at`,
      [source.rows[0].tenant_id, source.rows[0].company_id, name, 'custom', source.rows[0].description, scenarioId],
    );

    const assumptionSet = await client.query(
      `INSERT INTO assumption_sets (tenant_id, scenario_id, name, overall_confidence, review_cadence)
       VALUES ($1, $2, $3, 'medium', 'Monthly')
       RETURNING id`,
      [source.rows[0].tenant_id, clonedScenario.rows[0].id, `${name} — Assumptions v1.0`],
    );

    if (includeAssumptions !== false) {
      await client.query(
        `INSERT INTO assumption_lineage (tenant_id, assumption_set_id, parent_assumption_set_id, change_reason)
         SELECT $1, $2, id, $3
           FROM assumption_sets
          WHERE scenario_id = $4
          ORDER BY created_at DESC
          LIMIT 1`,
        [source.rows[0].tenant_id, assumptionSet.rows[0].id, 'Cloned from source scenario', scenarioId],
      );
    }

    const version = await client.query(
      `INSERT INTO plan_versions (tenant_id, company_id, scenario_id, assumption_set_id, name, version_type, status, is_frozen)
       VALUES ($1, $2, $3, $4, $5, 'forecast', 'draft', FALSE)
       RETURNING id`,
      [source.rows[0].tenant_id, source.rows[0].company_id, clonedScenario.rows[0].id, assumptionSet.rows[0].id, `${name} Forecast v1`],
    );

    await client.query('COMMIT');

    res.status(201).json({
      data: {
        scenarioId: clonedScenario.rows[0].id,
        name: clonedScenario.rows[0].name,
        clonedFrom: scenarioId,
        status: includeDecisions === false ? 'draft' : 'draft',
        latestVersionId: version.rows[0].id,
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

router.patch('/scenarios/:scenarioId', validate(ScenarioPatchBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scenarioId } = req.params;
    const current = await db.query(
      `SELECT id, name, description
         FROM scenarios
        WHERE id = $1 AND is_deleted = FALSE`,
      [scenarioId],
    );

    if (current.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'SCENARIO_NOT_FOUND', message: `Scenario ${scenarioId} not found`, trace_id: traceId(req) },
      });
    }

    const updated = await db.query(
      `UPDATE scenarios
          SET name = $2, description = $3, updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, updated_at`,
      [scenarioId, req.body.name ?? current.rows[0].name, req.body.description ?? current.rows[0].description],
    );

    await ensureScenarioVersionStatus(scenarioId, req.body.status);

    res.json({
      data: {
        scenarioId: updated.rows[0].id,
        name: updated.rows[0].name,
        updatedAt: updated.rows[0].updated_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string | undefined;
    const scenarioId = req.query.scenarioId as string | undefined;
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

    if (statusFilter && statusFilter !== 'frozen') {
      statusClause = ` AND pv.status = $${idx++}`;
      params.push(statusFilter);
    } else if (statusFilter === 'frozen') {
      statusClause = ' AND pv.is_frozen = TRUE';
    }

    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT pv.id, pv.name, pv.status, pv.is_frozen, pv.created_at
         FROM plan_versions pv
        WHERE pv.company_id = $1
          AND pv.scenario_id = $2
          AND pv.is_deleted = FALSE
          ${statusClause}
        ORDER BY pv.created_at DESC
        LIMIT $${idx++} OFFSET $${idx++}`,
      params,
    );

    res.json({ data: rows.map(mapVersionSummary), meta: meta() });
  } catch (error) {
    next(error);
  }
});

router.post('/versions', validate(VersionCreateBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId, label } = req.body;

    const scenario = await db.query(
      'SELECT tenant_id FROM scenarios WHERE id = $1 AND company_id = $2 AND is_deleted = FALSE',
      [scenarioId, companyId],
    );
    if (scenario.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'SCENARIO_NOT_FOUND', message: `Scenario ${scenarioId} not found`, trace_id: traceId(req) },
      });
    }

    let assumptionSet = await db.query(
      `SELECT id
         FROM assumption_sets
        WHERE scenario_id = $1 AND is_deleted = FALSE
        ORDER BY created_at DESC
        LIMIT 1`,
      [scenarioId],
    );

    if (assumptionSet.rowCount === 0) {
      assumptionSet = await db.query(
        `INSERT INTO assumption_sets (tenant_id, scenario_id, name, overall_confidence, review_cadence)
         VALUES ($1, $2, $3, 'medium', 'Monthly')
         RETURNING id`,
        [scenario.rows[0].tenant_id, scenarioId, `${label} — Assumptions`],
      );
    }

    const created = await db.query(
      `INSERT INTO plan_versions (tenant_id, company_id, scenario_id, assumption_set_id, name, version_type, status, is_frozen)
       VALUES ($1, $2, $3, $4, $5, 'forecast', 'draft', FALSE)
       RETURNING id, name, status, is_frozen, created_at`,
      [scenario.rows[0].tenant_id, companyId, scenarioId, assumptionSet.rows[0].id, label],
    );

    res.status(201).json({ data: mapVersionSummary(created.rows[0]), meta: meta() });
  } catch (error) {
    next(error);
  }
});

router.get('/versions/:versionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const result = await db.query(
      `SELECT id, scenario_id, name, status, is_frozen, metadata, created_at
         FROM plan_versions
        WHERE id = $1 AND is_deleted = FALSE`,
      [versionId],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'VERSION_NOT_FOUND', message: `Version ${versionId} not found`, trace_id: traceId(req) },
      });
    }

    const row = result.rows[0];
    const details = asRecord(row.metadata);
    res.json({
      data: {
        versionId: row.id,
        label: row.name,
        scenarioId: row.scenario_id,
        governanceState: versionStatus(row),
        createdAt: row.created_at,
        publishedAt: details.published_at ?? null,
        frozenAt: details.frozen_at ?? null,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/versions/:versionId/freeze', validate(FreezePublishBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const current = await db.query('SELECT id, metadata, status FROM plan_versions WHERE id = $1 AND is_deleted = FALSE', [versionId]);
    if (current.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'VERSION_NOT_FOUND', message: `Version ${versionId} not found`, trace_id: traceId(req) },
      });
    }

    const metadata = {
      ...asRecord(current.rows[0].metadata),
      frozen_at: new Date().toISOString(),
      freeze_reason: req.body.reason,
    };

    const updated = await db.query(
      `UPDATE plan_versions
          SET is_frozen = TRUE,
              metadata = $2::jsonb,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, status, is_frozen, metadata`,
      [versionId, JSON.stringify(metadata)],
    );

    res.json({
      data: {
        versionId,
        governanceState: versionStatus(updated.rows[0]),
        frozenAt: asRecord(updated.rows[0].metadata).frozen_at ?? null,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/versions/:versionId/publish', validate(FreezePublishBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { versionId } = req.params;
    const current = await db.query('SELECT id, metadata FROM plan_versions WHERE id = $1 AND is_deleted = FALSE', [versionId]);
    if (current.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'VERSION_NOT_FOUND', message: `Version ${versionId} not found`, trace_id: traceId(req) },
      });
    }

    const metadata = {
      ...asRecord(current.rows[0].metadata),
      published_at: new Date().toISOString(),
      publish_reason: req.body.reason,
    };

    const updated = await db.query(
      `UPDATE plan_versions
          SET status = 'published',
              is_frozen = TRUE,
              metadata = $2::jsonb,
              updated_at = NOW()
        WHERE id = $1
        RETURNING id, status, is_frozen, metadata`,
      [versionId, JSON.stringify(metadata)],
    );

    res.json({
      data: {
        versionId,
        governanceState: versionStatus(updated.rows[0]),
        publishedAt: asRecord(updated.rows[0].metadata).published_at ?? null,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companyId = req.query.companyId as string | undefined;
    if (!companyId) {
      return res.status(400).json({
        error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId query parameter is required', trace_id: traceId(req) },
      });
    }

    const scenarioId = req.query.scenarioId as string | undefined;
    const versionId = req.query.versionId as string | undefined;

    const company = await db.query(
      `SELECT id, name, base_currency, fiscal_year_start_month, metadata, created_at, updated_at
         FROM companies
        WHERE id = $1 AND is_deleted = FALSE`,
      [companyId],
    );
    if (company.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'COMPANY_NOT_FOUND', message: `Company ${companyId} not found`, trace_id: traceId(req) },
      });
    }

    const scenarioResult = scenarioId
      ? await db.query(
          `SELECT s.id, s.name, s.description, s.created_at,
                  pv.id AS latest_version_id, pv.status AS latest_version_status, pv.is_frozen AS latest_version_is_frozen
             FROM scenarios s
             LEFT JOIN LATERAL (
               SELECT id, status, is_frozen
                 FROM plan_versions
                WHERE scenario_id = s.id AND is_deleted = FALSE
                ORDER BY created_at DESC
                LIMIT 1
             ) pv ON TRUE
            WHERE s.id = $1 AND s.company_id = $2 AND s.is_deleted = FALSE`,
          [scenarioId, companyId],
        )
      : await db.query(
          `SELECT s.id, s.name, s.description, s.created_at,
                  pv.id AS latest_version_id, pv.status AS latest_version_status, pv.is_frozen AS latest_version_is_frozen
             FROM scenarios s
             LEFT JOIN LATERAL (
               SELECT id, status, is_frozen
                 FROM plan_versions
                WHERE scenario_id = s.id AND is_deleted = FALSE
                ORDER BY created_at DESC
                LIMIT 1
             ) pv ON TRUE
            WHERE s.company_id = $1 AND s.is_deleted = FALSE
            ORDER BY s.created_at DESC
            LIMIT 1`,
          [companyId],
        );

    const activeScenario = scenarioResult.rows[0] ? mapScenarioSummary(scenarioResult.rows[0]) : null;

    const versionResult = versionId
      ? await db.query(
          `SELECT id, scenario_id, name, status, is_frozen, metadata, created_at
             FROM plan_versions
            WHERE id = $1 AND is_deleted = FALSE`,
          [versionId],
        )
      : activeScenario && activeScenario.latestVersionId
        ? await db.query(
            `SELECT id, scenario_id, name, status, is_frozen, metadata, created_at
               FROM plan_versions
              WHERE id = $1 AND is_deleted = FALSE`,
            [activeScenario.latestVersionId],
          )
        : { rows: [], rowCount: 0 } as any;

    const activeVersion = versionResult.rows[0]
      ? {
          versionId: versionResult.rows[0].id,
          label: versionResult.rows[0].name,
          scenarioId: versionResult.rows[0].scenario_id,
          governanceState: versionStatus(versionResult.rows[0]),
          createdAt: versionResult.rows[0].created_at,
          publishedAt: asRecord(versionResult.rows[0].metadata).published_at ?? null,
          frozenAt: asRecord(versionResult.rows[0].metadata).frozen_at ?? null,
        }
      : null;

    let headlineKpis = { revenue: 0, ebitda: 0, burn: 0, runway: 0 };
    if (activeScenario) {
      const pnl = await db.query(
        `SELECT COALESCE(SUM(net_revenue), 0) AS revenue,
                COALESCE(SUM(ebitda), 0) AS ebitda
           FROM pnl_projections
          WHERE scenario_id = $1`,
        [activeScenario.scenarioId],
      );
      const cash = await db.query(
        `SELECT COALESCE(AVG(GREATEST(-net_change, 0)), 0) AS burn,
                COALESCE(MAX(cash_runway_months), 0) AS runway
           FROM cashflow_projections
          WHERE scenario_id = $1`,
        [activeScenario.scenarioId],
      );
      headlineKpis = {
        revenue: Number(pnl.rows[0]?.revenue || 0),
        ebitda: Number(pnl.rows[0]?.ebitda || 0),
        burn: Number(cash.rows[0]?.burn || 0),
        runway: Number(cash.rows[0]?.runway || 0),
      };
    }

    const alerts = activeScenario
      ? await db.query(
          `SELECT id, alert_name, severity, message, created_at
             FROM performance_alerts
            WHERE scenario_id = $1 AND is_resolved = FALSE
            ORDER BY created_at DESC
            LIMIT 10`,
          [activeScenario.scenarioId],
        )
      : { rows: [] } as any;

    res.json({
      data: {
        company: companyDetail(company.rows[0]),
        activeScenario,
        activeVersion,
        headlineKpis,
        alerts: alerts.rows,
        quickLinks: [],
      },
      meta: meta({ governanceState: activeVersion?.governanceState || 'draft' }),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
