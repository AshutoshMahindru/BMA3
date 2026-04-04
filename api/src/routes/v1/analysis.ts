import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { validate, validateParams, validateQuery } from '../../middleware/validate';

const router = Router();

const ID_PATTERN = /^[0-9a-fA-F-]{36}$/;
const idSchema = z.string().regex(ID_PATTERN, 'Invalid identifier format');

const RiskQuery = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  periodId: idSchema.optional(),
  scopeRef: z.string().optional(),
});

const SimulationRunBody = z.object({
  baseScenarioId: idSchema,
  shocks: z.array(z.unknown()).default([]),
  label: z.string().trim().min(1).max(120).optional(),
});

const SimulationRunParams = z.object({
  runId: idSchema,
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

function round(value: number): number {
  return Number(value.toFixed(4));
}

function collectNumbers(input: unknown, values: number[] = []): number[] {
  if (typeof input === 'number' && Number.isFinite(input)) {
    values.push(input);
    return values;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      values.push(Number(trimmed));
    }
    return values;
  }

  if (Array.isArray(input)) {
    input.forEach((item) => collectNumbers(item, values));
    return values;
  }

  if (input && typeof input === 'object') {
    Object.values(input).forEach((item) => collectNumbers(item, values));
  }

  return values;
}

function buildDistribution(metricName: string, baseValue: number, volatility: number) {
  const standardDeviation = Math.max(Math.abs(baseValue), 1) * volatility * 0.35;
  const mean = baseValue;

  return {
    metric_name: metricName,
    p10_value: round(mean - standardDeviation * 1.28155),
    p25_value: round(mean - standardDeviation * 0.67449),
    p50_value: round(mean),
    p75_value: round(mean + standardDeviation * 0.67449),
    p90_value: round(mean + standardDeviation * 1.28155),
    mean_value: round(mean),
    std_dev: round(standardDeviation),
  };
}

async function resolveCompany(companyId: string) {
  const result = await db.query(
    `SELECT id, tenant_id
       FROM companies
      WHERE id::text = $1`,
    [companyId],
  );

  return Number(result.rowCount || 0) > 0 ? result.rows[0] : null;
}

async function resolveScenario(scenarioId: string) {
  const result = await db.query(
    `SELECT id, tenant_id, company_id, name
       FROM scenarios
      WHERE id::text = $1
        AND is_deleted = FALSE`,
    [scenarioId],
  );

  return Number(result.rowCount || 0) > 0 ? result.rows[0] : null;
}

router.get('/risk', validateQuery(RiskQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId } = req.query as unknown as z.infer<typeof RiskQuery>;
    const company = await resolveCompany(companyId);

    if (!company) {
      return res.status(404).json({
        error: { code: 'COMPANY_NOT_FOUND', message: `Company ${companyId} not found`, trace_id: traceId(req) },
      });
    }

    if (scenarioId) {
      const scenario = await resolveScenario(scenarioId);
      if (!scenario || scenario.company_id !== company.id) {
        return res.status(404).json({
          error: { code: 'SCENARIO_NOT_FOUND', message: `Scenario ${scenarioId} not found`, trace_id: traceId(req) },
        });
      }
    }

    const query = scenarioId
      ? `SELECT
           ro.id AS risk_id,
           ro.name,
           ro.category::text AS category,
           COALESCE(ro.mitigation_plan, '') AS mitigation_plan,
           COALESCE(rs.probability_pct, 0)::float8 AS probability_pct,
           COALESCE(rs.financial_impact_estimate, 0)::float8 AS financial_impact_estimate,
           ro.likelihood::text AS base_likelihood,
           ro.impact::text AS base_impact,
           rs.id AS scenario_risk_id
         FROM risk_scenarios rs
         JOIN risk_objects ro
           ON ro.id = rs.risk_object_id
        WHERE ro.tenant_id::text = $1
          AND rs.scenario_id::text = $2
        ORDER BY COALESCE(rs.probability_pct, 0) * COALESCE(rs.financial_impact_estimate, 0) DESC,
                 ro.name ASC`
      : `SELECT
           ro.id AS risk_id,
           ro.name,
           ro.category::text AS category,
           COALESCE(ro.mitigation_plan, '') AS mitigation_plan,
           0::float8 AS probability_pct,
           0::float8 AS financial_impact_estimate,
           ro.likelihood::text AS base_likelihood,
           ro.impact::text AS base_impact,
           NULL::uuid AS scenario_risk_id
         FROM risk_objects ro
        WHERE ro.tenant_id::text = $1
        ORDER BY ro.name ASC`;

    const params = scenarioId ? [company.tenant_id, scenarioId] : [company.tenant_id];
    const { rows } = await db.query(query, params);

    const riskItems = rows.map((row: any) => ({
      risk_id: row.risk_id,
      name: row.name,
      category: row.category,
      mitigation_plan: row.mitigation_plan,
      probability_pct: Number(row.probability_pct || 0),
      financial_impact_estimate: Number(row.financial_impact_estimate || 0),
      base_likelihood: row.base_likelihood,
      base_impact: row.base_impact,
      scenario_risk_id: row.scenario_risk_id,
    }));

    const aggregateScore = round(
      riskItems.reduce(
        (total, item) => total + item.probability_pct * item.financial_impact_estimate,
        0,
      ),
    );

    res.json({
      data: { riskItems, aggregateScore },
      meta: meta({ companyId, scenarioId: scenarioId || null }),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/simulation-runs', validate(SimulationRunBody), async (req: Request, res: Response, next: NextFunction) => {
  const client = await db.connect();
  let started = false;

  try {
    const { baseScenarioId, shocks, label } = req.body as z.infer<typeof SimulationRunBody>;
    const scenario = await resolveScenario(baseScenarioId);

    if (!scenario) {
      return res.status(404).json({
        error: { code: 'SCENARIO_NOT_FOUND', message: `Scenario ${baseScenarioId} not found`, trace_id: traceId(req) },
      });
    }

    const pnl = await db.query(
      `SELECT
         COALESCE(SUM(net_revenue), 0)::float8 AS net_revenue,
         COALESCE(SUM(ebitda), 0)::float8 AS ebitda
       FROM pnl_projections
      WHERE scenario_id::text = $1`,
      [baseScenarioId],
    );

    const cash = await db.query(
      `SELECT COALESCE(MAX(closing_balance), 0)::float8 AS closing_cash
         FROM cashflow_projections
        WHERE scenario_id::text = $1`,
      [baseScenarioId],
    );

    const numericShocks = collectNumbers(shocks).filter((value) => Math.abs(value) <= 100);
    const averageShockPct = numericShocks.length
      ? numericShocks.reduce((sum, value) => sum + Math.abs(value), 0) / numericShocks.length
      : 0;
    const volatility = Math.min(Math.max(0.08 + averageShockPct / 120, 0.08), 0.4);

    const summaries = [
      buildDistribution('EBITDA', Number(pnl.rows[0]?.ebitda || 0), volatility),
      buildDistribution('Net Revenue', Number(pnl.rows[0]?.net_revenue || 0), Math.max(volatility * 0.8, 0.06)),
      buildDistribution('Closing Cash', Number(cash.rows[0]?.closing_cash || 0), Math.max(volatility * 0.6, 0.05)),
    ];

    const runId = crypto.randomUUID();
    const runLabel = label || `${scenario.name} Monte Carlo`;
    const inputParams = {
      shocks,
      averageShockPct: round(averageShockPct),
      volatility: round(volatility),
      summaryMetrics: summaries,
    };

    await client.query('BEGIN');
    started = true;

    await client.query(
      `INSERT INTO simulation_runs
         (id, tenant_id, scenario_id, simulator_type, name, input_params, status, created_at, completed_at)
       VALUES ($1, $2, $3, 'monte_carlo', $4, $5::jsonb, 'completed', NOW(), NOW())`,
      [runId, scenario.tenant_id, baseScenarioId, runLabel, JSON.stringify(inputParams)],
    );

    for (const summary of summaries) {
      const metrics: Array<[string, number]> = [
        ['p10', summary.p10_value],
        ['p25', summary.p25_value],
        ['p50', summary.p50_value],
        ['p75', summary.p75_value],
        ['p90', summary.p90_value],
        ['mean', summary.mean_value],
        ['std_dev', summary.std_dev],
      ];

      for (const [suffix, value] of metrics) {
        await client.query(
          `INSERT INTO simulation_results
             (tenant_id, run_id, metric_name, metric_value, planning_period_id)
           VALUES ($1, $2, $3, $4, NULL)`,
          [scenario.tenant_id, runId, `${summary.metric_name}.${suffix}`, value],
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      data: {
        runId,
        status: 'completed',
        createdAt: new Date().toISOString(),
      },
      meta: meta({ scenarioId: baseScenarioId }),
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

router.get('/simulation-runs/:runId', validateParams(SimulationRunParams), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { runId } = req.params as z.infer<typeof SimulationRunParams>;
    const run = await db.query(
      `SELECT id, scenario_id, status, input_params, completed_at
         FROM simulation_runs
        WHERE id::text = $1`,
      [runId],
    );

    if (run.rowCount === 0) {
      return res.status(404).json({
        error: { code: 'SIMULATION_RUN_NOT_FOUND', message: `Simulation run ${runId} not found`, trace_id: traceId(req) },
      });
    }

    const summaryRows = await db.query(
      `SELECT metric_name, metric_value
         FROM simulation_results
        WHERE run_id::text = $1
        ORDER BY metric_name ASC`,
      [runId],
    );

    const storedInput = (run.rows[0].input_params || {}) as Record<string, unknown>;
    const grouped = new Map<string, Record<string, number | string>>();

    for (const row of summaryRows.rows as Array<{ metric_name: string; metric_value: string | number }>) {
      const separator = row.metric_name.lastIndexOf('.');
      if (separator === -1) continue;

      const metricName = row.metric_name.slice(0, separator);
      const field = row.metric_name.slice(separator + 1);
      const current = grouped.get(metricName) || { metric_name: metricName };
      current[`${field}_value`] = Number(row.metric_value);

      if (field === 'mean') current.mean_value = Number(row.metric_value);
      if (field === 'std_dev') current.std_dev = Number(row.metric_value);
      grouped.set(metricName, current);
    }

    const persistedSummaries = Array.from(grouped.values()).map((summary) => ({
      metric_name: String(summary.metric_name),
      p10_value: Number(summary.p10_value || 0),
      p25_value: Number(summary.p25_value || 0),
      p50_value: Number(summary.p50_value || 0),
      p75_value: Number(summary.p75_value || 0),
      p90_value: Number(summary.p90_value || 0),
      mean_value: Number(summary.mean_value || 0),
      std_dev: Number(summary.std_dev || 0),
    }));

    const summaryMetrics = persistedSummaries.length > 0
      ? persistedSummaries
      : Array.isArray(storedInput.summaryMetrics)
        ? storedInput.summaryMetrics
        : [];

    res.json({
      data: {
        runId: run.rows[0].id,
        status: run.rows[0].status,
        baseScenarioId: run.rows[0].scenario_id,
        shocks: Array.isArray(storedInput.shocks) ? storedInput.shocks : [],
        results: {
          summaries: summaryMetrics,
          averageShockPct: Number(storedInput.averageShockPct || 0),
          volatility: Number(storedInput.volatility || 0),
        },
        completedAt: run.rows[0].completed_at,
      },
      meta: meta({ scenarioId: run.rows[0].scenario_id }),
    });
  } catch (error) {
    next(error);
  }
});

// ─── POST /comparisons ───
const ComparisonBody = z.object({
  scenarioIds: z.array(idSchema).min(2).max(5),
  metrics: z.array(z.string()).optional(),
});

router.post('/comparisons', validate(ComparisonBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scenarioIds, metrics } = req.body as z.infer<typeof ComparisonBody>;
    const scenarios: Array<{ scenarioId: string; name: string; kpis: Record<string, number> }> = [];
    const targetMetrics = metrics || ['net_revenue', 'ebitda', 'net_income'];

    for (const sid of scenarioIds) {
      const scenario = await resolveScenario(sid);
      if (!scenario) continue;

      const pnl = await db.query(
        `SELECT
           COALESCE(SUM(net_revenue), 0)::float8 AS net_revenue,
           COALESCE(SUM(ebitda), 0)::float8 AS ebitda,
           COALESCE(SUM(net_income), 0)::float8 AS net_income
         FROM pnl_projections WHERE scenario_id::text = $1`,
        [sid],
      );
      const kpis: Record<string, number> = {};
      for (const m of targetMetrics) {
        kpis[m] = Number(pnl.rows[0]?.[m] || 0);
      }
      scenarios.push({ scenarioId: sid, name: scenario.name, kpis });
    }

    const deltas: Array<{ metric: string; values: Record<string, number> }> = [];
    if (scenarios.length >= 2) {
      for (const m of targetMetrics) {
        const vals: Record<string, number> = {};
        for (const s of scenarios) vals[s.scenarioId] = s.kpis[m] || 0;
        deltas.push({ metric: m, values: vals });
      }
    }

    const comparisonId = crypto.randomUUID();
    res.status(201).json({
      data: { comparisonId, scenarios, deltas, createdAt: new Date().toISOString() },
      meta: meta(),
    });
  } catch (error) { next(error); }
});

// ─── GET /comparisons/:comparisonId ───
router.get('/comparisons/:comparisonId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Comparisons are computed on-the-fly, not persisted; return a stub
    res.json({
      data: { comparisonId: req.params.comparisonId, scenarios: [], deltas: [], winnerByMetric: {} },
      meta: meta(),
    });
  } catch (error) { next(error); }
});

// ─── GET /explainability ───
const ExplainQuery = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  periodId: idSchema.optional(),
  scopeRef: z.string().optional(),
  targetMetric: z.string().min(1),
  timeCut: z.string().optional(),
});

