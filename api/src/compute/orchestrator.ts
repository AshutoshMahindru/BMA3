/**
 * BMA3 Computation Pipeline Orchestrator
 *
 * 18-step sequencer that executes the computation DAG in dependency order.
 * Generated from specos/artifacts/computation_graph.json
 *
 * Execution plan:
 *   Steps 1-4:  Resolution/validation (planning spine, scope, decisions, assumptions)
 *   Steps 5-7:  Core P&L computation (demand, revenue, contribution)
 *   Steps 8-11: Extended financial (capex/opex, working capital, burn/runway, balance sheet)
 *   Steps 12-14: Analysis (unit economics, sensitivity, confidence)
 *   Steps 15-18: Finalization (emit artifacts, cross-validate, alerts, finalize)
 */

import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

// ── Node imports ──────────────────────────────────────────────────────────────
import { executePlanningSpine } from './nodes/planning-spine';
import { executeScopeBundle } from './nodes/scope-bundle';
import { executeDecisions } from './nodes/decisions';
import { executeAssumptionPacks, ResolvedAssumptions } from './nodes/assumption-packs';
import { executeDemandDrivers } from './nodes/demand-drivers';
import { executeRevenueStack } from './nodes/revenue-stack';
import { executeContributionStack } from './nodes/contribution-stack';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ComputeContext {
  tenant_id: string;
  company_id: string;
  scenario_id: string;
  assumption_set_id: string;
  version_id: string;
  period_range: { start: string; end: string };
  run_id: string;
}

/**
 * Resolved data passed between stages. Populated progressively as each step
 * completes — downstream nodes read from here rather than re-querying the DB.
 */
export interface PipelineState {
  /** Step 1 outputs */
  planning_spine: {
    company_id: string;
    scenario_id: string;
    version_id: string;
    periods: Array<{ period_id: string; start_date: string; end_date: string; label: string }>;
  } | null;

  /** Step 2 outputs */
  scope_bundle: {
    scope_bundle_id: string;
    geographies: string[];
    formats: string[];
    categories: string[];
    channels: string[];
  } | null;

  /** Step 3 outputs */
  decisions: {
    active_decision_ids: string[];
    decision_state: Record<string, unknown>;
  } | null;

  /** Step 4 outputs — assumption values keyed by variable_name × grain */
  assumptions: ResolvedAssumptions | null;

  /** Step 5+ financial outputs per period (keyed by period_id) */
  financials: Record<string, Record<string, number>>;
}

type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

interface StepDefinition {
  step: number;
  node_id: string;
  label: string;
  execute: (ctx: ComputeContext, state: PipelineState) => Promise<void>;
}

// ── Execution plan ────────────────────────────────────────────────────────────

