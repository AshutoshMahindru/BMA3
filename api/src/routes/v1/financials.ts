import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';

const router = Router();

function traceId(req: Request): string {
  return (req.headers['x-trace-id'] as string) || 'no-trace-id';
}

function meta(extra?: Record<string, unknown>) {
  return {
    freshness: { source: 'database', timestamp: new Date().toISOString() },
    ...(extra || {}),
  };
}

function planningContext(query: Record<string, unknown>) {
  return {
    companyId: query.companyId as string | undefined,
    scenarioId: query.scenarioId as string | undefined,
    versionId: query.versionId as string | undefined,
    periodId: query.periodId as string | undefined,
    scopeRef: query.scopeRef as string | undefined,
    granularity: query.granularity as string | undefined,
  };
}

function requireCompanyId(ctx: ReturnType<typeof planningContext>, req: Request, res: Response): boolean {
  if (!ctx.companyId) {
    res.status(400).json({
      error: { code: 'MISSING_PLANNING_CONTEXT', message: 'companyId query parameter is required', trace_id: traceId(req) },
    });
    return false;
  }
  return true;
}

async function latestComputeRunId(companyId: string, scenarioId?: string, versionId?: string): Promise<string | null> {
  const params: any[] = [companyId];
  let idx = 2;
  let clauses = '';

  if (scenarioId) {
    clauses += ` AND scenario_id::text = $${idx++}`;
    params.push(scenarioId);
  }
  if (versionId) {
    clauses += ` AND version_id::text = $${idx++}`;
    params.push(versionId);
  }

  const result = await db.query(
    `SELECT id
       FROM compute_runs
      WHERE company_id::text = $1
        AND status = 'completed'
        ${clauses}
      ORDER BY completed_at DESC NULLS LAST, created_at DESC
      LIMIT 1`,
    params,
  );

  return result.rows[0]?.id || null;
}

async function loadPeriods(companyId: string) {
  const { rows } = await db.query(
    `SELECT pp.id AS period_id, pp.name AS label, pp.sequence_order
       FROM planning_periods pp
       JOIN planning_calendars pc ON pc.id = pp.calendar_id
      WHERE pc.company_id::text = $1
        AND pc.is_deleted = FALSE
        AND pp.is_deleted = FALSE
      ORDER BY pp.sequence_order ASC`,
    [companyId],
  );

  return rows;
}

function safeNumber(value: unknown): number {
  return Number(value || 0);
}

function absoluteRow(values: number[]) {
  return values.map((value) => Math.abs(value));
}

async function loadPnlSeries(companyId: string, scenarioId?: string) {
  const periods = await loadPeriods(companyId);
  const { rows } = await db.query(
    `SELECT pp.id AS period_id, pp.name AS label, pp.sequence_order,
            COALESCE(SUM(t.gross_revenue), 0) AS gross_revenue,
            COALESCE(SUM(t.platform_commission), 0) AS platform_commission,
            COALESCE(SUM(t.net_revenue), 0) AS net_revenue,
            COALESCE(SUM(t.cogs_total), 0) AS cogs_total,
            COALESCE(SUM(t.gross_profit), 0) AS gross_profit,
            COALESCE(SUM(t.labor_cost), 0) AS labor_cost,
            COALESCE(SUM(t.marketing_cost), 0) AS marketing_cost,
            COALESCE(SUM(t.opex_total), 0) AS opex_total,
            COALESCE(SUM(t.ebitda), 0) AS ebitda,
            COALESCE(SUM(t.depreciation), 0) AS depreciation,
            COALESCE(SUM(t.interest_expense), 0) AS interest_expense,
            COALESCE(SUM(t.net_income), 0) AS net_income
       FROM planning_periods pp
       JOIN planning_calendars pc
         ON pc.id = pp.calendar_id
        AND pc.company_id::text = $1
        AND pc.is_deleted = FALSE
       LEFT JOIN pnl_projections t
         ON t.planning_period_id = pp.id
        AND ($2::text IS NULL OR t.scenario_id::text = $2)
      WHERE pp.is_deleted = FALSE
      GROUP BY pp.id, pp.name, pp.sequence_order
      ORDER BY pp.sequence_order ASC`,
    [companyId, scenarioId || null],
  );

  return rows.length > 0 ? rows : periods.map((period: any) => ({
    period_id: period.period_id,
    label: period.label,
    sequence_order: period.sequence_order,
    gross_revenue: 0,
    platform_commission: 0,
    net_revenue: 0,
    cogs_total: 0,
    gross_profit: 0,
    labor_cost: 0,
    marketing_cost: 0,
    opex_total: 0,
    ebitda: 0,
    depreciation: 0,
    interest_expense: 0,
    net_income: 0,
  }));
}

