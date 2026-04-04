import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { validate, validateParams, validateQuery } from '../../middleware/validate';
import { idSchema, meta, paginate, safeNumber, stableUuidFromText, traceId } from './_shared';

const router = Router();

const PlanningQuery = z.object({
  companyId: idSchema,
  scenarioId: idSchema.optional(),
  versionId: idSchema.optional(),
  periodId: idSchema.optional(),
  scopeRef: idSchema.optional(),
});

const ExplainabilityQuery = PlanningQuery.extend({
  targetMetric: z.string().trim().min(1),
  timeCut: z.string().optional(),
});

const SensitivityQuery = PlanningQuery.extend({
  targetMetric: z.string().trim().min(1),
  drivers: z.string().optional(),
});

const AlertsQuery = PlanningQuery.extend({
  severity: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const ComparisonsBody = z.object({
  scenarioIds: z.array(idSchema).min(2).max(4),
  versionIds: z.array(idSchema).optional(),
  metrics: z.array(z.string().trim().min(1)).min(1),
  periodRange: z.record(z.string(), z.unknown()).optional(),
});

const ComparisonParams = z.object({
  comparisonId: idSchema,
});

const SimulationRunBody = z.object({
  baseScenarioId: idSchema,
  shocks: z.array(z.unknown()).default([]),
  label: z.string().trim().min(1).max(120).optional(),
});

const SimulationRunParams = z.object({
  runId: idSchema,
});

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
      WHERE id::text = $1
        AND is_deleted = FALSE`,
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

async function loadScenarioMetricValue(scenarioId: string, metric: string): Promise<number> {
  const normalized = metric.trim().toLowerCase();

  if (normalized === 'revenue' || normalized === 'net_revenue') {
    const result = await db.query(
      `SELECT COALESCE(SUM(net_revenue), 0)::float8 AS value
         FROM pnl_projections
        WHERE scenario_id::text = $1`,
      [scenarioId],
    );
    return safeNumber(result.rows[0]?.value);
  }

  if (normalized === 'ebitda') {
    const result = await db.query(
      `SELECT COALESCE(SUM(ebitda), 0)::float8 AS value
         FROM pnl_projections
        WHERE scenario_id::text = $1`,
      [scenarioId],
    );
    return safeNumber(result.rows[0]?.value);
  }

  if (normalized === 'net_income') {
    const result = await db.query(
      `SELECT COALESCE(SUM(net_income), 0)::float8 AS value
         FROM pnl_projections
        WHERE scenario_id::text = $1`,
      [scenarioId],
    );
    return safeNumber(result.rows[0]?.value);
  }

  if (normalized === 'cash' || normalized === 'closing_cash') {
    const result = await db.query(
      `SELECT COALESCE(MAX(closing_balance), 0)::float8 AS value
         FROM cashflow_projections
        WHERE scenario_id::text = $1`,
      [scenarioId],
    );
    return safeNumber(result.rows[0]?.value);
  }

  if (normalized === 'runway' || normalized === 'cash_runway') {
    const result = await db.query(
      `SELECT COALESCE(MAX(cash_runway_months), 0)::float8 AS value
         FROM cashflow_projections
        WHERE scenario_id::text = $1`,
      [scenarioId],
    );
    return safeNumber(result.rows[0]?.value);
  }

  if (normalized === 'total_assets') {
    const result = await db.query(
      `SELECT COALESCE(MAX(total_assets), 0)::float8 AS value
         FROM balance_sheet_projections
        WHERE scenario_id::text = $1`,
      [scenarioId],
    );
    return safeNumber(result.rows[0]?.value);
  }

  return 0;
}

async function buildComparisonPayload(scenarioIds: string[], metrics: string[]) {
  const scenarioRows = await db.query(
    `SELECT id, company_id, tenant_id, name
       FROM scenarios
      WHERE id = ANY($1::uuid[])
        AND is_deleted = FALSE
      ORDER BY created_at ASC`,
    [scenarioIds],
  );

  if (scenarioRows.rowCount !== scenarioIds.length) {
    return null;
  }

  const scenarioDetails = [];
  for (const row of scenarioRows.rows as Array<any>) {
    const metricValues: Record<string, number> = {};
    for (const metric of metrics) {
      metricValues[metric] = await loadScenarioMetricValue(row.id, metric);
    }
    scenarioDetails.push({
      scenarioId: row.id,
      name: row.name,
      metrics: metricValues,
      companyId: row.company_id,
      tenantId: row.tenant_id,
    });
  }

  const companyIds = Array.from(new Set(scenarioDetails.map((scenario) => scenario.companyId)));
  if (companyIds.length !== 1) {
    return null;
  }

  const base = scenarioDetails[0];
  const deltas = [];
  const winnerByMetric: Record<string, unknown> = {};

  for (const metric of metrics) {
    const sorted = [...scenarioDetails].sort((left, right) => right.metrics[metric] - left.metrics[metric]);
    winnerByMetric[metric] = {
      scenarioId: sorted[0]?.scenarioId || '',
      name: sorted[0]?.name || '',
      value: sorted[0]?.metrics[metric] || 0,
    };

    for (const scenario of scenarioDetails.slice(1)) {
      const baseValue = safeNumber(base.metrics[metric]);
      const compareValue = safeNumber(scenario.metrics[metric]);
      deltas.push({
        metric,
        baseScenarioId: base.scenarioId,
        compareScenarioId: scenario.scenarioId,
        baseValue,
        compareValue,
        delta: compareValue - baseValue,
        deltaPct: baseValue === 0 ? 0 : ((compareValue - baseValue) / Math.abs(baseValue)) * 100,
      });
    }
  }

  return {
    companyId: base.companyId,
    tenantId: base.tenantId,
    scenarios: scenarioDetails.map(({ tenantId, companyId, ...rest }) => rest),
    deltas,
    winnerByMetric,
  };
}

async function loadStoredComparison(comparisonId: string) {
  const stored = await db.query(
    `SELECT id, scenario_ids, metric_names, comparison_data
       FROM scenario_comparisons
      WHERE id::text = $1`,
    [comparisonId],
  );

  if (stored.rowCount === 0) {
    return null;
  }

  const row = stored.rows[0] as any;
  if (row.comparison_data) {
    return {
      comparisonId: row.id,
      ...row.comparison_data,
    };
  }

  const comparison = await buildComparisonPayload(row.scenario_ids || [], row.metric_names || []);
  return comparison ? { comparisonId: row.id, ...comparison } : null;
}

router.post('/comparisons', validate(ComparisonsBody), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { scenarioIds, versionIds, metrics, periodRange } = req.body as z.infer<typeof ComparisonsBody>;
    const comparison = await buildComparisonPayload(scenarioIds, metrics);

    if (!comparison) {
      return res.status(400).json({
        error: { code: 'INVALID_COMPARISON_SCOPE', message: 'Scenarios must exist and belong to the same company', trace_id: traceId(req) },
      });
    }

    const created = await db.query(
      `INSERT INTO scenario_comparisons
         (tenant_id, name, scenario_ids, metric_names, company_id, scenario_a_id, scenario_b_id, version_a_id, version_b_id, comparison_data)
       VALUES ($1, $2, $3::uuid[], $4::text[], $5, $6, $7, $8, $9, $10::jsonb)
       RETURNING id, created_at`,
      [
        comparison.tenantId,
        'Scenario comparison',
        scenarioIds,
        metrics,
        comparison.companyId,
        scenarioIds[0],
        scenarioIds[1],
        versionIds?.[0] || null,
        versionIds?.[1] || null,
        JSON.stringify({
          scenarios: comparison.scenarios,
          deltas: comparison.deltas,
          winnerByMetric: comparison.winnerByMetric,
          periodRange: periodRange || null,
        }),
      ],
    );

    res.status(201).json({
      data: {
        comparisonId: created.rows[0].id,
        scenarios: comparison.scenarios,
        deltas: comparison.deltas,
        createdAt: created.rows[0].created_at,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/comparisons/:comparisonId', validateParams(ComparisonParams), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { comparisonId } = req.params as z.infer<typeof ComparisonParams>;
    const comparison = await loadStoredComparison(comparisonId);

    if (!comparison) {
      return res.status(404).json({
        error: { code: 'COMPARISON_NOT_FOUND', message: `Comparison ${comparisonId} not found`, trace_id: traceId(req) },
      });
    }

    res.json({
      data: {
        comparisonId,
        scenarios: comparison.scenarios,
        deltas: comparison.deltas,
        winnerByMetric: comparison.winnerByMetric || {},
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/explainability', validateQuery(ExplainabilityQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId, targetMetric, periodId } = req.query as unknown as z.infer<typeof ExplainabilityQuery>;

    const params: any[] = [companyId, targetMetric];
    let idx = 3;
    let clauses = '';

    if (scenarioId) {
      clauses += ` AND de.scenario_id::text = $${idx++}`;
      params.push(scenarioId);
    }
    if (periodId) {
      clauses += ` AND de.planning_period_id::text = $${idx++}`;
      params.push(periodId);
    }

    const result = await db.query(
      `SELECT de.id,
              de.driver_name,
              COALESCE(de.contribution_value, de.impact_amount, 0)::float8 AS contribution_value,
              COALESCE(de.contribution_pct, 0)::float8 AS contribution_pct,
              COALESCE(de.driver_type, 'analysis') AS driver_type
         FROM driver_explainability de
         JOIN scenarios s
           ON s.id = de.scenario_id
        WHERE s.company_id::text = $1
          AND de.target_metric ILIKE $2
          ${clauses}
        ORDER BY COALESCE(de.contribution_value, de.impact_amount, 0) DESC, de.created_at ASC`,
      params,
    );

    const totalEffect = result.rows.reduce((sum, row: any) => sum + safeNumber(row.contribution_value), 0);
    const drivers = result.rows.map((row: any) => ({
      name: row.driver_name,
      contribution: safeNumber(row.contribution_value),
      percentage: row.contribution_pct
        ? safeNumber(row.contribution_pct)
        : totalEffect === 0 ? 0 : (safeNumber(row.contribution_value) / totalEffect) * 100,
      stage: row.driver_type,
      entityRef: row.id,
    }));

    res.json({
      data: {
        targetMetric,
        drivers,
        totalEffect,
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/sensitivity', validateQuery(SensitivityQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId, targetMetric, drivers } = req.query as unknown as z.infer<typeof SensitivityQuery>;
    const driverFilters = drivers
      ? String(drivers).split(',').map((value) => value.trim()).filter(Boolean)
      : [];

    const params: any[] = [companyId];
    let idx = 2;
    let clauses = '';

    if (scenarioId) {
      clauses += ` AND sa.scenario_id::text = $${idx++}`;
      params.push(scenarioId);
    }
    if (driverFilters.length > 0) {
      clauses += ` AND sa.variable_name = ANY($${idx++}::text[])`;
      params.push(driverFilters);
    }

    const metricColumn = targetMetric.trim().toLowerCase() === 'npv' ? 'impact_on_npv' : 'impact_on_ebitda';
    const result = await db.query(
      `SELECT sa.variable_name,
              COALESCE(sa.base_value, 0)::float8 AS base_value,
              COALESCE(sa.delta_pct, 0)::float8 AS delta_pct,
              COALESCE(sa.${metricColumn}, 0)::float8 AS impact_value
         FROM sensitivity_analyses sa
         JOIN scenarios s
           ON s.id = sa.scenario_id
        WHERE s.company_id::text = $1
          ${clauses}
        ORDER BY ABS(COALESCE(sa.${metricColumn}, 0)) DESC, sa.variable_name ASC`,
      params,
    );

    res.json({
      data: {
        targetMetric,
        sensitivities: result.rows.map((row: any) => ({
          driver: row.variable_name,
          elasticity: row.base_value === 0 ? 0 : safeNumber(row.impact_value) / Math.abs(safeNumber(row.base_value)),
          impactRange: {
            downside: -Math.abs(safeNumber(row.impact_value)),
            upside: Math.abs(safeNumber(row.impact_value)),
            deltaPct: safeNumber(row.delta_pct),
          },
        })),
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/risk', validateQuery(PlanningQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId } = req.query as unknown as z.infer<typeof PlanningQuery>;
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
           COALESCE(rs.probability_pct, 0)::float8 AS probability_pct,
           COALESCE(rs.financial_impact_estimate, 0)::float8 AS financial_impact_estimate,
           ro.likelihood::text AS base_likelihood
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
           0::float8 AS probability_pct,
           0::float8 AS financial_impact_estimate,
           ro.likelihood::text AS base_likelihood
         FROM risk_objects ro
        WHERE ro.tenant_id::text = $1
        ORDER BY ro.name ASC`;

    const params = scenarioId ? [company.tenant_id, scenarioId] : [company.tenant_id];
    const { rows } = await db.query(query, params);

    const riskItems = rows.map((row: any) => {
      const score = safeNumber(row.probability_pct) * safeNumber(row.financial_impact_estimate);
      const severity = score >= 1000000 ? 'critical' : score >= 300000 ? 'major' : score > 0 ? 'moderate' : 'low';
      return {
        riskId: row.risk_id,
        title: row.name,
        severity,
        likelihood: row.base_likelihood,
        financialImpact: safeNumber(row.financial_impact_estimate),
        stage: 'analysis',
        probabilityPct: safeNumber(row.probability_pct),
      };
    });

    const aggregateScore = round(
      riskItems.reduce(
        (total, item) => total + safeNumber(item.probabilityPct) * safeNumber(item.financialImpact),
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

router.get('/alerts', validateQuery(AlertsQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId, severity } = req.query as unknown as z.infer<typeof AlertsQuery>;
    const { limit, offset } = paginate(req.query);
    const alerts: Array<{ alertId: string; severity: string; message: string; linkedEntity: Record<string, unknown>; suggestedAction: string; createdAt: string }> = [];

    const runway = await db.query(
      `SELECT scenario_id,
              COALESCE(MAX(cash_runway_months), 0)::float8 AS runway,
              COALESCE(MIN(closing_balance), 0)::float8 AS min_balance
         FROM cashflow_projections
        WHERE ($1::text IS NULL OR scenario_id::text = $1)
          AND EXISTS (
            SELECT 1
              FROM scenarios s
             WHERE s.id = cashflow_projections.scenario_id
               AND s.company_id::text = $2
               AND s.is_deleted = FALSE
          )
        GROUP BY scenario_id`,
      [scenarioId || null, companyId],
    );

    for (const row of runway.rows as Array<any>) {
      if (safeNumber(row.runway) > 0 && safeNumber(row.runway) < 6) {
        alerts.push({
          alertId: stableUuidFromText(`runway:${row.scenario_id}`),
          severity: safeNumber(row.runway) < 3 ? 'critical' : 'warning',
          message: `Cash runway dropped to ${safeNumber(row.runway).toFixed(1)} months.`,
          linkedEntity: { entityType: 'scenario', entityId: row.scenario_id },
          suggestedAction: 'Review funding and burn assumptions.',
          createdAt: new Date().toISOString(),
        });
      }
      if (safeNumber(row.min_balance) < 0) {
        alerts.push({
          alertId: stableUuidFromText(`cash:${row.scenario_id}`),
          severity: 'critical',
          message: 'Projected closing cash turns negative in the selected horizon.',
          linkedEntity: { entityType: 'scenario', entityId: row.scenario_id },
          suggestedAction: 'Reduce burn or stage new capital before the breach period.',
          createdAt: new Date().toISOString(),
        });
      }
    }

    const lowConfidence = await db.query(
      `SELECT assessment_id, entity_type, entity_id, state::text AS state, COALESCE(numeric_score, 0)::float8 AS numeric_score
         FROM confidence_assessments
        WHERE company_id::text = $1
          AND state::text IN ('low', 'estimated', 'unknown')
        ORDER BY COALESCE(numeric_score, 0) ASC, updated_at DESC
        LIMIT 10`,
      [companyId],
    );

    for (const row of lowConfidence.rows as Array<any>) {
      alerts.push({
        alertId: stableUuidFromText(`confidence:${row.assessment_id}`),
        severity: row.state === 'unknown' ? 'critical' : 'warning',
        message: `Confidence is ${row.state} for ${row.entity_type}.`,
        linkedEntity: { entityType: row.entity_type, entityId: row.entity_id },
        suggestedAction: 'Add evidence or complete the open research tasks for this entity.',
        createdAt: new Date().toISOString(),
      });
    }

    const riskRows = await db.query(
      `SELECT rs.id AS risk_id, rs.scenario_id, COALESCE(rs.probability_pct, 0)::float8 AS probability_pct,
              COALESCE(rs.financial_impact_estimate, 0)::float8 AS financial_impact_estimate
         FROM risk_scenarios rs
         JOIN scenarios s
           ON s.id = rs.scenario_id
        WHERE s.company_id::text = $1
          AND ($2::text IS NULL OR rs.scenario_id::text = $2)
        ORDER BY COALESCE(rs.probability_pct, 0) * COALESCE(rs.financial_impact_estimate, 0) DESC
        LIMIT 5`,
      [companyId, scenarioId || null],
    );

    for (const row of riskRows.rows as Array<any>) {
      const riskScore = safeNumber(row.probability_pct) * safeNumber(row.financial_impact_estimate);
      if (riskScore >= 300000) {
        alerts.push({
          alertId: stableUuidFromText(`risk:${row.risk_id}`),
          severity: riskScore >= 1000000 ? 'critical' : 'warning',
          message: 'Risk register contains a high-financial-impact item requiring mitigation.',
          linkedEntity: { entityType: 'risk', entityId: row.risk_id },
          suggestedAction: 'Review the mitigation plan and scenario hedges.',
          createdAt: new Date().toISOString(),
        });
      }
    }

    const severityRank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    const filtered = alerts
      .filter((alert) => !severity || alert.severity === severity)
      .sort((left, right) => severityRank[left.severity] - severityRank[right.severity])
      .slice(offset, offset + limit);

    res.json({ data: filtered, meta: meta() });
  } catch (error) {
    next(error);
  }
});

router.get('/portfolio', validateQuery(PlanningQuery), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId, scenarioId } = req.query as unknown as z.infer<typeof PlanningQuery>;
    const params: any[] = [companyId];
    let scenarioClause = '';

    if (scenarioId) {
      scenarioClause = ' AND ats.scenario_id::text = $2';
      params.push(scenarioId);
    }

    const { rows } = await db.query(
      `SELECT ats.id,
              ats.micro_id,
              COALESCE(m.name, 'Market') AS market_name,
              COALESCE(ats.composite_score, 0)::float8 AS attractiveness_score,
              COALESCE(pma.allocated_capital, 0)::float8 AS allocated_capital,
              COALESCE(pma.projected_irr, 0)::float8 AS projected_irr,
              COALESCE(pma.priority_rank, 9999)::int AS priority_rank
         FROM attractiveness_scores ats
         JOIN scenarios s
           ON s.id = ats.scenario_id
         LEFT JOIN micros m
           ON m.id = ats.micro_id
         LEFT JOIN portfolio_plans pp
           ON pp.scenario_id = ats.scenario_id
         LEFT JOIN portfolio_market_allocations pma
           ON pma.portfolio_plan_id = pp.id
          AND pma.market_id = ats.micro_id
        WHERE s.company_id::text = $1
          ${scenarioClause}
        ORDER BY COALESCE(pma.priority_rank, 9999) ASC, COALESCE(ats.composite_score, 0) DESC`,
      params,
    );

    const markets = rows.map((row: any, index: number) => ({
      marketId: row.micro_id || row.id,
      name: row.market_name,
      attractivenessScore: safeNumber(row.attractiveness_score),
      capitalAllocated: safeNumber(row.allocated_capital),
      expectedReturn: safeNumber(row.projected_irr),
      rank: row.priority_rank === 9999 ? index + 1 : safeNumber(row.priority_rank),
    }));

    res.json({
      data: {
        markets,
        totalCapital: markets.reduce((sum, market) => sum + safeNumber(market.capitalAllocated), 0),
      },
      meta: meta(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