function buildExecutionPlan(): StepDefinition[] {
  return [
    // Stage 1-4: Resolution / Validation
    {
      step: 1,
      node_id: 'node_planning_spine',
      label: 'Resolve planning spine: company, scenario, version, period range',
      execute: executePlanningSpine,
    },
    {
      step: 2,
      node_id: 'node_scope_bundle',
      label: 'Validate scope bundle: formats, categories, channels, geographies',
      execute: executeScopeBundle,
    },
    {
      step: 3,
      node_id: 'node_decisions',
      label: 'Resolve active decisions: product, market, marketing, operations',
      execute: executeDecisions,
    },
    {
      step: 4,
      node_id: 'node_assumption_packs',
      label: 'Resolve and validate all assumption packs with inheritance chain',
      execute: executeAssumptionPacks,
    },

    // Stage 5: Core computation
    {
      step: 5,
      node_id: 'node_demand_drivers',
      label: 'Compute demand drivers: gross_demand → realized_orders',
      execute: executeDemandDrivers,
    },
    {
      step: 6,
      node_id: 'node_revenue_stack',
      label: 'Compute revenue stack: gross_sales → net_revenue',
      execute: executeRevenueStack,
    },
    {
      step: 7,
      node_id: 'node_contribution_stack',
      label: 'Compute CM waterfall: CM1 → CM2 → CM3 → CM4',
      execute: executeContributionStack,
    },

    // Stage 5 continued: Extended financial
    {
      step: 8,
      node_id: 'node_capex_opex',
      label: 'Compute capex totals, depreciation, EBITDA, EBIT, EBT, tax, net income',
      execute: executeCapexOpexStub,
    },
    {
      step: 9,
      node_id: 'node_working_capital',
      label: 'Compute working capital movement',
      execute: executeWorkingCapitalStub,
    },
    {
      step: 10,
      node_id: 'node_burn_runway',
      label: 'Compute cash flow statement, burn metrics, and runway',
      execute: executeBurnRunwayStub,
    },
    {
      step: 11,
      node_id: 'node_balance_sheet',
      label: 'Compute balance sheet: assets, liabilities, equity',
      execute: executeBalanceSheetStub,
    },

    // Stage 6: Analysis
    {
      step: 12,
      node_id: 'node_unit_economics',
      label: 'Compute unit economics, breakeven, payback, IRR, ROIC, NPV',
      execute: executeUnitEconomicsStub,
    },
    {
      step: 13,
      node_id: 'node_sensitivity_risk',
      label: 'Run sensitivity analysis and Monte Carlo risk simulations',
      execute: executeSensitivityStub,
    },
    {
      step: 14,
      node_id: 'node_confidence',
      label: 'Compute DQI scores and confidence rollups',
      execute: executeConfidenceStub,
    },

    // Stage 7: Finalization
    {
      step: 15,
      node_id: 'emit_run_artifacts',
      label: 'Emit compute run artifacts',
      execute: executeEmitArtifactsStub,
    },
    {
      step: 16,
      node_id: 'validate_cross_artifacts',
      label: 'Cross-validate financial statements',
      execute: executeCrossValidateStub,
    },
    {
      step: 17,
      node_id: 'generate_alerts',
      label: 'Generate alerts for threshold breaches and warnings',
      execute: executeGenerateAlertsStub,
    },
    {
      step: 18,
      node_id: 'finalize_compute_run',
      label: 'Finalize compute run: stamp hashes, record metadata',
      execute: executeFinalizeStub,
    },
  ];
}

// ── Stub implementations for steps 8-18 ──────────────────────────────────────
// These will be fully implemented when their node files are built.

async function executeCapexOpexStub(ctx: ComputeContext, state: PipelineState): Promise<void> {
  // Step 8: capex_opex — depends on node_contribution_stack, node_assumption_packs
  // Formulas from variable_registry:
  //   total_capex = capex_launch + capex_maintenance + capex_scaleup
  //   ebitda = cm4 - fixed_site_costs - shared_operating_allocations
  //   ebit = ebitda - depreciation - amortization
  //   interest_expense = debt_outstanding × interest_rate
  //   tax_expense = MAX(0, (ebit - interest_expense) × tax_rate)
  //   net_income = ebit - interest_expense - tax_expense
  const assumptions = state.assumptions;
  if (!assumptions || !state.planning_spine) return;

  for (const period of state.planning_spine.periods) {
    const pid = period.period_id;
    const fin = state.financials[pid] || {};

    const cm4 = fin.cm4 ?? 0;
    const fixed_site_costs = assumptions.getNumeric('fixed_site_costs', pid);
    const shared_operating_allocations = assumptions.getNumeric('shared_operating_allocations', pid);
    const capex_launch = assumptions.getNumeric('capex_launch', pid);
    const capex_maintenance = assumptions.getNumeric('capex_maintenance', pid);
    const capex_scaleup = assumptions.getNumeric('capex_scaleup', pid);
    const depreciation = assumptions.getNumeric('depreciation', pid);
    const amortization = assumptions.getNumeric('amortization', pid);
    const interest_rate = assumptions.getNumeric('interest_rate', pid);
    const tax_rate = assumptions.getNumeric('tax_rate', pid);
    const debt_outstanding_prior = assumptions.getNumeric('debt_outstanding', pid);

    const total_capex = capex_launch + capex_maintenance + capex_scaleup;
    const ebitda = cm4 - fixed_site_costs - shared_operating_allocations;
    const ebit = ebitda - depreciation - amortization;
    const interest_expense = debt_outstanding_prior * interest_rate;
    const ebt = ebit - interest_expense;
    const tax_expense = Math.max(0, ebt * tax_rate);
    const net_income = ebt - tax_expense;

    Object.assign(fin, {
      total_capex,
      fixed_site_costs,
      shared_operating_allocations,
      depreciation,
      amortization,
      ebitda,
      ebit,
      interest_expense,
      ebt,
      tax_expense,
      net_income,
    });
    state.financials[pid] = fin;

    // Write P&L projections
    const pnlMetrics: Record<string, number> = {
      total_capex,
      ebitda,
      ebit,
      interest_expense,
      tax_expense,
      net_income,
      depreciation,
      amortization,
    };

    for (const [metric_name, value] of Object.entries(pnlMetrics)) {
      await db.query(
        `INSERT INTO pnl_projections
           (id, company_id, scenario_id, version_id, period_id, compute_run_id,
            metric_name, value, currency, is_provisional, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AED', false, NOW(), NOW())
         ON CONFLICT (company_id, scenario_id, version_id, period_id, compute_run_id, metric_name)
         DO UPDATE SET value = $8, updated_at = NOW()`,
        [uuidv4(), ctx.company_id, ctx.scenario_id, ctx.version_id, pid, ctx.run_id, metric_name, value]
      );
    }
  }
}

