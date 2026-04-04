/**
 * Step 13: Sensitivity & Risk Analysis
 *
 * Performs three tiers of risk analysis on the computed financial model:
 *
 * 1. ONE-WAY SENSITIVITY (tornado chart data)
 *    - For each key driver: perturb by ±10%, ±20%
 *    - Recompute EBITDA at each perturbation level
 *    - Record impact_pct = (new_ebitda - base_ebitda) / base_ebitda
 *    - Sort drivers by absolute impact → tornado chart ranking
 *
 * 2. THRESHOLD ANALYSIS
 *    - For each driver: find the value where EBITDA = 0 (breakeven threshold)
 *    - headroom_pct = (current_value - threshold_value) / current_value
 *
 * 3. MONTE CARLO SIMULATION (real, not fake)
 *    - Normal distribution with Box-Muller transform
 *    - 1000 iterations per run
 *    - Reports P10, P25, P50, P75, P90 percentiles
 *    - Reports probability of EBITDA < 0
 *
 * INPUT variables (from PipelineState.financials, aggregated across all periods):
 *   Key drivers: gross_demand, average_order_value, cogs_per_unit,
 *                channel_fee_rate, variable_labor_fulfillment, fixed_site_costs
 *   Targets: ebitda (base case from pipeline state)
 *
 * OUTPUT:
 *   - kpi_projections (sensitivity metrics per driver)
 *   - compute_run_artifacts (artifact_type='sensitivity', metadata=JSON results)
 *
 * Source: computation_graph.json → node_sensitivity_risk
 */

import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import { ComputeContext, PipelineState } from '../orchestrator';
import { logger } from '../../lib/logger';

// ── Types ────────────────────────────────────────────────────────────────────

interface DriverDefinition {
  name: string;
  /** Where in assumptions or financials to read the base value */
  source: 'assumption' | 'financial';
  /** Std deviation as fraction of mean for Monte Carlo (e.g. 0.15 = 15%) */
  volatility: number;
}

interface SensitivityResult {
  driver: string;
  perturbation_pct: number;
  base_ebitda: number;
  new_ebitda: number;
  impact_pct: number;
}

interface ThresholdResult {
  driver: string;
  current_value: number;
  threshold_value: number;
  headroom_pct: number;
}

interface MonteCarloSummary {
  iterations: number;
  mean_ebitda: number;
  std_ebitda: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  prob_negative: number;
  min_ebitda: number;
  max_ebitda: number;
}

// ── Key drivers definition ───────────────────────────────────────────────────

const KEY_DRIVERS: DriverDefinition[] = [
  { name: 'gross_demand',              source: 'assumption', volatility: 0.20 },
  { name: 'average_order_value',       source: 'assumption', volatility: 0.10 },
  { name: 'cogs_per_unit',            source: 'assumption', volatility: 0.15 },
  { name: 'channel_fee_rate',         source: 'assumption', volatility: 0.10 },
  { name: 'variable_labor_fulfillment', source: 'assumption', volatility: 0.15 },
  { name: 'fixed_site_costs',         source: 'assumption', volatility: 0.10 },
];

// ── Box-Muller transform for normal distribution ─────────────────────────────