async function loadCashflowSeries(companyId: string, scenarioId?: string) {
  return db.query(
    `SELECT pp.id AS period_id, pp.name AS label, pp.sequence_order,
            COALESCE(SUM(t.opening_balance), 0) AS opening_balance,
            COALESCE(SUM(t.operating_cashflow), 0) AS operating_cashflow,
            COALESCE(SUM(t.investing_cashflow), 0) AS investing_cashflow,
            COALESCE(SUM(t.financing_cashflow), 0) AS financing_cashflow,
            COALESCE(SUM(t.net_change), 0) AS net_change,
            COALESCE(SUM(t.closing_balance), 0) AS closing_balance,
            COALESCE(MAX(t.cash_runway_months), 0) AS cash_runway_months
       FROM planning_periods pp
       JOIN planning_calendars pc
         ON pc.id = pp.calendar_id
        AND pc.company_id::text = $1
        AND pc.is_deleted = FALSE
       LEFT JOIN cashflow_projections t
         ON t.planning_period_id = pp.id
        AND ($2::text IS NULL OR t.scenario_id::text = $2)
      WHERE pp.is_deleted = FALSE
      GROUP BY pp.id, pp.name, pp.sequence_order
      ORDER BY pp.sequence_order ASC`,
    [companyId, scenarioId || null],
  );
}

async function loadBalanceSheetSeries(companyId: string, scenarioId?: string) {
  return db.query(
    `SELECT pp.id AS period_id, pp.name AS label, pp.sequence_order,
            COALESCE(SUM(t.cash_assets), 0) AS cash_assets,
            COALESCE(SUM(t.inventory_assets), 0) AS inventory_assets,
            COALESCE(SUM(t.receivables), 0) AS receivables,
            COALESCE(SUM(t.fixed_assets_net), 0) AS fixed_assets_net,
            COALESCE(SUM(t.total_assets), 0) AS total_assets,
            COALESCE(SUM(t.accounts_payable), 0) AS accounts_payable,
            COALESCE(SUM(t.short_term_debt), 0) AS short_term_debt,
            COALESCE(SUM(t.long_term_debt), 0) AS long_term_debt,
            COALESCE(SUM(t.total_liabilities), 0) AS total_liabilities,
            COALESCE(SUM(t.paid_in_capital), 0) AS paid_in_capital,
            COALESCE(SUM(t.retained_earnings), 0) AS retained_earnings,
            COALESCE(SUM(t.total_equity), 0) AS total_equity
       FROM planning_periods pp
       JOIN planning_calendars pc
         ON pc.id = pp.calendar_id
        AND pc.company_id::text = $1
        AND pc.is_deleted = FALSE
       LEFT JOIN balance_sheet_projections t
         ON t.planning_period_id = pp.id
        AND ($2::text IS NULL OR t.scenario_id::text = $2)
      WHERE pp.is_deleted = FALSE
      GROUP BY pp.id, pp.name, pp.sequence_order
      ORDER BY pp.sequence_order ASC`,
    [companyId, scenarioId || null],
  );
}