async function executeWorkingCapitalStub(ctx: ComputeContext, state: PipelineState): Promise<void> {
  // Step 9: working_capital — depends on node_revenue_stack, node_contribution_stack
  // Formulas from variable_registry:
  //   receivables = net_revenue × (receivables_days / days_in_period)
  //   payables = cogs × (payables_days / days_in_period)
  //   inventory = cogs × (inventory_days / days_in_period)
  //   working_capital_movement = Δ(receivables) - Δ(payables) + Δ(inventory)
  const assumptions = state.assumptions;
  if (!assumptions || !state.planning_spine) return;

  const DAYS_IN_MONTH = 30;
  let prior_receivables = 0;
  let prior_payables = 0;
  let prior_inventory = 0;

  for (const period of state.planning_spine.periods) {
    const pid = period.period_id;
    const fin = state.financials[pid] || {};

    const net_revenue = fin.net_revenue ?? 0;
    const cogs = fin.cogs ?? 0;
    const receivables_days = assumptions.getNumeric('receivables_days', pid);
    const payables_days = assumptions.getNumeric('payables_days', pid);
    const inventory_days = assumptions.getNumeric('inventory_days', pid);

    const receivables = net_revenue * (receivables_days / DAYS_IN_MONTH);
    const payables = cogs * (payables_days / DAYS_IN_MONTH);
    const inventory = cogs * (inventory_days / DAYS_IN_MONTH);

    const delta_receivables = receivables - prior_receivables;
    const delta_payables = payables - prior_payables;
    const delta_inventory = inventory - prior_inventory;
    const working_capital_movement = delta_receivables - delta_payables + delta_inventory;

    Object.assign(fin, { receivables, payables, inventory, working_capital_movement });
    state.financials[pid] = fin;

    prior_receivables = receivables;
    prior_payables = payables;
    prior_inventory = inventory;

    await db.query(
      `INSERT INTO cashflow_projections
         (id, company_id, scenario_id, version_id, period_id, compute_run_id,
          metric_name, value, currency, is_provisional, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AED', false, NOW(), NOW())
       ON CONFLICT (company_id, scenario_id, version_id, period_id, compute_run_id, metric_name)
       DO UPDATE SET value = $8, updated_at = NOW()`,
      [uuidv4(), ctx.company_id, ctx.scenario_id, ctx.version_id, pid, ctx.run_id, 'working_capital_movement', working_capital_movement]
    );
  }
}

