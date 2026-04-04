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
import { logger } from '../lib/logger';

// ── Node imports ──────────────────────────────────────────────────────────────
import { executePlanningSpine } from './nodes/planning-spine';
import { executeScopeBundle } from './nodes/scope-bundle';
import { executeDecisions } from './nodes/decisions';
import { executeAssumptionPacks, ResolvedAssumptions } from './nodes/assumption-packs';
import { executeDemandDrivers } from './nodes/demand-drivers';
import { executeRevenueStack } from './nodes/revenue-stack';
import { executeContributionStack } from './nodes/contribution-stack';
import { executeUnitEconomics } from './nodes/unit-economics';
import { executeSensitivityRisk } from './nodes/sensitivity-risk';
import { executeConfidence } from './nodes/confidence';
import { executeCapexOpex } from './nodes/capex-opex';
import { executeWorkingCapital } from './nodes/working-capital';
import { executeBurnRunway } from './nodes/burn-runway';
import { executeBalanceSheet } from './nodes/balance-sheet';
import { projectionCountsByRun, replaceRunArtifacts } from './run-artifacts';

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
      execute: executeCapexOpex,
    },
    {
      step: 9,
      node_id: 'node_working_capital',
      label: 'Compute working capital movement',
      execute: executeWorkingCapital,
    },
    {
      step: 10,
      node_id: 'node_burn_runway',
      label: 'Compute cash flow statement, burn metrics, and runway',
      execute: executeBurnRunway,
    },
    {
      step: 11,
      node_id: 'node_balance_sheet',
      label: 'Compute balance sheet: assets, liabilities, equity',
      execute: executeBalanceSheet,
    },

    // Stage 6: Analysis
    {
      step: 12,
      node_id: 'node_unit_economics',
      label: 'Compute unit economics, breakeven, payback, IRR, ROIC, NPV',
      execute: executeUnitEconomics,
    },
    {
      step: 13,
      node_id: 'node_sensitivity_risk',
      label: 'Run sensitivity analysis and Monte Carlo risk simulations',
      execute: executeSensitivityRisk,
    },
    {
      step: 14,
      node_id: 'node_confidence',
      label: 'Compute DQI scores and confidence rollups',
      execute: executeConfidence,
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

// ── Stub implementations for steps 15-18 ─────────────────────────────────────
// Steps 8-11 are fully implemented in their own node files.
// Steps 12-14 are now fully implemented in their own node files.
// These stubs (15-18) will be replaced when the finalization layer is built.

// Steps 12-14 are now fully implemented in their own node files:
// - nodes/unit-economics.ts (Step 12)
// - nodes/sensitivity-risk.ts (Step 13)
// - nodes/confidence.ts (Step 14)

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
      logger.warn(
        { periodId: pid, cashflowDifference: Number(cf_check.toFixed(2)) },
        'Cross-validation found cash flow reconciliation mismatch',
      );
    }

    // Validate: total_assets = total_liabilities + shareholder_equity
    const bs_check =
      (fin.total_assets ?? 0) -
      (fin.total_liabilities ?? 0) -
      (fin.shareholder_equity ?? 0);

    if (Math.abs(bs_check) > 0.01) {
      logger.warn(
        { periodId: pid, balanceSheetDifference: Number(bs_check.toFixed(2)) },
        'Cross-validation found balance sheet imbalance',
      );
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

export async function executeComputePipeline(ctx: ComputeContext): Promise<PipelineState> {
  const steps = buildExecutionPlan();

  const state: PipelineState = {
    planning_spine: null,
    scope_bundle: null,
    decisions: null,
    assumptions: null,
    financials: {},
  };

  const runConfig = JSON.stringify({
    assumption_set_id: ctx.assumption_set_id,
    period_range: ctx.period_range,
    tenant_id: ctx.tenant_id,
  });

  const existingRun = await db.query(
    `SELECT id
       FROM compute_runs
      WHERE id = $1`,
    [ctx.run_id],
  );

  if (Number(existingRun.rowCount || 0) === 0) {
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
        runConfig,
      ]
    );
  } else {
    await db.query(
      `UPDATE compute_runs
          SET status = 'running',
              started_at = COALESCE(started_at, NOW()),
              completed_at = NULL,
              error_message = NULL,
              run_config = COALESCE(run_config, '{}'::jsonb) || $2::jsonb,
              updated_at = NOW()
        WHERE id = $1`,
      [ctx.run_id, runConfig],
    );
    await db.query(`DELETE FROM compute_run_steps WHERE compute_run_id = $1`, [ctx.run_id]);
    await db.query(`DELETE FROM compute_run_artifacts WHERE compute_run_id = $1`, [ctx.run_id]);
    await db.query(`DELETE FROM compute_dependency_snapshots WHERE compute_run_id = $1`, [ctx.run_id]);
  }

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
    const outputCounts = await projectionCountsByRun(ctx.run_id);
    await replaceRunArtifacts({
      runId: ctx.run_id,
      companyId: ctx.company_id,
      scenarioId: ctx.scenario_id,
      versionId: ctx.version_id,
      assumptionSetId: ctx.assumption_set_id,
      scopeBundleId: state.scope_bundle?.scope_bundle_id || null,
      counts: outputCounts,
    });

    await db.query(
      `UPDATE compute_runs
       SET status = 'completed',
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [ctx.run_id, JSON.stringify({ outputCounts })]
    );
  }

  return state;
}