function boxMullerNormal(): number {
  let u1 = 0;
  let u2 = 0;
  // Avoid log(0)
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Sample from a normal distribution with given mean and standard deviation.
 */
function sampleNormal(mean: number, std: number): number {
  return mean + std * boxMullerNormal();
}

// ── EBITDA recomputation from driver values ──────────────────────────────────

/**
 * Recompute aggregated EBITDA from driver values.
 *
 * This is a simplified single-period model that mirrors the P&L waterfall:
 *   realized_orders = gross_demand × reach_rate × conversion_rate
 *   gross_sales = realized_orders × average_order_value
 *   net_revenue = gross_sales × (1 - discount_rate - refund_rate - channel_fee_rate)
 *   cogs = realized_orders × cogs_per_unit
 *   cm1 = net_revenue - cogs
 *   cm2 = cm1 - variable_marketing_promo
 *   cm3 = cm2 - variable_labor_fulfillment
 *   cm4 = cm3 - site_controllable_opex
 *   ebitda = cm4 - fixed_site_costs - shared_operating_allocations
 */
function recomputeEBITDA(params: Record<string, number>): number {
  const gross_demand = params.gross_demand ?? 0;
  const reach_rate = params.reach_rate ?? 0;
  const conversion_rate = params.conversion_rate ?? 0;
  const average_order_value = params.average_order_value ?? 0;
  const discount_rate = params.discount_rate ?? 0;
  const refund_rate = params.refund_rate ?? 0;
  const channel_fee_rate = params.channel_fee_rate ?? 0;
  const cogs_per_unit = params.cogs_per_unit ?? 0;
  const variable_marketing_promo = params.variable_marketing_promo ?? 0;
  const variable_labor_fulfillment = params.variable_labor_fulfillment ?? 0;
  const site_controllable_opex = params.site_controllable_opex ?? 0;
  const fixed_site_costs = params.fixed_site_costs ?? 0;
  const shared_operating_allocations = params.shared_operating_allocations ?? 0;

  const realized_orders = gross_demand * reach_rate * conversion_rate;
  const gross_sales = realized_orders * average_order_value;
  const net_revenue = gross_sales * (1 - discount_rate - refund_rate - channel_fee_rate);
  const cogs = realized_orders * cogs_per_unit;
  const cm1 = net_revenue - cogs;
  const cm2 = cm1 - variable_marketing_promo;
  const cm3 = cm2 - variable_labor_fulfillment;
  const cm4 = cm3 - site_controllable_opex;
  const ebitda = cm4 - fixed_site_costs - shared_operating_allocations;

  return ebitda;
}

// ── Threshold search (bisection) ─────────────────────────────────────────────

/**
 * Find the driver value where EBITDA = 0 using bisection.
 * For revenue drivers (demand, AOV): search downward from current value.
 * For cost drivers: search upward from current value.
 */
function findThreshold(
  baseParams: Record<string, number>,
  driverName: string,
  currentValue: number,
  maxIterations = 100,
  tolerance = 0.01
): number | null {
  const baseEbitda = recomputeEBITDA(baseParams);

  // Determine search direction: if EBITDA is positive, we want to find where it hits 0
  // Revenue drivers: reducing them reduces EBITDA
  // Cost drivers: increasing them reduces EBITDA
  const isRevDriver = ['gross_demand', 'average_order_value'].includes(driverName);
  const isCostDriver = ['cogs_per_unit', 'channel_fee_rate', 'variable_labor_fulfillment',
                         'fixed_site_costs', 'shared_operating_allocations',
                         'variable_marketing_promo', 'site_controllable_opex'].includes(driverName);

  // For rate drivers (channel_fee_rate), clamp to [0, 1]
  const isRateDriver = ['channel_fee_rate', 'discount_rate', 'refund_rate'].includes(driverName);

  let lo: number;
  let hi: number;

  if (baseEbitda >= 0) {
    // EBITDA is positive — find where it drops to 0
    if (isRevDriver) {
      lo = 0;
      hi = currentValue;
    } else if (isCostDriver) {
      lo = currentValue;
      hi = isRateDriver ? 1.0 : currentValue * 10;
    } else {
      return null;
    }
  } else {
    // EBITDA is already negative — find where it rises to 0
    if (isRevDriver) {
      lo = currentValue;
      hi = currentValue * 10;
    } else if (isCostDriver) {
      lo = 0;
      hi = currentValue;
    } else {
      return null;
    }
  }

  // Verify sign change
  const testParams = { ...baseParams };
  testParams[driverName] = lo;
  const ebitdaLo = recomputeEBITDA(testParams);
  testParams[driverName] = hi;
  const ebitdaHi = recomputeEBITDA(testParams);

  if ((ebitdaLo > 0 && ebitdaHi > 0) || (ebitdaLo < 0 && ebitdaHi < 0)) {
    return null; // No breakeven threshold in range
  }

  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    testParams[driverName] = mid;
    const ebitdaMid = recomputeEBITDA(testParams);

    if (Math.abs(ebitdaMid) < tolerance) {
      return mid;
    }

    testParams[driverName] = lo;
    const ebitdaAtLo = recomputeEBITDA(testParams);

    if ((ebitdaAtLo > 0 && ebitdaMid > 0) || (ebitdaAtLo < 0 && ebitdaMid < 0)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return (lo + hi) / 2;
}

// ── DB write helpers ─────────────────────────────────────────────────────────

async function upsertKPI(
  ctx: ComputeContext,
  periodId: string | null,
  metricName: string,
  value: number
): Promise<void> {
  await db.query(
    `INSERT INTO kpi_projections
       (id, company_id, scenario_id, version_id, period_id, compute_run_id,
        metric_name, value, currency, is_provisional, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AED', false, NOW(), NOW())
     ON CONFLICT (company_id, scenario_id, version_id, period_id, compute_run_id, metric_name)
     DO UPDATE SET value = $8, updated_at = NOW()`,
    [uuidv4(), ctx.company_id, ctx.scenario_id, ctx.version_id, periodId, ctx.run_id, metricName, value]
  );
}

async function storeArtifact(
  ctx: ComputeContext,
  artifactType: string,
  artifactRef: string,
  metadata: Record<string, unknown>,
  rowCount: number
): Promise<void> {
  await db.query(
    `INSERT INTO compute_run_artifacts
       (id, compute_run_id, artifact_type, artifact_ref, row_count, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW(), NOW())`,
    [uuidv4(), ctx.run_id, artifactType, artifactRef, rowCount, JSON.stringify(metadata)]
  );
}

// ── Main execution ───────────────────────────────────────────────────────────

export async function executeSensitivityRisk(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  if (!state.planning_spine) {
    throw new Error('[sensitivity-risk] Planning spine not resolved');
  }
  if (!state.assumptions) {
    throw new Error('[sensitivity-risk] Assumptions not resolved');
  }

  const assumptions = state.assumptions;
  const periods = state.planning_spine.periods;

  // Use the last period as the representative steady-state for sensitivity analysis
  // (most meaningful — shows the mature-state economics)
  const refPeriod = periods[periods.length - 1];
  const refPid = refPeriod?.period_id ?? '';
  const refFin = state.financials[refPid] || {};

  // Build base parameter set for the reference period
  const baseParams: Record<string, number> = {
    gross_demand: assumptions.getNumeric('gross_demand', refPid),
    reach_rate: assumptions.getNumeric('reach_rate', refPid),
    conversion_rate: assumptions.getNumeric('conversion_rate', refPid),
    average_order_value: assumptions.getNumeric('average_order_value', refPid),
    discount_rate: assumptions.getNumeric('discount_rate', refPid),
    refund_rate: assumptions.getNumeric('refund_rate', refPid),
    channel_fee_rate: assumptions.getNumeric('channel_fee_rate', refPid),
    cogs_per_unit: assumptions.getNumeric('cogs_per_unit', refPid),
    variable_marketing_promo: assumptions.getNumeric('variable_marketing_promo', refPid),
    variable_labor_fulfillment: assumptions.getNumeric('variable_labor_fulfillment', refPid),
    site_controllable_opex: assumptions.getNumeric('site_controllable_opex', refPid),
    fixed_site_costs: assumptions.getNumeric('fixed_site_costs', refPid),
    shared_operating_allocations: assumptions.getNumeric('shared_operating_allocations', refPid),
  };

  const baseEbitda = recomputeEBITDA(baseParams);

  // ══════════════════════════════════════════════════════════════════════════
  // 1. ONE-WAY SENSITIVITY ANALYSIS
  // ══════════════════════════════════════════════════════════════════════════

  const perturbations = [-0.20, -0.10, 0.10, 0.20];
  const sensitivityResults: SensitivityResult[] = [];

  for (const driver of KEY_DRIVERS) {
    const currentValue = baseParams[driver.name] ?? 0;
    if (currentValue === 0) continue; // Skip zero-valued drivers

    for (const pct of perturbations) {
      const perturbedParams = { ...baseParams };
      perturbedParams[driver.name] = currentValue * (1 + pct);

      const newEbitda = recomputeEBITDA(perturbedParams);
      const impactPct = baseEbitda !== 0
        ? (newEbitda - baseEbitda) / Math.abs(baseEbitda)
        : 0;

      sensitivityResults.push({
        driver: driver.name,
        perturbation_pct: pct,
        base_ebitda: baseEbitda,
        new_ebitda: newEbitda,
        impact_pct: impactPct,
      });
    }
  }

  // Sort by absolute impact at +20% perturbation for tornado ranking
  const tornadoRanking = KEY_DRIVERS
    .map(d => {
      const up20 = sensitivityResults.find(
        r => r.driver === d.name && r.perturbation_pct === 0.20
      );
      const down20 = sensitivityResults.find(
        r => r.driver === d.name && r.perturbation_pct === -0.20
      );
      const maxImpact = Math.max(
        Math.abs(up20?.impact_pct ?? 0),
        Math.abs(down20?.impact_pct ?? 0)
      );
      return { driver: d.name, max_impact_pct: maxImpact };
    })
    .sort((a, b) => b.max_impact_pct - a.max_impact_pct);

  logger.info({ tornadoRanking }, 'Sensitivity-risk tornado ranking computed');

  // ══════════════════════════════════════════════════════════════════════════
  // 2. THRESHOLD ANALYSIS
  // ══════════════════════════════════════════════════════════════════════════

  const thresholdResults: ThresholdResult[] = [];

  for (const driver of KEY_DRIVERS) {
    const currentValue = baseParams[driver.name] ?? 0;
    if (currentValue === 0) continue;

    const thresholdValue = findThreshold(baseParams, driver.name, currentValue);

    if (thresholdValue !== null) {
      const headroomPct = currentValue !== 0
        ? (currentValue - thresholdValue) / Math.abs(currentValue)
        : 0;

      thresholdResults.push({
        driver: driver.name,
        current_value: currentValue,
        threshold_value: thresholdValue,
        headroom_pct: headroomPct,
      });

      logger.info(
        {
          driver: driver.name,
          currentValue,
          thresholdValue,
          headroomPct,
        },
        'Sensitivity-risk threshold computed',
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. MONTE CARLO SIMULATION
  // ══════════════════════════════════════════════════════════════════════════

  const MC_ITERATIONS = 1000;
  const mcEbitdaResults: number[] = [];

  for (let i = 0; i < MC_ITERATIONS; i++) {
    const sampledParams = { ...baseParams };

    // Sample each key driver from its normal distribution
    for (const driver of KEY_DRIVERS) {
      const mean = baseParams[driver.name] ?? 0;
      const std = mean * driver.volatility;
      let sampled = sampleNormal(mean, std);

      // Clamp rate drivers to [0, 1]
      if (['channel_fee_rate', 'discount_rate', 'refund_rate'].includes(driver.name)) {
        sampled = Math.max(0, Math.min(1, sampled));
      }

      // Clamp non-negative drivers
      if (['gross_demand', 'average_order_value', 'cogs_per_unit',
           'variable_labor_fulfillment', 'fixed_site_costs'].includes(driver.name)) {
        sampled = Math.max(0, sampled);
      }

      sampledParams[driver.name] = sampled;
    }

    // Also sample non-key drivers that affect EBITDA
    // (reach_rate, conversion_rate, variable_marketing_promo, site_controllable_opex,
    //  shared_operating_allocations with 10% volatility)
    const secondaryDrivers = [
      { name: 'reach_rate', vol: 0.10 },
      { name: 'conversion_rate', vol: 0.10 },
      { name: 'variable_marketing_promo', vol: 0.15 },
      { name: 'site_controllable_opex', vol: 0.10 },
      { name: 'shared_operating_allocations', vol: 0.10 },
    ];

    for (const sd of secondaryDrivers) {
      const mean = baseParams[sd.name] ?? 0;
      if (mean === 0) continue;
      const std = mean * sd.vol;
      let sampled = sampleNormal(mean, std);

      if (['reach_rate', 'conversion_rate'].includes(sd.name)) {
        sampled = Math.max(0, Math.min(1, sampled));
      } else {
        sampled = Math.max(0, sampled);
      }

      sampledParams[sd.name] = sampled;
    }

    const simEbitda = recomputeEBITDA(sampledParams);
    mcEbitdaResults.push(simEbitda);
  }

  // Sort for percentile computation
  mcEbitdaResults.sort((a, b) => a - b);

  function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  const mcMean = mcEbitdaResults.reduce((sum, v) => sum + v, 0) / mcEbitdaResults.length;
  const mcVariance = mcEbitdaResults.reduce((sum, v) => sum + (v - mcMean) ** 2, 0) / mcEbitdaResults.length;
  const mcStd = Math.sqrt(mcVariance);
  const negativeCount = mcEbitdaResults.filter(v => v < 0).length;

  const mcSummary: MonteCarloSummary = {
    iterations: MC_ITERATIONS,
    mean_ebitda: mcMean,
    std_ebitda: mcStd,
    p10: percentile(mcEbitdaResults, 10),
    p25: percentile(mcEbitdaResults, 25),
    p50: percentile(mcEbitdaResults, 50),
    p75: percentile(mcEbitdaResults, 75),
    p90: percentile(mcEbitdaResults, 90),
    prob_negative: negativeCount / MC_ITERATIONS,
    min_ebitda: mcEbitdaResults[0],
    max_ebitda: mcEbitdaResults[mcEbitdaResults.length - 1],
  };

  logger.info(
    {
      iterations: MC_ITERATIONS,
      meanEbitda: mcSummary.mean_ebitda,
      p10: mcSummary.p10,
      p50: mcSummary.p50,
      p90: mcSummary.p90,
      probabilityNegative: mcSummary.prob_negative,
    },
    'Sensitivity-risk Monte Carlo summary computed',
  );

  // ══════════════════════════════════════════════════════════════════════════
  // 4. PERSIST RESULTS
  // ══════════════════════════════════════════════════════════════════════════

  // Store sensitivity KPIs per driver
  for (const rank of tornadoRanking) {
    await upsertKPI(
      ctx,
      refPid,
      `sensitivity_tornado_rank_${rank.driver}`,
      rank.max_impact_pct
    );
  }

  // Store threshold headroom per driver
  for (const threshold of thresholdResults) {
    await upsertKPI(
      ctx,
      refPid,
      `threshold_headroom_${threshold.driver}`,
      threshold.headroom_pct
    );
  }

  // Store Monte Carlo summary KPIs
  const mcKpis: Record<string, number> = {
    mc_mean_ebitda: mcSummary.mean_ebitda,
    mc_std_ebitda: mcSummary.std_ebitda,
    mc_p10_ebitda: mcSummary.p10,
    mc_p25_ebitda: mcSummary.p25,
    mc_p50_ebitda: mcSummary.p50,
    mc_p75_ebitda: mcSummary.p75,
    mc_p90_ebitda: mcSummary.p90,
    mc_prob_negative_ebitda: mcSummary.prob_negative,
    mc_iterations: mcSummary.iterations,
  };

  for (const [metric_name, value] of Object.entries(mcKpis)) {
    await upsertKPI(ctx, refPid, metric_name, value);
  }

  // Store full results as compute_run_artifacts
  await storeArtifact(
    ctx,
    'sensitivity',
    'sensitivity_analysis',
    {
      reference_period: refPid,
      base_ebitda: baseEbitda,
      tornado_ranking: tornadoRanking,
      sensitivity_results: sensitivityResults,
      threshold_results: thresholdResults,
      monte_carlo_summary: mcSummary,
      driver_definitions: KEY_DRIVERS.map(d => ({
        name: d.name,
        volatility: d.volatility,
        base_value: baseParams[d.name],
      })),
    },
    sensitivityResults.length + thresholdResults.length + MC_ITERATIONS
  );

  // Store results in pipeline state for downstream confidence node
  (state.financials as Record<string, Record<string, number>>)['__sensitivity'] =
    (state.financials as Record<string, Record<string, number>>)['__sensitivity'] || {};
  const sensitivityState = (state.financials as Record<string, Record<string, number>>)['__sensitivity'];
  sensitivityState['base_ebitda'] = baseEbitda;
  sensitivityState['mc_prob_negative'] = mcSummary.prob_negative;
  sensitivityState['mc_p10'] = mcSummary.p10;
  sensitivityState['mc_p50'] = mcSummary.p50;

  for (const rank of tornadoRanking) {
    sensitivityState[`tornado_${rank.driver}`] = rank.max_impact_pct;
  }
}