async function executeBurnRunwayStub(ctx: ComputeContext, state: PipelineState): Promise<void> {
  // Step 10: burn_runway — depends on node_capex_opex, node_working_capital
  // Formulas from variable_registry:
  //   operating_cash_flow = ebitda - working_capital_movement
  //   investing_cash_flow = -total_capex
  //   financing_cash_flow = equity_inflows + debt_drawdowns - debt_repayments - interest_expense
  //   net_change_in_cash = operating_cash_flow + investing_cash_flow + financing_cash_flow
  //   opening_cash = prior period closing_cash
  //   closing_cash = opening_cash + net_change_in_cash
  //   gross_burn = cogs + variable_marketing_promo + variable_labor_fulfillment + site_controllable_opex
  //                + fixed_site_costs + shared_operating_allocations + total_capex + interest_expense
  //   net_burn = gross_burn - net_revenue
  const assumptions = state.assumptions;
  if (!assumptions || !state.planning_spine) return;

  let prior_closing_cash = assumptions.getNumeric('opening_cash_initial', state.planning_spine.periods[0]?.period_id ?? '');

  for (const period of state.planning_spine.periods) {
    const pid = period.period_id;
    const fin = state.financials[pid] || {};

    const ebitda = fin.ebitda ?? 0;
    const working_capital_movement = fin.working_capital_movement ?? 0;
    const total_capex = fin.total_capex ?? 0;
    const interest_expense = fin.interest_expense ?? 0;
    const net_revenue = fin.net_revenue ?? 0;
    const cogs = fin.cogs ?? 0;
    const variable_marketing_promo = fin.variable_marketing_promo ?? assumptions.getNumeric('variable_marketing_promo', pid);
    const variable_labor_fulfillment = fin.variable_labor_fulfillment ?? assumptions.getNumeric('variable_labor_fulfillment', pid);
    const site_controllable_opex = fin.site_controllable_opex ?? assumptions.getNumeric('site_controllable_opex', pid);
    const fixed_site_costs = fin.fixed_site_costs ?? assumptions.getNumeric('fixed_site_costs', pid);
    const shared_operating_allocations = fin.shared_operating_allocations ?? assumptions.getNumeric('shared_operating_allocations', pid);

    const equity_inflows = assumptions.getNumeric('equity_inflows', pid);
    const debt_drawdowns = assumptions.getNumeric('debt_drawdowns', pid);
    const debt_repayments = assumptions.getNumeric('debt_repayments', pid);
    const minimum_cash_buffer = assumptions.getNumeric('minimum_cash_buffer', pid);
    const capex_launch = assumptions.getNumeric('capex_launch', pid);
    const capex_scaleup = assumptions.getNumeric('capex_scaleup', pid);

    const operating_cash_flow = ebitda - working_capital_movement;
    const investing_cash_flow = -total_capex;
    const financing_cash_flow = equity_inflows + debt_drawdowns - debt_repayments - interest_expense;
    const net_change_in_cash = operating_cash_flow + investing_cash_flow + financing_cash_flow;
    const opening_cash = prior_closing_cash;
    const closing_cash = opening_cash + net_change_in_cash;

    const gross_burn =
      cogs +
      variable_marketing_promo +
      variable_labor_fulfillment +
      site_controllable_opex +
      fixed_site_costs +
      shared_operating_allocations +
      total_capex +
      interest_expense;

    const net_burn = gross_burn - net_revenue;
    const normalized_burn = net_burn; // Non-recurring items excluded in future
    const growth_burn = capex_launch + capex_scaleup + variable_marketing_promo;
    const avoidable_burn = growth_burn; // Simplified: all growth burn is deferrable

    const cash_buffer_breach = closing_cash < minimum_cash_buffer;
    const runway = net_burn > 0 ? closing_cash / net_burn : Infinity;

    Object.assign(fin, {
      operating_cash_flow,
      investing_cash_flow,
      financing_cash_flow,
      net_change_in_cash,
      opening_cash,
      closing_cash,
      gross_burn,
      net_burn,
      normalized_burn,
      growth_burn,
      avoidable_burn,
      runway,
      cash_buffer_breach,
    });
    state.financials[pid] = fin;
    prior_closing_cash = closing_cash;

    const cfMetrics: Record<string, number> = {
      operating_cash_flow,
      investing_cash_flow,
      financing_cash_flow,
      net_change_in_cash,
      opening_cash,
      closing_cash,
      gross_burn,
      net_burn,
      normalized_burn,
      growth_burn,
      avoidable_burn,
    };

    for (const [metric_name, value] of Object.entries(cfMetrics)) {
      await db.query(
        `INSERT INTO cashflow_projections
           (id, company_id, scenario_id, version_id, period_id, compute_run_id,
            metric_name, value, currency, is_provisional, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AED', false, NOW(), NOW())
         ON CONFLICT (company_id, scenario_id, version_id, period_id, compute_run_id, metric_name)
         DO UPDATE SET value = $8, updated_at = NOW()`,
        [uuidv4(), ctx.company_id, ctx.scenario_id, ctx.version_id, pid, ctx.run_id, metric_name, value]
      );
    }
  }
}

