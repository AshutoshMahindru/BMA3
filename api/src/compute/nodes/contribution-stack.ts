/**
 * Step 7: Contribution Margin Waterfall
 *
 * Computes the CM waterfall from net_revenue down through four contribution
 * margin layers to site-level profitability.
 *
 * INPUT variables:
 *   - net_revenue (from revenue-stack, step 6)
 *   - cogs_per_unit (from assumption_field_bindings)
 *   - realized_orders (from demand-drivers, step 5)
 *   - variable_marketing_promo (from assumption_field_bindings)
 *   - variable_labor_fulfillment (from assumption_field_bindings)
 *   - site_controllable_opex (from assumption_field_bindings)
 *
 * FORMULAS (from variable_registry.json + test_fixtures.json golden outputs):
 *   cogs = cogs_per_unit × realized_orders
 *   cm1  = net_revenue - cogs                        (Gross Margin after COGS)
 *   cm2  = cm1 - variable_marketing_promo            (Contribution after promo pressure)
 *   cm3  = cm2 - variable_labor_fulfillment          (Contribution after labor/fulfillment)
 *   cm4  = cm3 - site_controllable_opex              (Site-level profitability)
 *
 * MARGIN PERCENTAGES:
 *   cm1_margin = cm1 / net_revenue
 *   cm2_margin = cm2 / net_revenue
 *   cm3_margin = cm3 / net_revenue
 *   cm4_margin = cm4 / net_revenue
 *
 * Note on task description mapping:
 *   The task says cm1 = Gross Margin, cm2 = Variable Contribution,
 *   cm3 = Kitchen-Level Contribution with fixed_site_labor.
 *   However, the variable_registry.json defines:
 *     cm2 = cm1 - variable_marketing_promo
 *     cm3 = cm2 - variable_labor_fulfillment
 *     cm4 = cm3 - site_controllable_opex
 *   The golden test fixtures confirm this 4-layer waterfall.
 *   This implementation follows variable_registry + golden fixtures exactly.
 *
 * OUTPUT (written to pnl_projections):
 *   - cogs, cm1, cm2, cm3, cm4
 *
 * Source: computation_graph.json → node_contribution_stack
 * Golden tests: test_fixtures.json → steps 07-11
 */

import { ComputeContext, PipelineState } from '../orchestrator';
import { logger } from '../../lib/logger';
import { replaceProjectionMetric } from '../projections';

export async function executeContributionStack(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  if (!state.assumptions) {
    throw new Error('[contribution-stack] Assumptions not resolved — cannot compute CM waterfall');
  }

  if (!state.planning_spine) {
    throw new Error('[contribution-stack] Planning spine not resolved');
  }

  const assumptions = state.assumptions;

  for (const period of state.planning_spine.periods) {
    const pid = period.period_id;
    const fin = state.financials[pid];

    if (!fin) {
      throw new Error(
        `[contribution-stack] Period ${period.label}: No financial state — ` +
        `revenue-stack must run first`
      );
    }

    const net_revenue = fin.net_revenue;
    const realized_orders = fin.realized_orders;

    if (net_revenue === undefined || realized_orders === undefined) {
      throw new Error(
        `[contribution-stack] Period ${period.label}: net_revenue or realized_orders ` +
        `not computed — upstream nodes must run first`
      );
    }

    // ── Load cost assumptions ─────────────────────────────────────────────
    const cogs_per_unit = assumptions.getNumeric('cogs_per_unit', pid);
    const variable_marketing_promo = assumptions.getNumeric('variable_marketing_promo', pid);
    const variable_labor_fulfillment = assumptions.getNumeric('variable_labor_fulfillment', pid);
    const site_controllable_opex = assumptions.getNumeric('site_controllable_opex', pid);

    // ── Step 1: Compute COGS ──────────────────────────────────────────────
    // cogs = cogs_per_unit × realized_orders
    const cogs = cogs_per_unit * realized_orders;

    // ── Step 2: Compute CM1 — Gross Contribution after COGS ───────────────
    // cm1 = net_revenue - cogs
    const cm1 = net_revenue - cogs;

    // ── Step 3: Compute CM2 — Contribution after promo pressure ───────────
    // cm2 = cm1 - variable_marketing_promo
    const cm2 = cm1 - variable_marketing_promo;

    // ── Step 4: Compute CM3 — Contribution after labor/fulfillment ────────
    // cm3 = cm2 - variable_labor_fulfillment
    const cm3 = cm2 - variable_labor_fulfillment;

    // ── Step 5: Compute CM4 — Site-level profitability ────────────────────
    // cm4 = cm3 - site_controllable_opex
    const cm4 = cm3 - site_controllable_opex;

    // ── Step 6: Compute margin percentages ────────────────────────────────
    const cm1_margin = net_revenue !== 0 ? cm1 / net_revenue : 0;
    const cm2_margin = net_revenue !== 0 ? cm2 / net_revenue : 0;
    const cm3_margin = net_revenue !== 0 ? cm3 / net_revenue : 0;
    const cm4_margin = net_revenue !== 0 ? cm4 / net_revenue : 0;

    // ── Step 7: Validate ──────────────────────────────────────────────────
    // CM layer monotonic descent (CM1 >= CM2 >= CM3 >= CM4) when all costs non-negative
    if (variable_marketing_promo >= 0 && variable_labor_fulfillment >= 0 && site_controllable_opex >= 0) {
      if (cm1 < cm2 || cm2 < cm3 || cm3 < cm4) {
        logger.warn(
          { periodLabel: period.label, cm1, cm2, cm3, cm4 },
          'Contribution stack detected non-monotonic CM descent',
        );
      }
    }

    // Negative CM1 = COGS exceeds net revenue
    if (cm1 < 0) {
      logger.warn(
        { periodLabel: period.label, cm1, cogs, netRevenue: net_revenue },
        'Contribution stack detected negative CM1',
      );
    }

    // Missing cost assumptions for grains with revenue
    if (net_revenue > 0 && cogs_per_unit === 0) {
      logger.warn(
        { periodLabel: period.label, cogsPerUnit: cogs_per_unit, netRevenue: net_revenue },
        'Contribution stack found zero COGS assumption on revenue-bearing period',
      );
    }

    // ── Store in pipeline state ───────────────────────────────────────────
    Object.assign(fin, {
      cogs,
      cm1,
      cm2,
      cm3,
      cm4,
      cm1_margin,
      cm2_margin,
      cm3_margin,
      cm4_margin,
      variable_marketing_promo,
      variable_labor_fulfillment,
      site_controllable_opex,
    });

    // ── Step 8: Write to pnl_projections ──────────────────────────────────
    const cmMetrics: Record<string, number> = {
      cogs,
      cm1,
      cm2,
      cm3,
      cm4,
    };

    for (const [metric_name, value] of Object.entries(cmMetrics)) {
      await replaceProjectionMetric('pnl_projections', ctx, pid, metric_name, value);
    }

    logger.info(
      {
        periodLabel: period.label,
        cogs,
        cm1,
        cm1MarginPct: cm1_margin * 100,
        cm2,
        cm3,
        cm4,
        cm4MarginPct: cm4_margin * 100,
      },
      'Contribution stack computed for period',
    );
  }
}
