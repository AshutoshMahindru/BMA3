/**
 * Step 10: Burn, Runway & Cash Flow Statement
 *
 * Builds the three-section cash flow statement (operating, investing, financing),
 * computes burn metrics (gross, net, normalized, growth, avoidable), and
 * derives cash balances and runway.
 *
 * INPUT variables (from pipeline state + assumptions):
 *   - ebitda (from capex-opex, step 8)
 *   - working_capital_movement (from working-capital, step 9)
 *   - total_capex (from capex-opex, step 8)
 *   - interest_expense (from capex-opex, step 8)
 *   - net_revenue (from revenue-stack, step 6)
 *   - cogs (from contribution-stack, step 7)
 *   - variable_marketing_promo, variable_labor_fulfillment, site_controllable_opex (step 7)
 *   - fixed_site_costs, shared_operating_allocations (step 8)
 *   - equity_inflows (from assumption_field_bindings)
 *   - debt_drawdowns (from assumption_field_bindings)
 *   - debt_repayments (from assumption_field_bindings)
 *   - minimum_cash_buffer (from assumption_field_bindings)
 *   - capex_launch, capex_scaleup (from assumption_field_bindings)
 *
 * FORMULAS (from variable_registry.json):
 *   operating_cash_flow = ebitda - working_capital_movement
 *   investing_cash_flow = -total_capex
 *   financing_cash_flow = equity_inflows + debt_drawdowns - debt_repayments - interest_expense
 *   net_change_in_cash = operating_cash_flow + investing_cash_flow + financing_cash_flow
 *   opening_cash = prior_period closing_cash (or initial cash for period 1)
 *   closing_cash = opening_cash + net_change_in_cash
 *
 *   gross_burn = cogs + variable_marketing_promo + variable_labor_fulfillment
 *              + site_controllable_opex + fixed_site_costs + shared_operating_allocations
 *              + total_capex + interest_expense
 *   net_burn = gross_burn - net_revenue
 *   normalized_burn = net_burn (excluding non-recurring — simplified)
 *   growth_burn = capex_launch + capex_scaleup + variable_marketing_promo
 *   avoidable_burn = growth_burn (simplified: all growth burn is deferrable)
 *
 *   runway = closing_cash / net_burn (months remaining, if burning)
 *
 * OUTPUT (written to cashflow_projections via metric_name/value pattern):
 *   - operating_cash_flow, investing_cash_flow, financing_cash_flow,
 *     net_change_in_cash, opening_cash, closing_cash,
 *     gross_burn, net_burn, normalized_burn, growth_burn, avoidable_burn
 *
 * Source: computation_graph.json → node_burn_runway
 */

import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import { ComputeContext, PipelineState } from '../orchestrator';