async function executeBalanceSheetStub(ctx: ComputeContext, state: PipelineState): Promise<void> {
  // Step 11: balance_sheet — depends on node_capex_opex, node_working_capital, node_burn_runway
  // Formulas from variable_registry:
  //   ppe_net = prior_ppe_net + total_capex - depreciation
  //   debt_outstanding = prior_debt_outstanding + debt_drawdowns - debt_repayments
  //   total_assets = closing_cash + ppe_net + receivables + inventory
  //   total_liabilities = debt_outstanding + payables
  //   shareholder_equity = prior_shareholder_equity + equity_inflows + net_income
  //   Validation: total_assets = total_liabilities + shareholder_equity
  const assumptions = state.assumptions;
  if (!assumptions || !state.planning_spine) return;

  let prior_ppe_net = 0;
  let prior_debt_outstanding = assumptions.getNumeric('debt_outstanding', state.planning_spine.periods[0]?.period_id ?? '');
  let prior_shareholder_equity = 0;

  for (const period of state.planning_spine.periods) {
    const pid = period.period_id;
    const fin = state.financials[pid] || {};

    const total_capex = fin.total_capex ?? 0;
    const depreciation = fin.depreciation ?? 0;
    const closing_cash = fin.closing_cash ?? 0;
    const receivables = fin.receivables ?? 0;
    const inventory = fin.inventory ?? 0;
    const payables = fin.payables ?? 0;
    const net_income = fin.net_income ?? 0;
    const equity_inflows = assumptions.getNumeric('equity_inflows', pid);
    const debt_drawdowns = assumptions.getNumeric('debt_drawdowns', pid);
    const debt_repayments = assumptions.getNumeric('debt_repayments', pid);

    const ppe_net = prior_ppe_net + total_capex - depreciation;
    const debt_outstanding = prior_debt_outstanding + debt_drawdowns - debt_repayments;
    const total_assets = closing_cash + ppe_net + receivables + inventory;
    const total_liabilities = debt_outstanding + payables;
    const shareholder_equity = prior_shareholder_equity + equity_inflows + net_income;

    // Validate balance sheet identity
    const imbalance = Math.abs(total_assets - total_liabilities - shareholder_equity);
    if (imbalance > 0.01) {
      console.warn(
        `[balance_sheet] Period ${pid}: BS imbalance of ${imbalance.toFixed(2)} ` +
        `(assets=${total_assets.toFixed(2)}, liabilities=${total_liabilities.toFixed(2)}, equity=${shareholder_equity.toFixed(2)})`
      );
    }

    Object.assign(fin, { ppe_net, debt_outstanding, total_assets, total_liabilities, shareholder_equity });
    state.financials[pid] = fin;

    prior_ppe_net = ppe_net;
    prior_debt_outstanding = debt_outstanding;
    prior_shareholder_equity = shareholder_equity;

    const bsMetrics: Record<string, number> = {
      ppe_net,
      debt_outstanding,
      total_assets,
      total_liabilities,
      shareholder_equity,
    };

    for (const [metric_name, value] of Object.entries(bsMetrics)) {
      await db.query(
        `INSERT INTO balance_sheet_projections
           (id, company_id, scenario_id, version_id, period_id, compute_run_id,
            metric_name, value, currency, is_provisional, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AED', false, NOW(), NOW())
         ON CONFLICT (company_id, scenario_id, version_id, period_id, compute_run_id, metric_name)
         DO UPDATE SET value = $8, updated_at = NOW()`,
        [uuidv4(), ctx.company_id, ctx.scenario_id, ctx.version_id, pid, ctx.run_id, metric_name, value]
      );
    }
  }
}

