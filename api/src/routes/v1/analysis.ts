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
    const { companyId, scenarioId } = req.query as z.infer<typeof RiskQuery>;
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

export default router;