export async function executeBurnRunway(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  if (!state.assumptions) {
    throw new Error('[burn-runway] Assumptions not resolved — cannot compute cash flow');
  }

  if (!state.planning_spine) {
    throw new Error('[burn-runway] Planning spine not resolved');
  }

  const assumptions = state.assumptions;
  const periods = state.planning_spine.periods;

  // Resolve initial cash balance for the first period.
  // Tries 'opening_cash_initial' first, falls back to 0.
  let prior_closing_cash = assumptions.getNumeric(
    'opening_cash_initial',
    periods[0]?.period_id ?? ''
  );

  for (const period of periods) {
    const pid = period.period_id;
    const fin = state.financials[pid];

    if (!fin) {
      throw new Error(
        `[burn-runway] Period ${period.label}: No financial state — ` +
        `capex-opex and working-capital must run first`
      );
    }

    // ── Read upstream values from pipeline state ───────────────────────────
    const ebitda = fin.ebitda ?? 0;
    const working_capital_movement = fin.working_capital_movement ?? 0;
    const total_capex = fin.total_capex ?? 0;
    const interest_expense = fin.interest_expense ?? 0;
    const net_revenue = fin.net_revenue ?? 0;
    const cogs = fin.cogs ?? 0;

    // Cost items — prefer pipeline state (set by contribution-stack & capex-opex),
    // fall back to assumptions
    const variable_marketing_promo =
      fin.variable_marketing_promo ?? assumptions.getNumeric('variable_marketing_promo', pid);
    const variable_labor_fulfillment =
      fin.variable_labor_fulfillment ?? assumptions.getNumeric('variable_labor_fulfillment', pid);
    const site_controllable_opex =
      fin.site_controllable_opex ?? assumptions.getNumeric('site_controllable_opex', pid);
    const fixed_site_costs =
      fin.fixed_site_costs ?? assumptions.getNumeric('fixed_site_costs', pid);
    const shared_operating_allocations =
      fin.shared_operating_allocations ?? assumptions.getNumeric('shared_operating_allocations', pid);

    // ── Load funding assumptions ───────────────────────────────────────────
    const equity_inflows = assumptions.getNumeric('equity_inflows', pid);
    const debt_drawdowns = assumptions.getNumeric('debt_drawdowns', pid);
    const debt_repayments = assumptions.getNumeric('debt_repayments', pid);
    const minimum_cash_buffer = assumptions.getNumeric('minimum_cash_buffer', pid);
    const capex_launch = assumptions.getNumeric('capex_launch', pid);
    const capex_scaleup = assumptions.getNumeric('capex_scaleup', pid);

    // ── Step 1: Operating cash flow ────────────────────────────────────────
    // operating_cash_flow = ebitda - working_capital_movement
    const operating_cash_flow = ebitda - working_capital_movement;

    // ── Step 2: Investing cash flow ────────────────────────────────────────
    // investing_cash_flow = -total_capex
    const investing_cash_flow = -total_capex;

    // ── Step 3: Financing cash flow ────────────────────────────────────────
    // financing_cash_flow = equity_inflows + debt_drawdowns - debt_repayments - interest_expense
    const financing_cash_flow =
      equity_inflows + debt_drawdowns - debt_repayments - interest_expense;

    // ── Step 4: Net change in cash ─────────────────────────────────────────
    // net_change_in_cash = operating_cash_flow + investing_cash_flow + financing_cash_flow
    const net_change_in_cash =
      operating_cash_flow + investing_cash_flow + financing_cash_flow;

    // ── Step 5: Opening cash ───────────────────────────────────────────────
    // opening_cash = prior period closing_cash (or initial cash for period 1)
    const opening_cash = prior_closing_cash;

    // ── Step 6: Closing cash ───────────────────────────────────────────────
    // closing_cash = opening_cash + net_change_in_cash
    const closing_cash = opening_cash + net_change_in_cash;

    // ── Step 7: Gross burn ─────────────────────────────────────────────────
    // gross_burn = sum of all cash outflows
    const gross_burn =
      cogs +
      variable_marketing_promo +
      variable_labor_fulfillment +
      site_controllable_opex +
      fixed_site_costs +
      shared_operating_allocations +
      total_capex +
      interest_expense;

    // ── Step 8: Net burn ───────────────────────────────────────────────────
    // net_burn = gross_burn - net_revenue
    const net_burn = gross_burn - net_revenue;

    // ── Step 9: Normalized burn ────────────────────────────────────────────
    // normalized_burn = net_burn excluding non-recurring items (simplified)
    const normalized_burn = net_burn;

    // ── Step 10: Growth burn ───────────────────────────────────────────────
    // growth_burn = capex_launch + capex_scaleup + variable_marketing_promo
    const growth_burn = capex_launch + capex_scaleup + variable_marketing_promo;

    // ── Step 11: Avoidable burn ────────────────────────────────────────────
    // avoidable_burn = burn from deferrable decisions (simplified: = growth_burn)
    const avoidable_burn = growth_burn;

    // ── Step 12: Cash buffer breach check ──────────────────────────────────
    const cash_buffer_breach = closing_cash < minimum_cash_buffer;
    if (cash_buffer_breach) {
      console.warn(
        `[burn-runway] Period ${period.label}: Closing cash (${closing_cash.toFixed(2)}) ` +
        `below minimum buffer (${minimum_cash_buffer.toFixed(2)})`
      );
    }

    // Negative closing cash = insolvency risk
    if (closing_cash < 0) {
      console.warn(
        `[burn-runway] Period ${period.label}: Negative closing cash (${closing_cash.toFixed(2)}) — insolvency risk`
      );
    }

    // ── Step 13: Runway calculation ────────────────────────────────────────
    // runway = closing_cash / net_burn (months remaining, if burning)
    const runway = net_burn > 0 ? closing_cash / net_burn : Infinity;

    // Runway < 3 months = critical warning
    if (runway < 3 && runway > 0) {
      console.warn(
        `[burn-runway] Period ${period.label}: Runway below 3 months (${runway.toFixed(1)})`
      );
    }

    // ── Validate cash flow reconciliation ──────────────────────────────────
    const cf_check = Math.abs(
      operating_cash_flow + investing_cash_flow + financing_cash_flow - net_change_in_cash
    );
    if (cf_check > 0.01) {
      console.warn(
        `[burn-runway] Period ${period.label}: Cash flow components do not reconcile. Diff: ${cf_check.toFixed(4)}`
      );
    }

    // ── Store in pipeline state ────────────────────────────────────────────
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

    // Advance the carry-forward for next period
    prior_closing_cash = closing_cash;

    // ── Write to cashflow_projections ───────────────────────────────────────
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
        [
          uuidv4(),
          ctx.company_id,
          ctx.scenario_id,
          ctx.version_id,
          pid,
          ctx.run_id,
          metric_name,
          value,
        ]
      );
    }

    console.log(
      `[burn-runway] Period ${period.label}: ` +
      `ocf=${operating_cash_flow.toFixed(2)}, icf=${investing_cash_flow.toFixed(2)}, ` +
      `fcf=${financing_cash_flow.toFixed(2)}, net_cash=${net_change_in_cash.toFixed(2)}, ` +
      `closing=${closing_cash.toFixed(2)}, net_burn=${net_burn.toFixed(2)}, ` +
      `runway=${runway === Infinity ? '∞' : runway.toFixed(1) + 'mo'}`
    );
  }
}
