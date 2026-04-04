/**
 * Step 11: Balance Sheet Computation
 *
 * Builds the balance sheet from cumulative asset, liability, and equity positions.
 * Validates the fundamental accounting identity: Assets = Liabilities + Equity.
 *
 * INPUT variables (from pipeline state + assumptions):
 *   - closing_cash (from burn-runway, step 10)
 *   - receivables, inventory (from working-capital, step 9)
 *   - payables (from working-capital, step 9)
 *   - total_capex, depreciation (from capex-opex, step 8)
 *   - net_income (from capex-opex, step 8)
 *   - equity_inflows (from assumption_field_bindings)
 *   - debt_drawdowns (from assumption_field_bindings)
 *   - debt_repayments (from assumption_field_bindings)
 *
 * FORMULAS (from variable_registry.json):
 *   ppe_net = prior_ppe_net + total_capex - depreciation
 *   debt_outstanding = prior_debt_outstanding + debt_drawdowns - debt_repayments
 *   total_assets = closing_cash + ppe_net + receivables + inventory
 *   total_liabilities = debt_outstanding + payables
 *   shareholder_equity = prior_shareholder_equity + equity_inflows + net_income
 *
 * IDENTITY VALIDATION:
 *   total_assets MUST equal total_liabilities + shareholder_equity
 *   Tolerance: ±0.01 (rounding)
 *
 * FIRST PERIOD HANDLING:
 *   - prior_ppe_net = 0
 *   - prior_debt_outstanding = loaded from assumptions (initial debt balance)
 *   - prior_shareholder_equity = 0
 *
 * OUTPUT (written to balance_sheet_projections via metric_name/value pattern):
 *   - ppe_net, debt_outstanding, total_assets, total_liabilities, shareholder_equity
 *
 * Source: computation_graph.json → node_balance_sheet
 */

import { db } from '../../db';
import { v4 as uuidv4 } from 'uuid';
import { ComputeContext, PipelineState } from '../orchestrator';

export async function executeBalanceSheet(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  if (!state.assumptions) {
    throw new Error('[balance-sheet] Assumptions not resolved — cannot compute balance sheet');
  }

  if (!state.planning_spine) {
    throw new Error('[balance-sheet] Planning spine not resolved');
  }

  const assumptions = state.assumptions;
  const periods = state.planning_spine.periods;

  // Initialize carry-forward balances.
  // First period: prior PPE and equity are 0; initial debt from assumptions.
  let prior_ppe_net = 0;
  let prior_debt_outstanding = assumptions.getNumeric(
    'debt_outstanding',
    periods[0]?.period_id ?? ''
  );
  let prior_shareholder_equity = 0;

  for (const period of periods) {
    const pid = period.period_id;
    const fin = state.financials[pid];

    if (!fin) {
      throw new Error(
        `[balance-sheet] Period ${period.label}: No financial state — ` +
        `upstream nodes must run first`
      );
    }

    // ── Read upstream values from pipeline state ───────────────────────────
    const total_capex = fin.total_capex ?? 0;
    const depreciation = fin.depreciation ?? 0;
    const closing_cash = fin.closing_cash ?? 0;
    const receivables = fin.receivables ?? 0;
    const inventory = fin.inventory ?? 0;
    const payables = fin.payables ?? 0;
    const net_income = fin.net_income ?? 0;

    // ── Load funding assumptions ───────────────────────────────────────────
    const equity_inflows = assumptions.getNumeric('equity_inflows', pid);
    const debt_drawdowns = assumptions.getNumeric('debt_drawdowns', pid);
    const debt_repayments = assumptions.getNumeric('debt_repayments', pid);

    // ── Step 1: Compute PPE (net) ──────────────────────────────────────────
    // ppe_net = prior_ppe_net + total_capex - depreciation
    const ppe_net = prior_ppe_net + total_capex - depreciation;

    // Validate: PPE should not go negative (over-depreciation)
    if (ppe_net < 0) {
      console.warn(
        `[balance-sheet] Period ${period.label}: Negative PPE (${ppe_net.toFixed(2)}) — ` +
        `over-depreciation detected`
      );
    }

    // ── Step 2: Compute debt outstanding ───────────────────────────────────
    // debt_outstanding = prior_debt_outstanding + debt_drawdowns - debt_repayments
    const debt_outstanding = prior_debt_outstanding + debt_drawdowns - debt_repayments;

    // Validate: debt should not go negative
    if (debt_outstanding < 0) {
      console.warn(
        `[balance-sheet] Period ${period.label}: Negative debt outstanding (${debt_outstanding.toFixed(2)}) — ` +
        `repayments exceed balance`
      );
    }

    // ── Step 3: Compute total assets ───────────────────────────────────────
    // total_assets = closing_cash + ppe_net + receivables + inventory
    const total_assets = closing_cash + ppe_net + receivables + inventory;

    // ── Step 4: Compute total liabilities ──────────────────────────────────
    // total_liabilities = debt_outstanding + payables
    const total_liabilities = debt_outstanding + payables;

    // ── Step 5: Compute shareholder equity ─────────────────────────────────
    // shareholder_equity = prior_shareholder_equity + equity_inflows + net_income
    const shareholder_equity = prior_shareholder_equity + equity_inflows + net_income;

    // ── Step 6: VALIDATE balance sheet identity ────────────────────────────
    // total_assets MUST equal total_liabilities + shareholder_equity
    const imbalance = Math.abs(total_assets - total_liabilities - shareholder_equity);
    if (imbalance > 0.01) {
      console.warn(
        `[balance-sheet] Period ${period.label}: BALANCE SHEET DOES NOT BALANCE! ` +
        `Imbalance: ${imbalance.toFixed(4)} ` +
        `(assets=${total_assets.toFixed(2)}, liabilities=${total_liabilities.toFixed(2)}, ` +
        `equity=${shareholder_equity.toFixed(2)})`
      );
    }

    // ── Store in pipeline state ────────────────────────────────────────────
    Object.assign(fin, {
      ppe_net,
      debt_outstanding,
      total_assets,
      total_liabilities,
      shareholder_equity,
    });

    // Advance carry-forward balances
    prior_ppe_net = ppe_net;
    prior_debt_outstanding = debt_outstanding;
    prior_shareholder_equity = shareholder_equity;

    // ── Write to balance_sheet_projections ──────────────────────────────────
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
      `[balance-sheet] Period ${period.label}: ` +
      `assets=${total_assets.toFixed(2)} (cash=${closing_cash.toFixed(2)}, ppe=${ppe_net.toFixed(2)}, ` +
      `ar=${receivables.toFixed(2)}, inv=${inventory.toFixed(2)}), ` +
      `liabilities=${total_liabilities.toFixed(2)} (debt=${debt_outstanding.toFixed(2)}, ap=${payables.toFixed(2)}), ` +
      `equity=${shareholder_equity.toFixed(2)}, ` +
      `balanced=${imbalance <= 0.01 ? 'YES' : 'NO (' + imbalance.toFixed(4) + ')'}`
    );
  }
}
