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

import { ComputeContext, PipelineState } from '../orchestrator';
import { logger } from '../../lib/logger';
import { replaceProjectionMetric } from '../projections';

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
      logger.warn(
        { periodLabel: period.label, ppeNet: ppe_net },
        'Balance sheet detected negative PPE from over-depreciation',
      );
    }

    // ── Step 2: Compute debt outstanding ───────────────────────────────────
    // debt_outstanding = prior_debt_outstanding + debt_drawdowns - debt_repayments
    const debt_outstanding = prior_debt_outstanding + debt_drawdowns - debt_repayments;

    // Validate: debt should not go negative
    if (debt_outstanding < 0) {
      logger.warn(
        { periodLabel: period.label, debtOutstanding: debt_outstanding },
        'Balance sheet detected negative debt outstanding',
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
      logger.warn(
        {
          periodLabel: period.label,
          imbalance,
          totalAssets: total_assets,
          totalLiabilities: total_liabilities,
          shareholderEquity: shareholder_equity,
        },
        'Balance sheet identity check failed',
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
      await replaceProjectionMetric('balance_sheet_projections', ctx, pid, metric_name, value);
    }

    logger.info(
      {
        periodLabel: period.label,
        totalAssets: total_assets,
        closingCash: closing_cash,
        ppeNet: ppe_net,
        receivables,
        inventory,
        totalLiabilities: total_liabilities,
        debtOutstanding: debt_outstanding,
        payables,
        shareholderEquity: shareholder_equity,
        isBalanced: imbalance <= 0.01,
        imbalance,
      },
      'Balance sheet computed for period',
    );
  }
}
