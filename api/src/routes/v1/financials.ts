/**
 * Financial routes — /api/v1/financials
 * Generated from specos/artifacts/api_contracts.json (api_financials_001 – api_financials_007)
 * Column names sourced from specos/artifacts/canonical_schema.json
 *
 * All endpoints are read-only GETs that query computed projection tables.
 *
 * Tables:
 *   pnl_projections          — id, company_id, scenario_id, version_id, period_id,
 *                               compute_run_id, metric_name, value, currency,
 *                               dimension_signatures, scope_bundle_id, is_provisional,
 *                               metadata, created_at, updated_at
 *   cashflow_projections     — (same columns as pnl_projections)
 *   balance_sheet_projections — (same columns as pnl_projections)
 *   unit_economics_projections — (same columns as pnl_projections)
 */
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function traceId(req: Request): string {
  return (req.headers['x-trace-id'] as string) || 'no-trace-id';
}

function meta(extra?: Record<string, any>) {
  return {
    freshness: { source: 'database', timestamp: new Date().toISOString() },
    ...extra,
  };
}

/** Extract planning-context query params common to all financial endpoints */
function planningContext(query: Record<string, any>) {
  return {
    companyId: query.companyId as string | undefined,
    scenarioId: query.scenarioId as string | undefined,
    versionId: query.versionId as string | undefined,
    periodId: query.periodId as string | undefined,
    scopeRef: query.scopeRef as string | undefined,
    granularity: query.granularity as string | undefined,
    dimension: query.dimension as string | undefined,
  };
}

/**
 * Build WHERE clause + params array from planning context.
 * Returns { where, params, idx } for use in query composition.
 */
function buildContextFilter(ctx: ReturnType<typeof planningContext>) {
  const params: any[] = [ctx.companyId];
  let idx = 2;
  let where = 'WHERE t.company_id = $1';

  if (ctx.scenarioId) {
    where += ` AND t.scenario_id = $${idx++}`;
    params.push(ctx.scenarioId);
  }
  if (ctx.versionId) {
    where += ` AND t.version_id = $${idx++}`;
    params.push(ctx.versionId);
  }
  if (ctx.periodId) {
    where += ` AND t.period_id = $${idx++}`;
    params.push(ctx.periodId);
  }
  if (ctx.scopeRef) {
    where += ` AND t.scope_bundle_id = $${idx++}`;
    params.push(ctx.scopeRef);
  }

  return { where, params, idx };
}

/** Require companyId or return 400 */
function requireCompanyId(ctx: ReturnType<typeof planningContext>, req: Request, res: Response): boolean {
  if (!ctx.companyId) {
    res.status(400).json({
      error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId query parameter is required', trace_id: traceId(req) },
    });
    return false;
  }
  return true;
}