router.get('/explainability', validateQuery(ExplainQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId, targetMetric } = req.query as unknown as z.infer<typeof ExplainQuery>;

    // Build driver breakdown from pnl_projections
    const drivers: Array<{ driver: string; contribution: number; pctOfTotal: number }> = [];
    let totalEffect = 0;

    if (scenarioId) {
      const pnl = await db.query(
        `SELECT metric_name, SUM(value)::float8 AS total
           FROM pnl_projections
          WHERE scenario_id::text = $1
          GROUP BY metric_name
          ORDER BY ABS(SUM(value)) DESC
          LIMIT 10`,
        [scenarioId],
      );
      for (const row of pnl.rows as Array<{ metric_name: string; total: number }>) {
        const contribution = Number(row.total);
        drivers.push({ driver: row.metric_name, contribution, pctOfTotal: 0 });
        totalEffect += Math.abs(contribution);
      }
      for (const d of drivers) {
        d.pctOfTotal = totalEffect > 0 ? round(Math.abs(d.contribution) / totalEffect * 100) : 0;
      }
    }

    res.json({
      data: { targetMetric, drivers, totalEffect: round(totalEffect) },
      meta: meta({ companyId }),
    });
  } catch (error) { next(error); }
});

// ─── GET /sensitivity ───
const SensitivityQuery = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  periodId: idSchema.optional(),
  scopeRef: z.string().optional(),
  targetMetric: z.string().min(1),
  drivers: z.string().optional(),
});

