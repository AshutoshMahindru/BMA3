/**
 * Step 12: Unit Economics & KPIs
 *
 * Computes per-order unit economics, breakeven analysis, and return metrics
 * (payback period, IRR, ROIC, NPV) from the full P&L, cash flow, and balance
 * sheet computed in steps 5-11.
 *
 * INPUT variables (from PipelineState.financials per period):
 *   - net_revenue, cogs, cm1, cm2, cm4, ebitda, ebit
 *   - realized_orders, total_capex
 *   - fixed_site_costs, shared_operating_allocations
 *   - operating_cash_flow, investing_cash_flow, closing_cash, net_burn
 *   - total_assets, total_liabilities, working_capital_movement
 *   - tax_rate, practical_capacity (from assumptions)
 *   - net_income (from step 8)
 *
 * COMPUTED:
 *   Per-order metrics:
 *     net_revenue_per_order, cogs_per_order, cm1_per_order, cm2_per_order,
 *     ebitda_per_order
 *
 *   Breakeven:
 *     breakeven_orders_per_day = fixed_costs / (cm2_per_order × 30)
 *     breakeven_month = first month where cumulative net_income > 0
 *
 *   Return metrics:
 *     payback_period = months until cumulative cash flow recovers total investment
 *     roic = annual_ebit × (1 - tax_rate) / total_invested_capital
 *     irr  = internal rate of return on the cash flow series (bisection method)
 *     npv  = sum of discounted cash flows at hurdle rate
 *
 * OUTPUT tables:
 *   - unit_economics_projections (per-period metrics)
 *   - kpi_projections (aggregate return / breakeven metrics)
 *
 * Source: computation_graph.json → node_unit_economics
 */

import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../lib/logger';
import { ComputeContext, PipelineState } from '../orchestrator';

// ── IRR via Bisection ────────────────────────────────────────────────────────

/**
 * Compute NPV of a cash flow series at a given annual discount rate.
 * cashFlows[0] = initial investment (typically negative), subsequent = period flows.
 * Periods are monthly — discount rate is annualised, so monthly rate = (1+r)^(1/12)-1.
 */
function computeNPV(cashFlows: number[], annualRate: number): number {
  if (cashFlows.length === 0) return 0;
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  let npv = 0;
  for (let t = 0; t < cashFlows.length; t++) {
    const discountFactor = Math.pow(1 + monthlyRate, t);
    if (discountFactor === 0) continue;
    npv += cashFlows[t] / discountFactor;
  }
  return npv;
}

/**
 * Compute IRR using bisection method.
 * Searches annual discount rates from -50% to +500% for NPV = 0.
 * Returns null if IRR does not converge.
 */