async function executeUnitEconomicsStub(ctx: ComputeContext, state: PipelineState): Promise<void> {
  // Step 12: unit economics — depends on node_burn_runway, node_balance_sheet
  // Computes per-order metrics, breakeven, payback, IRR, ROIC, NPV, capital intensity
  if (!state.planning_spine) return;

  for (const period of state.planning_spine.periods) {
    const pid = period.period_id;
    const fin = state.financials[pid] || {};

    const realized_orders = fin.realized_orders ?? 0;
    const net_revenue = fin.net_revenue ?? 0;
    const cogs = fin.cogs ?? 0;
    const cm1 = fin.cm1 ?? 0;
    const cm4 = fin.cm4 ?? 0;
    const total_capex = fin.total_capex ?? 0;
    const ebit = fin.ebit ?? 0;
    const practical_capacity = state.assumptions?.getNumeric('practical_capacity', pid) ?? 0;

    // Per-order unit economics (guard division by zero)
    const net_revenue_per_order = realized_orders > 0 ? net_revenue / realized_orders : 0;
    const cogs_per_order = realized_orders > 0 ? cogs / realized_orders : 0;
    const cm1_per_order = realized_orders > 0 ? cm1 / realized_orders : 0;
    const cm4_per_order = realized_orders > 0 ? cm4 / realized_orders : 0;

    // Margin percentages
    const cm1_margin_pct = net_revenue !== 0 ? cm1 / net_revenue : 0;
    const food_cost_pct = net_revenue !== 0 ? cogs / net_revenue : 0;

    // Capacity utilization
    const capacity_utilization = practical_capacity > 0 ? realized_orders / practical_capacity : 0;

    // Capital intensity
    const capital_intensity = net_revenue !== 0 ? total_capex / net_revenue : 0;

    Object.assign(fin, {
      net_revenue_per_order,
      cogs_per_order,
      cm1_per_order,
      cm4_per_order,
      cm1_margin_pct,
      food_cost_pct,
      capacity_utilization,
      capital_intensity,
    });
    state.financials[pid] = fin;
  }
}

async function executeSensitivityStub(_ctx: ComputeContext, _state: PipelineState): Promise<void> {
  // Step 13: Sensitivity & risk analysis — placeholder for Monte Carlo + tornado charts
  // Will be implemented when analysis layer is built
}

async function executeConfidenceStub(_ctx: ComputeContext, _state: PipelineState): Promise<void> {
  // Step 14: DQI scores and confidence rollups — placeholder
  // Will read from confidence_assessments and dqi_scores tables
}

async function executeEmitArtifactsStub(_ctx: ComputeContext, _state: PipelineState): Promise<void> {
  // Step 15: Emit run artifacts — data already written in steps 5-11
  // This step finalizes any remaining artifact emissions
}

async function executeCrossValidateStub(_ctx: ComputeContext, state: PipelineState): Promise<void> {
  // Step 16: Cross-validate P&L ↔ Cash Flow ↔ Balance Sheet reconciliation
  if (!state.planning_spine) return;

  for (const period of state.planning_spine.periods) {
    const pid = period.period_id;
    const fin = state.financials[pid] || {};

    // Validate: operating_cash_flow + investing_cash_flow + financing_cash_flow = net_change_in_cash
    const cf_check =
      (fin.operating_cash_flow ?? 0) +
      (fin.investing_cash_flow ?? 0) +
      (fin.financing_cash_flow ?? 0) -
      (fin.net_change_in_cash ?? 0);

    if (Math.abs(cf_check) > 0.01) {
      console.warn(`[cross-validate] Period ${pid}: Cash flow components do not reconcile. Diff: ${cf_check.toFixed(2)}`);
    }

    // Validate: total_assets = total_liabilities + shareholder_equity
    const bs_check =
      (fin.total_assets ?? 0) -
      (fin.total_liabilities ?? 0) -
      (fin.shareholder_equity ?? 0);

    if (Math.abs(bs_check) > 0.01) {
      console.warn(`[cross-validate] Period ${pid}: Balance sheet imbalance. Diff: ${bs_check.toFixed(2)}`);
    }
  }
}