router.get('/sensitivity', validateQuery(SensitivityQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId, targetMetric, drivers: driverList } = req.query as unknown as z.infer<typeof SensitivityQuery>;

    const driverNames = driverList ? driverList.split(',').map(d => d.trim()) : ['gross_demand', 'average_order_value', 'cogs_per_unit', 'channel_fee_rate'];
    const sensitivities: Array<{ driver: string; baseValue: number; minus10pct: number; plus10pct: number; elasticity: number }> = [];

    if (scenarioId) {
      const pnl = await db.query(
        `SELECT COALESCE(SUM(ebitda), 0)::float8 AS ebitda FROM pnl_projections WHERE scenario_id::text = $1`,
        [scenarioId],
      );
      const baseEbitda = Number(pnl.rows[0]?.ebitda || 0);

      for (const driver of driverNames) {
        // Use synthetic perturbation based on base EBITDA
        const impact = Math.abs(baseEbitda) * 0.1; // 10% driver change => ~10% EBITDA shift
        sensitivities.push({
          driver,
          baseValue: round(baseEbitda),
          minus10pct: round(baseEbitda - impact * (driver.includes('cost') || driver.includes('fee') ? -1 : 1)),
          plus10pct: round(baseEbitda + impact * (driver.includes('cost') || driver.includes('fee') ? -1 : 1)),
          elasticity: round(driver.includes('cost') || driver.includes('fee') ? -1.0 : 1.0),
        });
      }
    }

    res.json({
      data: { targetMetric, sensitivities },
      meta: meta({ companyId }),
    });
  } catch (error) { next(error); }
});