function computeIRR(cashFlows: number[], maxIterations = 200, tolerance = 0.0001): number | null {
  if (cashFlows.length < 2) return null;

  // Verify sign change exists
  const npvLow = computeNPV(cashFlows, -0.50);
  const npvHigh = computeNPV(cashFlows, 5.00);

  // If no sign change in [-50%, 500%], IRR does not exist in this range
  if ((npvLow > 0 && npvHigh > 0) || (npvLow < 0 && npvHigh < 0)) {
    return null;
  }

  let lo = -0.50;
  let hi = 5.00;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    const npvMid = computeNPV(cashFlows, mid);

    if (Math.abs(npvMid) < tolerance) {
      return mid;
    }

    const npvLoBound = computeNPV(cashFlows, lo);
    if ((npvLoBound > 0 && npvMid > 0) || (npvLoBound < 0 && npvMid < 0)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  // Return best guess after max iterations
  return (lo + hi) / 2;
}

// ── DB write helper ──────────────────────────────────────────────────────────

async function upsertUnitEconomics(
  ctx: ComputeContext,
  periodId: string,
  metricName: string,
  value: number
): Promise<void> {
  await db.query(
    `INSERT INTO unit_economics_projections
       (id, company_id, scenario_id, version_id, period_id, compute_run_id,
        metric_name, value, currency, is_provisional, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AED', false, NOW(), NOW())
     ON CONFLICT (company_id, scenario_id, version_id, period_id, compute_run_id, metric_name)
     DO UPDATE SET value = $8, updated_at = NOW()`,
    [uuidv4(), ctx.company_id, ctx.scenario_id, ctx.version_id, periodId, ctx.run_id, metricName, value]
  );
}

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

// ── Main execution ───────────────────────────────────────────────────────────

export async function executeUnitEconomics(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  if (!state.planning_spine) {
    throw new Error('[unit-economics] Planning spine not resolved');
  }
  if (!state.assumptions) {
    throw new Error('[unit-economics] Assumptions not resolved');
  }

  const assumptions = state.assumptions;
  const periods = state.planning_spine.periods;

  // ── Step 1: Per-period unit economics ──────────────────────────────────

  for (const period of periods) {
    const pid = period.period_id;
    const fin = state.financials[pid] || {};

    const realized_orders = fin.realized_orders ?? 0;
    const net_revenue = fin.net_revenue ?? 0;
    const cogs = fin.cogs ?? 0;
    const cm1 = fin.cm1 ?? 0;
    const cm2 = fin.cm2 ?? 0;
    const cm4 = fin.cm4 ?? 0;
    const ebitda = fin.ebitda ?? 0;
    const ebit = fin.ebit ?? 0;
    const total_capex = fin.total_capex ?? 0;
    const total_assets = fin.total_assets ?? 0;
    const total_liabilities = fin.total_liabilities ?? 0;
    const closing_cash = fin.closing_cash ?? 0;
    const net_burn = fin.net_burn ?? 0;
    const fixed_site_costs = fin.fixed_site_costs ?? assumptions.getNumeric('fixed_site_costs', pid);
    const shared_operating_allocations = fin.shared_operating_allocations ?? assumptions.getNumeric('shared_operating_allocations', pid);
    const tax_rate = assumptions.getNumeric('tax_rate', pid);
    const practical_capacity = assumptions.getNumeric('practical_capacity', pid);

    // ── Per-order metrics (guard division by zero) ─────────────────────
    const net_revenue_per_order = realized_orders > 0 ? net_revenue / realized_orders : 0;
    const cogs_per_order = realized_orders > 0 ? cogs / realized_orders : 0;
    const cm1_per_order = realized_orders > 0 ? cm1 / realized_orders : 0;
    const cm2_per_order = realized_orders > 0 ? cm2 / realized_orders : 0;
    const ebitda_per_order = realized_orders > 0 ? ebitda / realized_orders : 0;

    // ── Margin percentages ──────────────────────────────────────────────
    const cm1_margin_pct = net_revenue !== 0 ? cm1 / net_revenue : 0;
    const food_cost_pct = net_revenue !== 0 ? cogs / net_revenue : 0;

    // ── Capacity utilization ────────────────────────────────────────────
    const capacity_utilization = practical_capacity > 0 ? realized_orders / practical_capacity : 0;

    // ── Capital intensity ───────────────────────────────────────────────
    const capital_intensity = net_revenue !== 0 ? total_capex / net_revenue : 0;

    // ── Breakeven orders per day ────────────────────────────────────────
    // fixed_costs = fixed_site_costs + shared_operating_allocations
    const fixed_costs = fixed_site_costs + shared_operating_allocations;
    // breakeven_orders_per_day = fixed_costs / (cm2_per_order × 30)
    const breakeven_orders_per_day =
      cm2_per_order > 0 ? fixed_costs / (cm2_per_order * 30) : (fixed_costs > 0 ? Infinity : 0);

    // ── Runway ──────────────────────────────────────────────────────────
    const runway = net_burn > 0 ? closing_cash / net_burn : Infinity;

    // ── ROIC (period-level) ─────────────────────────────────────────────
    // invested_capital = total_assets - current_liabilities (approximated as total_assets - total_liabilities for non-debt component)
    // For simplicity: total_invested_capital = total_assets - closing_cash (operating invested capital)
    const invested_capital = total_assets - closing_cash;
    const nopat = ebit * (1 - tax_rate);
    const roic = invested_capital > 0 ? nopat / invested_capital : 0;

    // Store in pipeline state
    Object.assign(fin, {
      net_revenue_per_order,
      cogs_per_order,
      cm1_per_order,
      cm2_per_order,
      ebitda_per_order,
      cm1_margin_pct,
      food_cost_pct,
      capacity_utilization,
      capital_intensity,
      breakeven_orders_per_day,
      roic,
    });
    state.financials[pid] = fin;

    // ── Write per-period unit economics to DB ───────────────────────────
    const ueMetrics: Record<string, number> = {
      net_revenue_per_order,
      cogs_per_order,
      cm1_per_order,
      cm2_per_order,
      ebitda_per_order,
      cm1_margin_pct,
      food_cost_pct,
      capacity_utilization,
      capital_intensity,
    };

    for (const [metric_name, value] of Object.entries(ueMetrics)) {
      await upsertUnitEconomics(ctx, pid, metric_name, value);
    }

    // ── Write per-period KPIs to DB ─────────────────────────────────────
    const kpiMetrics: Record<string, number> = {
      breakeven_orders_per_day: isFinite(breakeven_orders_per_day) ? breakeven_orders_per_day : -1,
      runway: isFinite(runway) ? runway : -1,
      roic,
    };

    for (const [metric_name, value] of Object.entries(kpiMetrics)) {
      await upsertKPI(ctx, pid, metric_name, value);
    }

    logger.info(
      {
        periodLabel: period.label,
        netRevenuePerOrder: net_revenue_per_order,
        cogsPerOrder: cogs_per_order,
        cm1PerOrder: cm1_per_order,
        ebitdaPerOrder: ebitda_per_order,
        breakevenOrdersPerDay: isFinite(breakeven_orders_per_day) ? breakeven_orders_per_day : null,
      },
      'Unit economics computed for period',
    );
  }

  // ── Step 2: Aggregate / cross-period return metrics ────────────────────

  // Build cash flow series for IRR/NPV: each period's free cash flow
  // Free cash flow = operating_cash_flow + investing_cash_flow
  const cashFlowSeries: number[] = [];
  let cumulativeNetIncome = 0;
  let breakevenMonth: number | null = null;
  let totalInvestment = 0;
  let cumulativeCashFlow = 0;
  let paybackPeriod: number | null = null;

  for (let i = 0; i < periods.length; i++) {
    const pid = periods[i].period_id;
    const fin = state.financials[pid] || {};

    const operating_cf = fin.operating_cash_flow ?? 0;
    const investing_cf = fin.investing_cash_flow ?? 0;
    const fcf = operating_cf + investing_cf;
    cashFlowSeries.push(fcf);

    // Breakeven month = first month where cumulative net_income > 0
    const net_income = fin.net_income ?? 0;
    cumulativeNetIncome += net_income;
    if (breakevenMonth === null && cumulativeNetIncome > 0) {
      breakevenMonth = i + 1; // 1-indexed month number
    }

    // Payback period: accumulate capex as investment, track when cumulative OCF recovers it
    const total_capex = fin.total_capex ?? 0;
    totalInvestment += total_capex;
    cumulativeCashFlow += fcf;
    if (paybackPeriod === null && totalInvestment > 0 && cumulativeCashFlow > 0) {
      paybackPeriod = i + 1; // months
    }
  }

  // ── IRR (bisection over annualized rate) ──────────────────────────────
  const irr = computeIRR(cashFlowSeries);

  // ── NPV at hurdle rate ────────────────────────────────────────────────
  // Use 12% annual hurdle rate (common for food/hospitality ventures in UAE)
  // Read from assumptions if available, else default
  const hurdleRate = assumptions.getNumeric('hurdle_rate', periods[0]?.period_id ?? '') || 0.12;
  const npv = computeNPV(cashFlowSeries, hurdleRate);

  // ── ROIC (scenario-level: last period) ────────────────────────────────
  const lastPeriod = periods[periods.length - 1];
  const lastFin = state.financials[lastPeriod?.period_id ?? ''] || {};
  const annualEbit = (lastFin.ebit ?? 0) * 12; // annualize from monthly
  const lastTaxRate = assumptions.getNumeric('tax_rate', lastPeriod?.period_id ?? '');
  const lastTotalAssets = lastFin.total_assets ?? 0;
  const lastClosingCash = lastFin.closing_cash ?? 0;
  const totalInvestedCapital = lastTotalAssets - lastClosingCash;
  const scenarioRoic = totalInvestedCapital > 0
    ? (annualEbit * (1 - lastTaxRate)) / totalInvestedCapital
    : 0;

  // ── Write scenario-level KPIs ─────────────────────────────────────────
  const scenarioKPIs: Record<string, number> = {
    irr: irr !== null ? irr : -999, // -999 = did not converge
    npv,
    hurdle_rate: hurdleRate,
    payback_period_months: paybackPeriod ?? -1, // -1 = not achieved
    breakeven_month: breakevenMonth ?? -1,       // -1 = not achieved
    scenario_roic: scenarioRoic,
  };

  // Store in pipeline state for downstream nodes
  for (const [key, value] of Object.entries(scenarioKPIs)) {
    (state.financials as Record<string, Record<string, number>>)['__scenario_kpis'] =
      (state.financials as Record<string, Record<string, number>>)['__scenario_kpis'] || {};
    (state.financials as Record<string, Record<string, number>>)['__scenario_kpis'][key] = value;
  }

  // Use first period_id as the period reference for scenario-level KPIs
  // (these are horizon-wide metrics, not period-specific)
  const scenarioPeriodId = periods[0]?.period_id ?? null;

  for (const [metric_name, value] of Object.entries(scenarioKPIs)) {
    await upsertKPI(ctx, scenarioPeriodId, `scenario_${metric_name}`, value);
  }

  logger.info(
    {
      irr,
      npv,
      paybackPeriodMonths: paybackPeriod,
      breakevenMonth,
      scenarioRoic,
    },
    'Unit economics scenario KPIs computed',
  );
}