function buildLineItem(label: string, values: number[], options?: { negative?: boolean; highlight?: string; pctRow?: boolean; bold?: boolean }) {
  const normalized = options?.negative ? absoluteRow(values) : values;
  const fy = options?.pctRow
    ? (normalized.length ? normalized[normalized.length - 1] : 0)
    : normalized.reduce((sum, value) => sum + value, 0);

  return {
    label,
    values: normalized,
    fy,
    negative: options?.negative,
    highlight: options?.highlight,
    pctRow: options?.pctRow,
    bold: options?.bold,
  };
}

function buildPnlPayload(rows: any[]) {
  const periods = rows.map((row) => row.label);

  const grossRevenue = rows.map((row) => safeNumber(row.gross_revenue));
  const platformCommission = rows.map((row) => safeNumber(row.platform_commission));
  const netRevenue = rows.map((row) => safeNumber(row.net_revenue));
  const cogs = rows.map((row) => safeNumber(row.cogs_total));
  const grossProfit = rows.map((row) => safeNumber(row.gross_profit));
  const labor = rows.map((row) => safeNumber(row.labor_cost));
  const marketing = rows.map((row) => safeNumber(row.marketing_cost));
  const opex = rows.map((row) => safeNumber(row.opex_total));
  const ebitda = rows.map((row) => safeNumber(row.ebitda));
  const depreciation = rows.map((row) => safeNumber(row.depreciation));
  const interest = rows.map((row) => safeNumber(row.interest_expense));
  const ebitdaMargin = rows.map((row) => {
    const revenue = safeNumber(row.net_revenue);
    return revenue === 0 ? 0 : (safeNumber(row.ebitda) / revenue) * 100;
  });
  const netIncome = rows.map((row) => safeNumber(row.net_income));

  return {
    periods,
    lineItems: [
      buildLineItem('Gross Revenue', grossRevenue, { bold: true }),
      buildLineItem('Platform Commission', platformCommission, { negative: true }),
      buildLineItem('Net Revenue', netRevenue, { highlight: 'subtotal', bold: true }),
      buildLineItem('COGS', cogs, { negative: true }),
      buildLineItem('Gross Profit', grossProfit, { highlight: 'subtotal', bold: true }),
      buildLineItem('Labor Cost', labor, { negative: true }),
      buildLineItem('Marketing Cost', marketing, { negative: true }),
      buildLineItem('Opex', opex, { negative: true }),
      buildLineItem('EBITDA', ebitda, { highlight: 'ebitda', bold: true }),
      buildLineItem('Depreciation', depreciation, { negative: true }),
      buildLineItem('Interest Expense', interest, { negative: true }),
      buildLineItem('EBITDA Margin %', ebitdaMargin, { pctRow: true }),
      buildLineItem('Net Income', netIncome, { bold: true }),
    ],
  };
}

async function loadEbitdaBridge(scenarioId?: string) {
  if (!scenarioId) return [];

  const { rows } = await db.query(
    `SELECT driver_name, COALESCE(SUM(impact_amount), 0) AS impact
       FROM driver_explainability
      WHERE scenario_id::text = $1
      GROUP BY driver_name
      ORDER BY driver_name ASC`,
    [scenarioId],
  );

  return rows.map((row: any) => ({
    label: row.driver_name,
    value: safeNumber(row.impact),
    positive: safeNumber(row.impact) >= 0,
  }));
}