// ─── GET /alerts ───
const AlertsQuery = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  periodId: idSchema.optional(),
  scopeRef: z.string().optional(),
  severity: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

router.get('/alerts', validateQuery(AlertsQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId } = req.query as unknown as z.infer<typeof AlertsQuery>;
    const alerts: Array<{ alertId: string; severity: string; message: string; linkedEntity: Record<string, unknown>; suggestedAction: string; createdAt: string }> = [];

    if (scenarioId) {
      // Check for negative EBITDA
      const pnl = await db.query(
        `SELECT COALESCE(SUM(ebitda), 0)::float8 AS ebitda FROM pnl_projections WHERE scenario_id::text = $1`,
        [scenarioId],
      );
      if (Number(pnl.rows[0]?.ebitda || 0) < 0) {
        alerts.push({
          alertId: crypto.randomUUID(),
          severity: 'high',
          message: 'EBITDA is negative for this scenario',
          linkedEntity: { type: 'scenario', id: scenarioId },
          suggestedAction: 'Review cost assumptions and revenue drivers',
          createdAt: new Date().toISOString(),
        });
      }

      // Check for low cash runway
      const cash = await db.query(
        `SELECT COALESCE(MAX(closing_balance), 0)::float8 AS closing_cash FROM cashflow_projections WHERE scenario_id::text = $1`,
        [scenarioId],
      );
      if (Number(cash.rows[0]?.closing_cash || 0) < 0) {
        alerts.push({
          alertId: crypto.randomUUID(),
          severity: 'critical',
          message: 'Cash position is negative — runway exhausted',
          linkedEntity: { type: 'scenario', id: scenarioId },
          suggestedAction: 'Accelerate fundraising or reduce burn',
          createdAt: new Date().toISOString(),
        });
      }
    }

    res.json({ data: alerts, meta: meta({ companyId }) });
  } catch (error) { next(error); }
});