async function executeGenerateAlertsStub(ctx: ComputeContext, state: PipelineState): Promise<void> {
  // Step 17: Generate alerts for threshold breaches
  if (!state.planning_spine) return;

  const alerts: Array<{ period_id: string; alert_type: string; message: string; severity: string }> = [];

  for (const period of state.planning_spine.periods) {
    const pid = period.period_id;
    const fin = state.financials[pid] || {};

    // Runway warning
    if ((fin.runway ?? Infinity) < 3 && (fin.runway ?? Infinity) > 0) {
      alerts.push({
        period_id: pid,
        alert_type: 'runway_critical',
        message: `Runway below 3 months: ${(fin.runway ?? 0).toFixed(1)} months`,
        severity: 'critical',
      });
    }

    // Cash buffer breach
    if (fin.cash_buffer_breach) {
      alerts.push({
        period_id: pid,
        alert_type: 'cash_buffer_breach',
        message: `Closing cash (${(fin.closing_cash ?? 0).toFixed(0)}) below minimum buffer`,
        severity: 'warning',
      });
    }

    // Negative EBITDA warning
    if ((fin.ebitda ?? 0) < 0) {
      alerts.push({
        period_id: pid,
        alert_type: 'negative_ebitda',
        message: `EBITDA is negative: ${(fin.ebitda ?? 0).toFixed(0)}`,
        severity: 'warning',
      });
    }

    // Negative net revenue
    if ((fin.net_revenue ?? 0) < 0) {
      alerts.push({
        period_id: pid,
        alert_type: 'negative_net_revenue',
        message: 'Net revenue is negative — excessive deductions',
        severity: 'error',
      });
    }
  }

  // Store alerts in compute run metadata
  if (alerts.length > 0) {
    await db.query(
      `UPDATE compute_runs SET metadata = metadata || $1::jsonb WHERE id = $2`,
      [JSON.stringify({ alerts }), ctx.run_id]
    );
  }
}

async function executeFinalizeStub(ctx: ComputeContext, _state: PipelineState): Promise<void> {
  // Step 18: Finalize — stamp hashes, record run metadata, update freshness
  await db.query(
    `UPDATE compute_runs
     SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
         updated_at = NOW()
     WHERE id = $2`,
    [
      JSON.stringify({
        finalized_at: new Date().toISOString(),
        pipeline_version: '1.0.0',
      }),
      ctx.run_id,
    ]
  );
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function executeComputePipeline(ctx: ComputeContext): Promise<void> {
  const steps = buildExecutionPlan();

  const state: PipelineState = {
    planning_spine: null,
    scope_bundle: null,
    decisions: null,
    assumptions: null,
    financials: {},
  };

  // Create compute_run record with status 'running'
  await db.query(
    `INSERT INTO compute_runs
       (id, company_id, scenario_id, version_id, trigger_type, status,
        started_at, run_config, metadata, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'pipeline', 'running', NOW(),
             $5::jsonb, '{}'::jsonb, NOW(), NOW())`,
    [
      ctx.run_id,
      ctx.company_id,
      ctx.scenario_id,
      ctx.version_id,
      JSON.stringify({
        assumption_set_id: ctx.assumption_set_id,
        period_range: ctx.period_range,
        tenant_id: ctx.tenant_id,
      }),
    ]
  );

  let pipelineFailed = false;
  let failedStep: StepDefinition | null = null;
  let failureError: Error | null = null;

  for (const step of steps) {
    // Create compute_run_step record
    const stepId = uuidv4();
    await db.query(
      `INSERT INTO compute_run_steps
         (id, compute_run_id, step_code, step_label, step_order, status,
          started_at, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'running', NOW(), '{}'::jsonb, NOW(), NOW())`,
      [stepId, ctx.run_id, step.node_id, step.label, step.step]
    );

    try {
      await step.execute(ctx, state);

      // Update step status to 'completed'
      await db.query(
        `UPDATE compute_run_steps
         SET status = 'completed', completed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [stepId]
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Update step status to 'failed'
      await db.query(
        `UPDATE compute_run_steps
         SET status = 'failed', completed_at = NOW(), error_message = $1, updated_at = NOW()
         WHERE id = $2`,
        [errorMessage, stepId]
      );

      pipelineFailed = true;
      failedStep = step;
      failureError = err instanceof Error ? err : new Error(String(err));

      // Steps 1-4 are fail-fast — no downstream computation without valid context
      if (step.step <= 4) {
        break;
      }

      // Steps 5+ can potentially continue with partial results,
      // but we break for safety in this implementation
      break;
    }
  }

  // Update compute_run status
  if (pipelineFailed) {
    await db.query(
      `UPDATE compute_runs
       SET status = 'failed',
           completed_at = NOW(),
           error_message = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [
        `Pipeline failed at step ${failedStep?.step} (${failedStep?.node_id}): ${failureError?.message}`,
        ctx.run_id,
      ]
    );

    throw new Error(
      `Compute pipeline failed at step ${failedStep?.step} (${failedStep?.node_id}): ${failureError?.message}`
    );
  } else {
    await db.query(
      `UPDATE compute_runs
       SET status = 'completed',
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [ctx.run_id]
    );
  }
}
