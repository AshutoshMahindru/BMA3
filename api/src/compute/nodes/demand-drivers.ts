/**
 * Step 5: Demand & Commercial Drivers
 *
 * Computes realized_orders from gross_demand through reach, conversion,
 * and capacity filters.
 *
 * INPUT variables (from assumption_field_bindings):
 *   - gross_demand: unconstrained market demand opportunity
 *   - reach_rate: proportion of demand accessible through chosen channels
 *   - conversion_rate: conversion from reached demand to placed orders
 *   - retention_rate: repeat/returning customer contribution (loaded for context)
 *   - capacity_factor: MIN(1.0, practical_capacity / unconstrained_demand)
 *   - practical_capacity: orders per period baseline
 *
 * FORMULA (from variable_registry.json + test_fixtures.json golden outputs):
 *   realized_orders = gross_demand × reach_rate × conversion_rate × capacity_factor
 *
 * OUTPUT (written to pnl_projections):
 *   - realized_orders
 *
 * Grain: company + scenario + period (aggregated from market×channel×product_family)
 *
 * Source: computation_graph.json → node_demand_drivers
 * Golden tests: test_fixtures.json → step_01_realized_orders
 */

import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import { ComputeContext, PipelineState } from '../orchestrator';
import { logger } from '../../lib/logger';

export async function executeDemandDrivers(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  if (!state.assumptions) {
    throw new Error('[demand-drivers] Assumptions not resolved — cannot compute demand');
  }

  if (!state.planning_spine) {
    throw new Error('[demand-drivers] Planning spine not resolved');
  }

  const assumptions = state.assumptions;

  for (const period of state.planning_spine.periods) {
    const pid = period.period_id;

    // ── Load input variables from assumptions ─────────────────────────────
    const gross_demand = assumptions.getNumeric('gross_demand', pid);
    const reach_rate = assumptions.getNumeric('reach_rate', pid);
    const conversion_rate = assumptions.getNumeric('conversion_rate', pid);
    const retention_rate = assumptions.getNumeric('retention_rate', pid); // loaded for reference
    const practical_capacity = assumptions.getNumeric('practical_capacity', pid);

    // ── Compute capacity_factor ───────────────────────────────────────────
    // capacity_factor = MIN(1.0, practical_capacity / unconstrained_demand) per site
    // If practical_capacity is 0 or not set, default to 1.0 (no constraint)
    let capacity_factor = assumptions.getNumeric('capacity_factor', pid);
    if (capacity_factor === 0 && practical_capacity > 0 && gross_demand > 0) {
      const unconstrained_demand = gross_demand * reach_rate * conversion_rate;
      capacity_factor = Math.min(1.0, practical_capacity / unconstrained_demand);
    } else if (capacity_factor === 0) {
      capacity_factor = 1.0; // No constraint
    }

    // ── Compute realized_orders ───────────────────────────────────────────
    // Formula: gross_demand × reach_rate × conversion_rate × capacity_factor
    // Note: retention_rate affects gross_demand composition but is not a multiplicative
    // filter in the orders pipeline (confirmed by golden test fixtures).
    const realized_orders = gross_demand * reach_rate * conversion_rate * capacity_factor;

    // ── Validate ──────────────────────────────────────────────────────────
    if (realized_orders > gross_demand) {
      logger.warn(
        { periodLabel: period.label, realizedOrders: realized_orders, grossDemand: gross_demand },
        'Demand drivers produced realized orders above gross demand',
      );
    }

    if (gross_demand === 0) {
      logger.warn(
        { periodLabel: period.label },
        'Demand drivers found zero gross demand',
      );
    }

    // ── Store in pipeline state ───────────────────────────────────────────
    if (!state.financials[pid]) {
      state.financials[pid] = {};
    }
    state.financials[pid].realized_orders = realized_orders;
    state.financials[pid].gross_demand = gross_demand;

    // ── Write to pnl_projections ──────────────────────────────────────────
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
        'realized_orders',
        realized_orders,
      ]
    );

    logger.info(
      {
        periodLabel: period.label,
        grossDemand: gross_demand,
        reachRate: reach_rate,
        conversionRate: conversion_rate,
        retentionRate: retention_rate,
        capacityFactor: capacity_factor,
        realizedOrders: realized_orders,
      },
      'Demand drivers computed for period',
    );
  }
}
