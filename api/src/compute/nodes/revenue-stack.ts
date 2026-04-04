/**
 * Step 6: Revenue Stack Computation
 *
 * Computes the full revenue waterfall from gross_sales down to net_revenue.
 *
 * INPUT variables:
 *   - realized_orders (from demand-drivers, step 5)
 *   - average_order_value (from assumption_field_bindings)
 *   - discount_rate (from assumption_field_bindings)
 *   - refund_rate (from assumption_field_bindings)
 *   - channel_fee_rate (from assumption_field_bindings)
 *
 * FORMULAS (from variable_registry.json + test_fixtures.json golden outputs):
 *   gross_sales        = realized_orders × average_order_value
 *   discounts          = discount_rate × gross_sales
 *   refunds_adjustments = refund_rate × gross_sales
 *   channel_fees       = channel_fee_rate × gross_sales
 *   net_revenue        = gross_sales - discounts - refunds_adjustments - channel_fees
 *
 * Note on channel_fees formula: The variable_registry specifies
 *   channel_fees = channel_fee_rate × (gross_sales - discounts - refunds_adjustments)
 * However, the golden test fixtures compute channel_fees as:
 *   channel_fees = channel_fee_rate × gross_sales
 * This implementation follows the golden test fixtures as the authoritative source.
 *
 * OUTPUT (written to pnl_projections):
 *   - gross_sales, discounts, refunds_adjustments, channel_fees, net_revenue
 *
 * Source: computation_graph.json → node_revenue_stack
 * Golden tests: test_fixtures.json → steps 02-06
 */

import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import { ComputeContext, PipelineState } from '../orchestrator';

export async function executeRevenueStack(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  if (!state.assumptions) {
    throw new Error('[revenue-stack] Assumptions not resolved — cannot compute revenue');
  }

  if (!state.planning_spine) {
    throw new Error('[revenue-stack] Planning spine not resolved');
  }

  const assumptions = state.assumptions;

  for (const period of state.planning_spine.periods) {
    const pid = period.period_id;
    const fin = state.financials[pid];

    if (!fin) {
      throw new Error(
        `[revenue-stack] Period ${period.label}: No financial state — demand-drivers must run first`
      );
    }

    const realized_orders = fin.realized_orders;
    if (realized_orders === undefined) {
      throw new Error(
        `[revenue-stack] Period ${period.label}: realized_orders not computed — demand-drivers must run first`
      );
    }

    // ── Load input assumptions ────────────────────────────────────────────
    const average_order_value = assumptions.getNumeric('average_order_value', pid);
    const discount_rate = assumptions.getNumeric('discount_rate', pid);
    const refund_rate = assumptions.getNumeric('refund_rate', pid);
    const channel_fee_rate = assumptions.getNumeric('channel_fee_rate', pid);

    // Validate: missing AOV with orders > 0
    if (realized_orders > 0 && average_order_value === 0) {
      console.warn(
        `[revenue-stack] Period ${period.label}: Missing average_order_value ` +
        `for grain with realized_orders=${realized_orders}`
      );
    }

    // ── Step 1: Compute gross_sales ───────────────────────────────────────
    // gross_sales = realized_orders × average_order_value
    const gross_sales = realized_orders * average_order_value;

    // ── Step 2: Compute discounts ─────────────────────────────────────────
    // discounts = discount_rate × gross_sales
    const discounts = discount_rate * gross_sales;

    // ── Step 3: Compute refunds_adjustments ───────────────────────────────
    // refunds_adjustments = refund_rate × gross_sales
    const refunds_adjustments = refund_rate * gross_sales;

    // ── Step 4-5: Compute channel_fees ────────────────────────────────────
    // Per golden test fixtures: channel_fees = channel_fee_rate × gross_sales
    // Applied on gross_sales (not on gross_revenue after deductions)
    const channel_fees = channel_fee_rate * gross_sales;

    // ── Step 6: Compute net_revenue ───────────────────────────────────────
    // net_revenue = gross_sales - discounts - refunds_adjustments - channel_fees
    const net_revenue = gross_sales - discounts - refunds_adjustments - channel_fees;

    // ── Step 7: Validate ──────────────────────────────────────────────────
    if (net_revenue < 0) {
      console.warn(
        `[revenue-stack] Period ${period.label}: Net revenue is negative (${net_revenue.toFixed(2)}) ` +
        `— indicates excessive deductions. Discount(${discount_rate}) + Refund(${refund_rate}) ` +
        `+ Channel(${channel_fee_rate}) = ${(discount_rate + refund_rate + channel_fee_rate).toFixed(4)}`
      );
    }

    // Validate sum of rates
    const totalDeductionRate = discount_rate + refund_rate + channel_fee_rate;
    if (totalDeductionRate > 1.0) {
      console.warn(
        `[revenue-stack] Period ${period.label}: Total deduction rates (${totalDeductionRate.toFixed(4)}) ` +
        `exceed 100% — would produce negative revenue`
      );
    }

    // ── Store in pipeline state ───────────────────────────────────────────
    Object.assign(fin, {
      gross_sales,
      discounts,
      refunds_adjustments,
      channel_fees,
      net_revenue,
    });

    // ── Step 8: Write to pnl_projections ──────────────────────────────────
    const revenueMetrics: Record<string, number> = {
      gross_sales,
      discounts,
      refunds_adjustments,
      channel_fees,
      net_revenue,
    };

    for (const [metric_name, value] of Object.entries(revenueMetrics)) {
      await db.query(
        `INSERT INTO pnl_projections
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
      `[revenue-stack] Period ${period.label}: ` +
      `gross_sales=${gross_sales.toFixed(2)}, discounts=${discounts.toFixed(2)}, ` +
      `refunds=${refunds_adjustments.toFixed(2)}, channel_fees=${channel_fees.toFixed(2)}, ` +
      `net_revenue=${net_revenue.toFixed(2)}`
    );
  }
}
