/**
 * Step 8: Capex & Opex Computation
 *
 * Extends the CM waterfall from CM4 (site-level profitability) down through
 * the full P&L: EBITDA → EBIT → EBT → Tax → Net Income.
 *
 * INPUT variables:
 *   - cm4 (from contribution-stack, step 7, via pipeline state)
 *   - fixed_site_costs (from assumption_field_bindings)
 *   - shared_operating_allocations (from assumption_field_bindings)
 *   - capex_launch (from assumption_field_bindings)
 *   - capex_maintenance (from assumption_field_bindings)
 *   - capex_scaleup (from assumption_field_bindings)
 *   - depreciation (from assumption_field_bindings — schedule-derived)
 *   - amortization (from assumption_field_bindings — schedule-derived)
 *   - interest_rate (from assumption_field_bindings)
 *   - tax_rate (from assumption_field_bindings)
 *   - debt_outstanding (from assumption_field_bindings — prior balance)
 *
 * FORMULAS (from variable_registry.json):
 *   total_capex = capex_launch + capex_maintenance + capex_scaleup
 *   ebitda = cm4 - fixed_site_costs - shared_operating_allocations
 *   ebit = ebitda - depreciation - amortization
 *   interest_expense = debt_outstanding × interest_rate
 *   ebt = ebit - interest_expense
 *   tax_expense = MAX(0, ebt × tax_rate)  — no tax on losses
 *   net_income = ebt - tax_expense
 *
 * GOLDEN TEST (single_kitchen_base_month):
 *   ebitda = 3100.00 - 8000.00 - 5000.00 = -9900.00
 *   ebit = -9900.00 - 3000.00 - 500.00 = -13400.00
 *   ebt = -13400.00 - 1500.00 = -14900.00
 *   tax = max(0, -14900 × 0.09) = 0.00
 *   net_income = -14900.00
 *
 * GOLDEN TEST (growth_scenario_month_6):
 *   ebitda = 57682.20 - 8000 - 5000 = 44682.20
 *   ebit = 44682.20 - 3000 - 500 = 41182.20
 *   ebt = 41182.20 - 1400 = 39782.20
 *   tax = 39782.20 × 0.09 = 3580.40
 *   net_income = 39782.20 - 3580.40 = 36201.80
 *
 * OUTPUT (written to pnl_projections via metric_name/value pattern):
 *   - total_capex, ebitda, ebit, interest_expense, tax_expense, net_income,
 *     depreciation, amortization
 *
 * Source: computation_graph.json → node_capex_opex
 * Golden tests: test_fixtures.json → steps 12-16
 */

import { ComputeContext, PipelineState } from '../orchestrator';
import { logger } from '../../lib/logger';
import { replaceProjectionMetric } from '../projections';

export async function executeCapexOpex(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  if (!state.assumptions) {
    throw new Error('[capex-opex] Assumptions not resolved — cannot compute EBITDA/EBIT waterfall');
  }

  if (!state.planning_spine) {
    throw new Error('[capex-opex] Planning spine not resolved');
  }

  const assumptions = state.assumptions;

  for (const period of state.planning_spine.periods) {
    const pid = period.period_id;
    const fin = state.financials[pid];

    if (!fin) {
      throw new Error(
        `[capex-opex] Period ${period.label}: No financial state — ` +
        `contribution-stack must run first`
      );
    }

    // ── Read upstream CM4 from pipeline state ──────────────────────────────
    const cm4 = fin.cm4;
    if (cm4 === undefined) {
      throw new Error(
        `[capex-opex] Period ${period.label}: cm4 not computed — ` +
        `contribution-stack (step 7) must run first`
      );
    }

    // ── Load assumptions ───────────────────────────────────────────────────
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

    // ── Step 1: Compute total capex ────────────────────────────────────────
    // total_capex = capex_launch + capex_maintenance + capex_scaleup
    const total_capex = capex_launch + capex_maintenance + capex_scaleup;

    // ── Step 2: Compute EBITDA ─────────────────────────────────────────────
    // ebitda = cm4 - fixed_site_costs - shared_operating_allocations
    const ebitda = cm4 - fixed_site_costs - shared_operating_allocations;

    // ── Step 3: Compute EBIT ───────────────────────────────────────────────
    // ebit = ebitda - depreciation - amortization
    const ebit = ebitda - depreciation - amortization;

    // ── Step 4: Compute interest expense ───────────────────────────────────
    // interest_expense = debt_outstanding × interest_rate
    const interest_expense = debt_outstanding_prior * interest_rate;

    // ── Step 5: Compute EBT ────────────────────────────────────────────────
    // ebt = ebit - interest_expense
    const ebt = ebit - interest_expense;

    // ── Step 6: Compute tax expense ────────────────────────────────────────
    // tax_expense = MAX(0, ebt × tax_rate) — no tax on losses
    const tax_expense = Math.max(0, ebt * tax_rate);

    // ── Step 7: Compute net income ─────────────────────────────────────────
    // net_income = ebt - tax_expense
    const net_income = ebt - tax_expense;

    // ── Validations ────────────────────────────────────────────────────────

    // Capex scheduled for period before site launch date
    if (total_capex < 0) {
      logger.warn(
        { periodLabel: period.label, totalCapex: total_capex },
        'Capex/opex detected negative total capex',
      );
    }

    // Negative EBITDA warning
    if (ebitda < 0) {
      logger.warn(
        { periodLabel: period.label, ebitda },
        'Capex/opex detected negative EBITDA',
      );
    }

    // ── Store in pipeline state ────────────────────────────────────────────
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

    // ── Write to pnl_projections ───────────────────────────────────────────
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
      await replaceProjectionMetric('pnl_projections', ctx, pid, metric_name, value);
    }

    logger.info(
      {
        periodLabel: period.label,
        ebitda,
        ebit,
        ebt,
        taxExpense: tax_expense,
        netIncome: net_income,
        totalCapex: total_capex,
      },
      'Capex/opex computed for period',
    );
  }
}