/** Fetch latest compute_run_id for a given context to enrich meta */
async function latestComputeRunId(companyId: string, scenarioId?: string, versionId?: string): Promise<string | null> {
  const params: any[] = [companyId];
  let clause = '';
  let idx = 2;
  if (scenarioId) { clause += ` AND scenario_id = $${idx++}`; params.push(scenarioId); }
  if (versionId) { clause += ` AND version_id = $${idx++}`; params.push(versionId); }

  const result = await db.query(
    `SELECT id FROM compute_runs
      WHERE company_id = $1 AND status = 'completed' ${clause}
      ORDER BY completed_at DESC NULLS LAST LIMIT 1`,
    params,
  );
  return result.rows[0]?.id || null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// api_financials_001: GET /executive-summary
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/executive-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!requireCompanyId(ctx, req, res)) return;

    const { where, params } = buildContextFilter(ctx);

    // Aggregate headline metrics from pnl_projections
    const pnlResult = await db.query(
      `SELECT t.metric_name, SUM(t.value) AS total
         FROM pnl_projections t
         ${where}
        GROUP BY t.metric_name`,
      params,
    );

    // Aggregate from cashflow for burn / runway
    const cfResult = await db.query(
      `SELECT t.metric_name, SUM(t.value) AS total
         FROM cashflow_projections t
         ${where}
        GROUP BY t.metric_name`,
      params,
    );

    // Build summary object
    const pnlMap = new Map(pnlResult.rows.map((r: any) => [r.metric_name, parseFloat(r.total)]));
    const cfMap = new Map(cfResult.rows.map((r: any) => [r.metric_name, parseFloat(r.total)]));

    const computeRunId = await latestComputeRunId(ctx.companyId!, ctx.scenarioId, ctx.versionId);

    res.json({
      data: {
        revenue: pnlMap.get('revenue') ?? null,
        grossProfit: pnlMap.get('gross_profit') ?? null,
        ebitda: pnlMap.get('ebitda') ?? null,
        netIncome: pnlMap.get('net_income') ?? null,
        burn: cfMap.get('net_burn') ?? null,
        runway: cfMap.get('runway_months') ?? null,
        irr: pnlMap.get('irr') ?? null,
        periodLabel: ctx.periodId || 'all',
      },
      meta: meta({
        governanceState: 'draft',
        computeRunId,
        confidenceState: 'unknown',
      }),
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// api_financials_002: GET /pnl
// Table: pnl_projections
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/pnl', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!requireCompanyId(ctx, req, res)) return;

    const { where, params } = buildContextFilter(ctx);

    const { rows } = await db.query(
      `SELECT t.metric_name, t.period_id, t.value, t.currency,
              t.dimension_signatures, t.is_provisional,
              pp.label AS period_label, pp.grain, pp.fiscal_year, pp.fiscal_quarter
         FROM pnl_projections t
         LEFT JOIN planning_periods pp ON pp.id = t.period_id
         ${where}
        ORDER BY pp.sequence_number ASC NULLS LAST, t.metric_name ASC`,
      params,
    );

    // Pivot into { periods: [...], lineItems: [...] }
    const periodMap = new Map<string, any>();
    const lineMap = new Map<string, any[]>();

    for (const row of rows) {
      const pid = row.period_id || 'aggregate';
      if (!periodMap.has(pid)) {
        periodMap.set(pid, {
          periodId: row.period_id,
          label: row.period_label || 'Aggregate',
          grain: row.grain,
          fiscalYear: row.fiscal_year,
          fiscalQuarter: row.fiscal_quarter,
        });
      }
      if (!lineMap.has(row.metric_name)) {
        lineMap.set(row.metric_name, []);
      }
      lineMap.get(row.metric_name)!.push({
        periodId: pid,
        value: row.value ? parseFloat(row.value) : null,
        currency: row.currency,
        isProvisional: row.is_provisional,
      });
    }

    const computeRunId = await latestComputeRunId(ctx.companyId!, ctx.scenarioId, ctx.versionId);

    res.json({
      data: {
        periods: Array.from(periodMap.values()),
        lineItems: Array.from(lineMap.entries()).map(([name, values]) => ({
          name,
          values,
          category: categorizeMetric(name),
        })),
      },
      meta: meta({ governanceState: 'draft', computeRunId, confidenceState: 'unknown' }),
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// api_financials_003: GET /cash-flow
// Table: cashflow_projections
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/cash-flow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!requireCompanyId(ctx, req, res)) return;

    const { where, params } = buildContextFilter(ctx);

    const { rows } = await db.query(
      `SELECT t.metric_name, t.period_id, t.value, t.currency,
              t.dimension_signatures, t.is_provisional,
              pp.label AS period_label, pp.grain, pp.fiscal_year, pp.fiscal_quarter
         FROM cashflow_projections t
         LEFT JOIN planning_periods pp ON pp.id = t.period_id
         ${where}
        ORDER BY pp.sequence_number ASC NULLS LAST, t.metric_name ASC`,
      params,
    );

    const { periods, lineItems } = pivotProjectionRows(rows);
    const computeRunId = await latestComputeRunId(ctx.companyId!, ctx.scenarioId, ctx.versionId);

    res.json({
      data: { periods, lineItems },
      meta: meta({ governanceState: 'draft', computeRunId, confidenceState: 'unknown' }),
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// api_financials_004: GET /balance-sheet
// Table: balance_sheet_projections
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/balance-sheet', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!requireCompanyId(ctx, req, res)) return;

    const { where, params } = buildContextFilter(ctx);

    const { rows } = await db.query(
      `SELECT t.metric_name, t.period_id, t.value, t.currency,
              t.dimension_signatures, t.is_provisional,
              pp.label AS period_label, pp.grain, pp.fiscal_year, pp.fiscal_quarter
         FROM balance_sheet_projections t
         LEFT JOIN planning_periods pp ON pp.id = t.period_id
         ${where}
        ORDER BY pp.sequence_number ASC NULLS LAST, t.metric_name ASC`,
      params,
    );

    const { periods, lineItems } = pivotProjectionRows(rows);
    const computeRunId = await latestComputeRunId(ctx.companyId!, ctx.scenarioId, ctx.versionId);

    res.json({
      data: { periods, lineItems },
      meta: meta({ governanceState: 'draft', computeRunId, confidenceState: 'unknown' }),
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// api_financials_005: GET /unit-economics
// Table: unit_economics_projections
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/unit-economics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!requireCompanyId(ctx, req, res)) return;

    const { where, params } = buildContextFilter(ctx);

    const { rows } = await db.query(
      `SELECT t.metric_name, t.period_id, t.value, t.currency,
              t.dimension_signatures, t.is_provisional,
              pp.label AS period_label, pp.grain, pp.fiscal_year, pp.fiscal_quarter
         FROM unit_economics_projections t
         LEFT JOIN planning_periods pp ON pp.id = t.period_id
         ${where}
        ORDER BY pp.sequence_number ASC NULLS LAST, t.metric_name ASC`,
      params,
    );

    const { periods, lineItems } = pivotProjectionRows(rows);
    const computeRunId = await latestComputeRunId(ctx.companyId!, ctx.scenarioId, ctx.versionId);

    res.json({
      data: { periods, lineItems },
      meta: meta({ governanceState: 'draft', computeRunId, confidenceState: 'unknown' }),
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// api_financials_006: GET /funding-summary
// Aggregates from cashflow_projections and balance_sheet_projections
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/funding-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!requireCompanyId(ctx, req, res)) return;

    const { where, params } = buildContextFilter(ctx);

    // Cash position from balance sheet
    const bsResult = await db.query(
      `SELECT t.metric_name, SUM(t.value) AS total
         FROM balance_sheet_projections t
         ${where}
         AND t.metric_name IN ('cash_and_equivalents', 'total_equity', 'total_debt')
        GROUP BY t.metric_name`,
      params,
    );

    // Burn/runway from cashflow
    const cfResult = await db.query(
      `SELECT t.metric_name, SUM(t.value) AS total
         FROM cashflow_projections t
         ${where}
         AND t.metric_name IN ('net_burn', 'runway_months', 'operating_cash_flow')
        GROUP BY t.metric_name`,
      params,
    );

    const bsMap = new Map(bsResult.rows.map((r: any) => [r.metric_name, parseFloat(r.total)]));
    const cfMap = new Map(cfResult.rows.map((r: any) => [r.metric_name, parseFloat(r.total)]));

    const computeRunId = await latestComputeRunId(ctx.companyId!, ctx.scenarioId, ctx.versionId);

    res.json({
      data: {
        cashPosition: bsMap.get('cash_and_equivalents') ?? null,
        totalEquity: bsMap.get('total_equity') ?? null,
        totalDebt: bsMap.get('total_debt') ?? null,
        burn: cfMap.get('net_burn') ?? null,
        runway: cfMap.get('runway_months') ?? null,
        operatingCashFlow: cfMap.get('operating_cash_flow') ?? null,
      },
      meta: meta({ governanceState: 'draft', computeRunId, confidenceState: 'unknown' }),
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// api_financials_007: GET /capital-strategy
// Aggregates from pnl + cashflow + balance_sheet projections
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/capital-strategy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!requireCompanyId(ctx, req, res)) return;

    const { where, params } = buildContextFilter(ctx);

    // Return metrics from multiple tables
    const pnlResult = await db.query(
      `SELECT t.metric_name, SUM(t.value) AS total
         FROM pnl_projections t
         ${where}
         AND t.metric_name IN ('revenue', 'ebitda', 'net_income', 'irr', 'roi', 'payback_months')
        GROUP BY t.metric_name`,
      params,
    );

    const cfResult = await db.query(
      `SELECT t.metric_name, SUM(t.value) AS total
         FROM cashflow_projections t
         ${where}
         AND t.metric_name IN ('total_capital_raised', 'total_capital_deployed', 'free_cash_flow')
        GROUP BY t.metric_name`,
      params,
    );

    const pnlMap = new Map(pnlResult.rows.map((r: any) => [r.metric_name, parseFloat(r.total)]));
    const cfMap = new Map(cfResult.rows.map((r: any) => [r.metric_name, parseFloat(r.total)]));

    const computeRunId = await latestComputeRunId(ctx.companyId!, ctx.scenarioId, ctx.versionId);

    res.json({
      data: {
        revenue: pnlMap.get('revenue') ?? null,
        ebitda: pnlMap.get('ebitda') ?? null,
        netIncome: pnlMap.get('net_income') ?? null,
        irr: pnlMap.get('irr') ?? null,
        roi: pnlMap.get('roi') ?? null,
        paybackMonths: pnlMap.get('payback_months') ?? null,
        totalCapitalRaised: cfMap.get('total_capital_raised') ?? null,
        totalCapitalDeployed: cfMap.get('total_capital_deployed') ?? null,
        freeCashFlow: cfMap.get('free_cash_flow') ?? null,
      },
      meta: meta({ governanceState: 'draft', computeRunId, confidenceState: 'unknown' }),
    });
  } catch (error) {
    next(error);
  }
});

// ─── Shared utility functions ────────────────────────────────────────────────

/** Pivot flat metric rows into { periods, lineItems } structure */
function pivotProjectionRows(rows: any[]) {
  const periodMap = new Map<string, any>();
  const lineMap = new Map<string, any[]>();

  for (const row of rows) {
    const pid = row.period_id || 'aggregate';
    if (!periodMap.has(pid)) {
      periodMap.set(pid, {
        periodId: row.period_id,
        label: row.period_label || 'Aggregate',
        grain: row.grain,
        fiscalYear: row.fiscal_year,
        fiscalQuarter: row.fiscal_quarter,
      });
    }
    if (!lineMap.has(row.metric_name)) {
      lineMap.set(row.metric_name, []);
    }
    lineMap.get(row.metric_name)!.push({
      periodId: pid,
      value: row.value ? parseFloat(row.value) : null,
      currency: row.currency,
      isProvisional: row.is_provisional,
    });
  }

  return {
    periods: Array.from(periodMap.values()),
    lineItems: Array.from(lineMap.entries()).map(([name, values]) => ({
      name,
      values,
      category: categorizeMetric(name),
    })),
  };
}

/** Simple heuristic to categorize a metric_name into a line-item category */
function categorizeMetric(metricName: string): string {
  if (metricName.includes('revenue') || metricName.includes('sales')) return 'revenue';
  if (metricName.includes('cogs') || metricName.includes('cost_of')) return 'cost_of_goods';
  if (metricName.includes('gross_profit')) return 'gross_profit';
  if (metricName.includes('opex') || metricName.includes('operating_expense')) return 'operating_expenses';
  if (metricName.includes('ebitda')) return 'ebitda';
  if (metricName.includes('depreciation') || metricName.includes('amortization')) return 'da';
  if (metricName.includes('interest') || metricName.includes('tax')) return 'below_ebitda';
  if (metricName.includes('net_income') || metricName.includes('net_profit')) return 'net_income';
  if (metricName.includes('cash') || metricName.includes('burn') || metricName.includes('runway')) return 'cash';
  if (metricName.includes('asset')) return 'assets';
  if (metricName.includes('liabilit') || metricName.includes('debt')) return 'liabilities';
  if (metricName.includes('equity')) return 'equity';
  return 'other';
}

export default router;
