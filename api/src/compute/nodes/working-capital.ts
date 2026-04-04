/**
 * Step 9: Working Capital Computation
 *
 * Computes working capital balances and period-over-period movement from
 * receivables, payables, and inventory timing assumptions.
 *
 * INPUT variables:
 *   - net_revenue (from revenue-stack, step 6, via pipeline state)
 *   - cogs (from contribution-stack, step 7, via pipeline state)
 *   - receivables_days (from assumption_field_bindings)
 *   - payables_days (from assumption_field_bindings)
 *   - inventory_days (from assumption_field_bindings)
 *
 * FORMULAS (from variable_registry.json + computation_graph.json):
 *   receivables = net_revenue × (receivables_days / days_in_period)
 *   payables = cogs × (payables_days / days_in_period)
 *   inventory = cogs × (inventory_days / days_in_period)
 *
 *   Δ(receivables) = current_period_receivables - prior_period_receivables
 *   Δ(payables)    = current_period_payables - prior_period_payables
 *   Δ(inventory)   = current_period_inventory - prior_period_inventory
 *
 *   working_capital_movement = Δ(receivables) - Δ(payables) + Δ(inventory)
 *     positive movement = cash consumed
 *     negative movement = cash released
 *
 * FIRST PERIOD HANDLING:
 *   Prior period balances default to 0 (no prior period data).
 *   This means the entire balance is treated as cash consumed/released.
 *
 * OUTPUT:
 *   - working_capital_movement → written to cashflow_projections
 *   - receivables, payables, inventory → stored in pipeline state for balance sheet
 *
 * Source: computation_graph.json → node_working_capital
 */

import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import { ComputeContext, PipelineState } from '../orchestrator';

/** Standard days-in-month for working capital timing calculations */
const DAYS_IN_MONTH = 30;

export async function executeWorkingCapital(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  if (!state.assumptions) {
    throw new Error('[working-capital] Assumptions not resolved — cannot compute WC movement');
  }

  if (!state.planning_spine) {
    throw new Error('[working-capital] Planning spine not resolved');
  }

  const assumptions = state.assumptions;

  // Track prior period balances for delta computation.
  // First period: prior = 0 (no prior period data exists).
  let prior_receivables = 0;
  let prior_payables = 0;
  let prior_inventory = 0;

  for (const period of state.planning_spine.periods) {
    const pid = period.period_id;
    const fin = state.financials[pid];

    if (!fin) {
      throw new Error(
        `[working-capital] Period ${period.label}: No financial state — ` +
        `revenue-stack and contribution-stack must run first`
      );
    }

    // ── Read upstream values from pipeline state ───────────────────────────
    const net_revenue = fin.net_revenue ?? 0;
    const cogs = fin.cogs ?? 0;

    // ── Load timing assumptions ────────────────────────────────────────────
    const receivables_days = assumptions.getNumeric('receivables_days', pid);
    const payables_days = assumptions.getNumeric('payables_days', pid);
    const inventory_days = assumptions.getNumeric('inventory_days', pid);

    // ── Validate timing assumptions ────────────────────────────────────────
    if (receivables_days > DAYS_IN_MONTH) {
      console.warn(
        `[working-capital] Period ${period.label}: receivables_days (${receivables_days}) ` +
        `exceeds period length (${DAYS_IN_MONTH}) — may be invalid`
      );
    }
    if (payables_days < 0 || inventory_days < 0) {
      console.warn(
        `[working-capital] Period ${period.label}: Negative payables_days or inventory_days`
      );
    }

    // ── Step 1: Compute receivables balance ────────────────────────────────
    // receivables = net_revenue × (receivables_days / days_in_period)
    const receivables = net_revenue * (receivables_days / DAYS_IN_MONTH);

    // ── Step 2: Compute payables balance ───────────────────────────────────
    // payables = cogs × (payables_days / days_in_period)
    const payables = cogs * (payables_days / DAYS_IN_MONTH);

    // ── Step 3: Compute inventory balance ──────────────────────────────────
    // inventory = cogs × (inventory_days / days_in_period)
    const inventory = cogs * (inventory_days / DAYS_IN_MONTH);

    // ── Step 4-6: Compute deltas ───────────────────────────────────────────
    const delta_receivables = receivables - prior_receivables;
    const delta_payables = payables - prior_payables;
    const delta_inventory = inventory - prior_inventory;

    // ── Step 7: Compute working capital movement ───────────────────────────
    // working_capital_movement = Δ(receivables) - Δ(payables) + Δ(inventory)
    // Positive = cash consumed; Negative = cash released
    const working_capital_movement = delta_receivables - delta_payables + delta_inventory;

    // ── Validate ───────────────────────────────────────────────────────────
    // Working capital swing exceeds revenue (likely data error)
    if (net_revenue > 0 && Math.abs(working_capital_movement) > net_revenue) {
      console.warn(
        `[working-capital] Period ${period.label}: WC movement (${working_capital_movement.toFixed(2)}) ` +
        `exceeds net_revenue (${net_revenue.toFixed(2)}) — possible data error`
      );
    }

    // ── Store in pipeline state ────────────────────────────────────────────
    // receivables, payables, inventory are needed by balance-sheet (step 11)
    Object.assign(fin, {
      receivables,
      payables,
      inventory,
      working_capital_movement,
    });

    // Update prior period tracking
    prior_receivables = receivables;
    prior_payables = payables;
    prior_inventory = inventory;

    // ── Write to cashflow_projections ───────────────────────────────────────
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
        'working_capital_movement',
        working_capital_movement,
      ]
    );

    console.log(
      `[working-capital] Period ${period.label}: ` +
      `receivables=${receivables.toFixed(2)}, payables=${payables.toFixed(2)}, ` +
      `inventory=${inventory.toFixed(2)}, wc_movement=${working_capital_movement.toFixed(2)}`
    );
  }
}