router.get('/executive-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!requireCompanyId(ctx, req, res)) return;

    const pnlResult = await db.query(
      `SELECT COALESCE(SUM(t.net_revenue), 0) AS revenue,
              COALESCE(SUM(t.gross_profit), 0) AS gross_profit,
              COALESCE(SUM(t.ebitda), 0) AS ebitda,
              COALESCE(SUM(t.net_income), 0) AS net_income
         FROM pnl_projections t
         JOIN scenarios s ON s.id = t.scenario_id
        WHERE s.company_id::text = $1
          AND ($2::text IS NULL OR t.scenario_id::text = $2)`,
      [ctx.companyId, ctx.scenarioId || null],
    );

    const cashResult = await db.query(
      `SELECT COALESCE(AVG(GREATEST(-t.net_change, 0)), 0) AS burn,
              COALESCE(MAX(t.cash_runway_months), 0) AS runway
         FROM cashflow_projections t
         JOIN scenarios s ON s.id = t.scenario_id
        WHERE s.company_id::text = $1
          AND ($2::text IS NULL OR t.scenario_id::text = $2)`,
      [ctx.companyId, ctx.scenarioId || null],
    );

    const computeRunId = await latestComputeRunId(ctx.companyId!, ctx.scenarioId, ctx.versionId);

    res.json({
      data: {
        revenue: safeNumber(pnlResult.rows[0]?.revenue),
        grossProfit: safeNumber(pnlResult.rows[0]?.gross_profit),
        ebitda: safeNumber(pnlResult.rows[0]?.ebitda),
        netIncome: safeNumber(pnlResult.rows[0]?.net_income),
        burn: safeNumber(cashResult.rows[0]?.burn),
        runway: safeNumber(cashResult.rows[0]?.runway),
        irr: 0,
        periodLabel: 'All Seeded Periods',
      },
      meta: meta({ governanceState: 'draft', computeRunId, confidenceState: 'unknown' }),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/pnl', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!requireCompanyId(ctx, req, res)) return;

    const rows = await loadPnlSeries(ctx.companyId!, ctx.scenarioId);
    const computeRunId = await latestComputeRunId(ctx.companyId!, ctx.scenarioId, ctx.versionId);

    res.json({
      data: {
        ...buildPnlPayload(rows),
        ebitdaBridge: await loadEbitdaBridge(ctx.scenarioId),
      },
      meta: meta({ governanceState: 'draft', computeRunId, confidenceState: 'unknown' }),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/cash-flow', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!requireCompanyId(ctx, req, res)) return;

    const result = await loadCashflowSeries(ctx.companyId!, ctx.scenarioId);
    const periods = result.rows.map((row: any) => row.label);
    const computeRunId = await latestComputeRunId(ctx.companyId!, ctx.scenarioId, ctx.versionId);

    res.json({
      data: {
        periods,
        lineItems: [
          buildLineItem('Opening Balance', result.rows.map((row: any) => safeNumber(row.opening_balance)), { bold: true }),
          buildLineItem('Operating Cashflow', result.rows.map((row: any) => safeNumber(row.operating_cashflow))),
          buildLineItem('Investing Cashflow', result.rows.map((row: any) => safeNumber(row.investing_cashflow))),
          buildLineItem('Financing Cashflow', result.rows.map((row: any) => safeNumber(row.financing_cashflow))),
          buildLineItem('Net Change', result.rows.map((row: any) => safeNumber(row.net_change)), { highlight: 'subtotal', bold: true }),
          buildLineItem('Closing Balance', result.rows.map((row: any) => safeNumber(row.closing_balance)), { highlight: 'subtotal', bold: true }),
          buildLineItem('Cash Runway Months', result.rows.map((row: any) => safeNumber(row.cash_runway_months)), { pctRow: false }),
        ],
      },
      meta: meta({ governanceState: 'draft', computeRunId, confidenceState: 'unknown' }),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/balance-sheet', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!requireCompanyId(ctx, req, res)) return;

    const result = await loadBalanceSheetSeries(ctx.companyId!, ctx.scenarioId);
    const periods = result.rows.map((row: any) => row.label);
    const computeRunId = await latestComputeRunId(ctx.companyId!, ctx.scenarioId, ctx.versionId);

    res.json({
      data: {
        periods,
        lineItems: [
          buildLineItem('Cash Assets', result.rows.map((row: any) => safeNumber(row.cash_assets))),
          buildLineItem('Inventory Assets', result.rows.map((row: any) => safeNumber(row.inventory_assets))),
          buildLineItem('Receivables', result.rows.map((row: any) => safeNumber(row.receivables))),
          buildLineItem('Fixed Assets Net', result.rows.map((row: any) => safeNumber(row.fixed_assets_net))),
          buildLineItem('Total Assets', result.rows.map((row: any) => safeNumber(row.total_assets)), { highlight: 'subtotal', bold: true }),
          buildLineItem('Accounts Payable', result.rows.map((row: any) => safeNumber(row.accounts_payable))),
          buildLineItem('Short-Term Debt', result.rows.map((row: any) => safeNumber(row.short_term_debt))),
          buildLineItem('Long-Term Debt', result.rows.map((row: any) => safeNumber(row.long_term_debt))),
          buildLineItem('Total Liabilities', result.rows.map((row: any) => safeNumber(row.total_liabilities)), { highlight: 'subtotal', bold: true }),
          buildLineItem('Paid In Capital', result.rows.map((row: any) => safeNumber(row.paid_in_capital))),
          buildLineItem('Retained Earnings', result.rows.map((row: any) => safeNumber(row.retained_earnings))),
          buildLineItem('Total Equity', result.rows.map((row: any) => safeNumber(row.total_equity)), { highlight: 'subtotal', bold: true }),
        ],
      },
      meta: meta({ governanceState: 'draft', computeRunId, confidenceState: 'unknown' }),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/unit-economics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!requireCompanyId(ctx, req, res)) return;

    const { rows } = await db.query(
      `SELECT pp.name AS label, pp.sequence_order,
              COALESCE(AVG(t.aov), 0) AS aov,
              COALESCE(AVG(t.cac), 0) AS cac,
              COALESCE(AVG(t.clv), 0) AS clv,
              COALESCE(AVG(t.orders_per_day), 0) AS orders_per_day,
              COALESCE(AVG(t.contribution_margin_1), 0) AS contribution_margin_1,
              COALESCE(AVG(t.contribution_margin_2), 0) AS contribution_margin_2,
              COALESCE(AVG(t.ebitda_per_order), 0) AS ebitda_per_order,
              COALESCE(AVG(t.payback_months), 0) AS payback_months
         FROM planning_periods pp
         JOIN planning_calendars pc
           ON pc.id = pp.calendar_id
          AND pc.company_id::text = $1
          AND pc.is_deleted = FALSE
         LEFT JOIN unit_economics_projections t
           ON t.planning_period_id = pp.id
          AND ($2::text IS NULL OR t.scenario_id::text = $2)
        WHERE pp.is_deleted = FALSE
        GROUP BY pp.name, pp.sequence_order
        ORDER BY pp.sequence_order ASC`,
      [ctx.companyId, ctx.scenarioId || null],
    );

    const computeRunId = await latestComputeRunId(ctx.companyId!, ctx.scenarioId, ctx.versionId);
    res.json({
      data: {
        periods: rows.map((row: any) => row.label),
        lineItems: [
          buildLineItem('AOV', rows.map((row: any) => safeNumber(row.aov)), { bold: true }),
          buildLineItem('CAC', rows.map((row: any) => safeNumber(row.cac))),
          buildLineItem('CLV', rows.map((row: any) => safeNumber(row.clv))),
          buildLineItem('Orders / Day', rows.map((row: any) => safeNumber(row.orders_per_day))),
          buildLineItem('Contribution Margin 1', rows.map((row: any) => safeNumber(row.contribution_margin_1))),
          buildLineItem('Contribution Margin 2', rows.map((row: any) => safeNumber(row.contribution_margin_2))),
          buildLineItem('EBITDA / Order', rows.map((row: any) => safeNumber(row.ebitda_per_order))),
          buildLineItem('Payback Months', rows.map((row: any) => safeNumber(row.payback_months))),
        ],
      },
      meta: meta({ governanceState: 'draft', computeRunId, confidenceState: 'unknown' }),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/funding-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!requireCompanyId(ctx, req, res)) return;

    const cash = await db.query(
      `SELECT COALESCE(MAX(closing_balance), 0) AS current_cash,
              COALESCE(MAX(cash_runway_months), 0) AS runway_months,
              COALESCE(AVG(GREATEST(-net_change, 0)), 0) AS monthly_burn
         FROM cashflow_projections t
         JOIN scenarios s ON s.id = t.scenario_id
        WHERE s.company_id::text = $1
          AND ($2::text IS NULL OR t.scenario_id::text = $2)`,
      [ctx.companyId, ctx.scenarioId || null],
    );

    const balance = await db.query(
      `SELECT COALESCE(MAX(short_term_debt + long_term_debt), 0) AS total_debt,
              COALESCE(MAX(total_equity), 0) AS total_equity
         FROM balance_sheet_projections t
         JOIN scenarios s ON s.id = t.scenario_id
        WHERE s.company_id::text = $1
          AND ($2::text IS NULL OR t.scenario_id::text = $2)`,
      [ctx.companyId, ctx.scenarioId || null],
    );

    const monthlyBurn = safeNumber(cash.rows[0]?.monthly_burn);
    const currentCash = safeNumber(cash.rows[0]?.current_cash);

    res.json({
      data: {
        currentCash,
        runwayMonths: safeNumber(cash.rows[0]?.runway_months),
        monthlyBurn,
        totalDebt: safeNumber(balance.rows[0]?.total_debt),
        totalEquity: safeNumber(balance.rows[0]?.total_equity),
        recommendedRaise: Math.max((monthlyBurn * 6) - currentCash, 0),
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/capital-strategy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = planningContext(req.query);
    if (!requireCompanyId(ctx, req, res)) return;

    const funding = await db.query(
      `SELECT COALESCE(MAX(closing_balance), 0) AS current_cash,
              COALESCE(MAX(cash_runway_months), 0) AS runway_months,
              COALESCE(AVG(GREATEST(-net_change, 0)), 0) AS monthly_burn
         FROM cashflow_projections t
         JOIN scenarios s ON s.id = t.scenario_id
        WHERE s.company_id::text = $1
          AND ($2::text IS NULL OR t.scenario_id::text = $2)`,
      [ctx.companyId, ctx.scenarioId || null],
    );

    const balance = await db.query(
      `SELECT COALESCE(MAX(short_term_debt + long_term_debt), 0) AS total_debt,
              COALESCE(MAX(total_equity), 0) AS total_equity
         FROM balance_sheet_projections t
         JOIN scenarios s ON s.id = t.scenario_id
        WHERE s.company_id::text = $1
          AND ($2::text IS NULL OR t.scenario_id::text = $2)`,
      [ctx.companyId, ctx.scenarioId || null],
    );

    const currentCash = safeNumber(funding.rows[0]?.current_cash);
    const monthlyBurn = safeNumber(funding.rows[0]?.monthly_burn);
    const runwayMonths = safeNumber(funding.rows[0]?.runway_months);
    const totalDebt = safeNumber(balance.rows[0]?.total_debt);
    const totalEquity = safeNumber(balance.rows[0]?.total_equity);
    const recommendedRaise = Math.max((monthlyBurn * 9) - currentCash, 0);

    res.json({
      data: {
        currentCash,
        monthlyBurn,
        runwayMonths,
        debtCapacity: Math.max((totalEquity * 0.4) - totalDebt, 0),
        dilutionEstimatePct: totalEquity > 0 ? Math.min((recommendedRaise / totalEquity) * 100, 100) : 0,
        recommendedRaise,
        nextRaiseWindowMonths: runwayMonths > 6 ? Math.max(runwayMonths - 6, 0) : 0,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