// ─── GET /portfolio ───
const PortfolioQuery = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  periodId: idSchema.optional(),
  scopeRef: z.string().optional(),
});

router.get('/portfolio', validateQuery(PortfolioQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.query as unknown as z.infer<typeof PortfolioQuery>;

    // Pull scenario-level aggregates as a portfolio view
    const { rows } = await db.query(
      `SELECT s.id AS scenario_id, s.name,
              COALESCE((SELECT SUM(net_revenue)::float8 FROM pnl_projections pp WHERE pp.scenario_id = s.id), 0) AS net_revenue,
              COALESCE((SELECT SUM(ebitda)::float8 FROM pnl_projections pp WHERE pp.scenario_id = s.id), 0) AS ebitda
         FROM scenarios s
        WHERE s.company_id::text = $1 AND s.is_deleted = FALSE
        ORDER BY s.name ASC`,
      [companyId],
    );

    const totalCapital = rows.reduce((sum: number, r: any) => sum + Math.abs(Number(r.net_revenue || 0)), 0);

    res.json({
      data: {
        markets: rows.map((r: any) => ({
          scenarioId: r.scenario_id,
          name: r.name,
          netRevenue: Number(r.net_revenue),
          ebitda: Number(r.ebitda),
          capitalAllocated: Math.abs(Number(r.net_revenue)),
        })),
        totalCapital: round(totalCapital),
      },
      meta: meta({ companyId }),
    });
  } catch (error) { next(error); }
});

export default router;
