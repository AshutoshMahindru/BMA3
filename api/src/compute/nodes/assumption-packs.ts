/**
 * Step 4: Assumption Pack Resolution
 *
 * Resolves assumption set and all field bindings.
 * Validates completeness (all required assumptions present).
 * Loads all assumption data into a structured context object.
 *
 * Inheritance chain: object-specific > scenario > period > template > global fallback
 *
 * Source: computation_graph.json → node_assumption_packs
 */

import { db } from '../../db';
import { ComputeContext, PipelineState } from '../orchestrator';
import { logger } from '../../lib/logger';

// ── ResolvedAssumptions class ─────────────────────────────────────────────────

/**
 * Structured container for all resolved assumption values.
 * Keyed by variable_name, then by period_id (or '*' for period-independent).
 * Supports grain-aware lookup with fallback hierarchy.
 */
export class ResolvedAssumptions {
  /**
   * Storage: variable_name → period_id → value
   * A period_id of '*' means the value applies across all periods.
   */
  private data: Map<string, Map<string, number>> = new Map();

  /** Track which assumptions have stale or missing evidence */
  public warnings: Array<{ variable: string; period?: string; message: string }> = [];

  set(variable: string, period_id: string, value: number): void {
    if (!this.data.has(variable)) {
      this.data.set(variable, new Map());
    }
    this.data.get(variable)!.set(period_id, value);
  }

  /**
   * Get a numeric assumption value for a variable and period.
   * Fallback chain: specific period → wildcard '*' → 0 with warning.
   */
  getNumeric(variable: string, period_id: string): number {
    const varMap = this.data.get(variable);
    if (!varMap) {
      return 0;
    }

    // Try exact period match
    if (varMap.has(period_id)) {
      return varMap.get(period_id)!;
    }

    // Try wildcard (period-independent assumption)
    if (varMap.has('*')) {
      return varMap.get('*')!;
    }

    // Try first available value as fallback
    const firstValue = varMap.values().next().value;
    if (firstValue !== undefined) {
      return firstValue;
    }

    return 0;
  }

  /** Check if a variable has any values loaded */
  has(variable: string): boolean {
    return this.data.has(variable) && this.data.get(variable)!.size > 0;
  }

  /** Get all variable names that have been loaded */
  getLoadedVariables(): string[] {
    return Array.from(this.data.keys());
  }

  /** Get all period IDs for a given variable */
  getPeriodsForVariable(variable: string): string[] {
    const varMap = this.data.get(variable);
    return varMap ? Array.from(varMap.keys()) : [];
  }
}

// ── Required assumption variables ─────────────────────────────────────────────
// From computation_graph.json node_assumption_packs input_variables

const REQUIRED_ASSUMPTION_VARIABLES = [
  // Demand drivers
  'gross_demand',
  'reach_rate',
  'conversion_rate',
  'retention_rate',
  'capacity_factor',
  'practical_capacity',

  // Revenue
  'average_order_value',
  'discount_rate',
  'refund_rate',
  'channel_fee_rate',

  // Cost
  'cogs_per_unit',
  'variable_marketing_promo',
  'variable_labor_fulfillment',
  'site_controllable_opex',

  // Opex
  'fixed_site_costs',
  'shared_operating_allocations',

  // Capacity
  'utilization_threshold',

  // Working capital
  'receivables_days',
  'payables_days',
  'inventory_days',

  // Funding
  'minimum_cash_buffer',
  'tax_rate',
  'interest_rate',
  'equity_inflows',
  'debt_drawdowns',
  'debt_repayments',

  // Capex
  'capex_launch',
  'capex_maintenance',
  'capex_scaleup',
];

// Critical path assumptions — pipeline cannot proceed without these
const CRITICAL_ASSUMPTIONS = [
  'gross_demand',
  'reach_rate',
  'conversion_rate',
  'average_order_value',
  'cogs_per_unit',
];

// ── Main execution ────────────────────────────────────────────────────────────

export async function executeAssumptionPacks(
  ctx: ComputeContext,
  state: PipelineState
): Promise<void> {
  if (!state.decisions) {
    throw new Error('[assumption-packs] Decisions not resolved — cannot resolve assumptions');
  }

  if (!state.planning_spine) {
    throw new Error('[assumption-packs] Planning spine not resolved');
  }

  const assumptions = new ResolvedAssumptions();

  // ── Step 1: Load assumption packs bound to the active assumption set ────
  // Canonical SpecOS links packs to assumption sets through
  // assumption_pack_bindings. We prefer that path, then fall back to the
  // compatibility alias column added by migration 004 for older local DBs.
  const packsResult = await db.query(
    `SELECT ap.id AS pack_id
     FROM assumption_packs ap
     JOIN assumption_pack_bindings apb
       ON apb.pack_id = ap.id
     WHERE ap.company_id = $1
       AND apb.assumption_set_id = $2
       AND ap.is_deleted = FALSE
       AND ap.status::text NOT IN ('rejected', 'archived', 'deprecated')
     ORDER BY COALESCE(ap.assumption_family, ap.family), ap.created_at DESC`,
    [ctx.company_id, ctx.assumption_set_id]
  );

  let packIds = packsResult.rows.map((r: any) => r.pack_id);

  if (packIds.length === 0) {
    const compatibilityPacks = await db.query(
      `SELECT ap.id AS pack_id
     FROM assumption_packs ap
     WHERE ap.company_id = $1
       AND ap.assumption_set_id = $2
       AND ap.is_deleted = FALSE
       AND ap.status::text NOT IN ('rejected', 'archived', 'deprecated')
     ORDER BY COALESCE(ap.assumption_family, ap.family), ap.created_at DESC`,
      [ctx.company_id, ctx.assumption_set_id]
    );

    packIds = compatibilityPacks.rows.map((r: any) => r.pack_id);
  }

  // ── Step 2-7: Load all field bindings with inheritance chain ────────────
  // Query assumption_field_bindings for all relevant packs
  // Inheritance: is_override=true takes precedence over inherited values
  let bindingsResult;

  if (packIds.length > 0) {
    bindingsResult = await db.query(
      `SELECT afb.variable_name,
              afb.grain_signature,
              afb.value,
              afb.unit,
              afb.is_override,
              afb.pack_id
      FROM assumption_field_bindings afb
       WHERE afb.pack_id = ANY($1)
       ORDER BY afb.is_override DESC, afb.created_at DESC`,
      [packIds]
    );
  } else {
    // Fallback: keep the same assumption-set boundary even when the initial
    // pack lookup returned no linked packs. Prefer the canonical pack-binding
    // join, then tolerate the compatibility alias column for older local DBs.
    bindingsResult = await db.query(
      `SELECT afb.variable_name,
              afb.grain_signature,
              afb.value,
              afb.unit,
              afb.is_override,
              afb.pack_id
       FROM assumption_field_bindings afb
       JOIN assumption_packs ap ON ap.id = afb.pack_id
       JOIN assumption_pack_bindings apb ON apb.pack_id = ap.id
       WHERE ap.company_id = $1
         AND apb.assumption_set_id = $2
         AND ap.is_deleted = FALSE
         AND ap.status::text NOT IN ('rejected', 'archived', 'deprecated')
       ORDER BY afb.is_override DESC, afb.created_at DESC`,
      [ctx.company_id, ctx.assumption_set_id]
    );

    if (bindingsResult.rowCount === 0) {
      bindingsResult = await db.query(
        `SELECT afb.variable_name,
                afb.grain_signature,
                afb.value,
                afb.unit,
                afb.is_override,
                afb.pack_id
         FROM assumption_field_bindings afb
         JOIN assumption_packs ap ON ap.id = afb.pack_id
         WHERE ap.company_id = $1
           AND ap.assumption_set_id = $2
           AND ap.is_deleted = FALSE
           AND ap.status::text NOT IN ('rejected', 'archived', 'deprecated')
         ORDER BY afb.is_override DESC, afb.created_at DESC`,
        [ctx.company_id, ctx.assumption_set_id]
      );
    }
  }

  // ── Process bindings into ResolvedAssumptions ───────────────────────────
  // Track which variable+period combos we've already set (first wins due to ORDER BY)
  const seen = new Set<string>();

  for (const binding of bindingsResult.rows) {
    const varName = binding.variable_name;

    // Canonical bindings may arrive as a scalar numeric or a structured JSON value.
    let numericValue = 0;
    if (binding.value !== null && binding.value !== undefined) {
      const rawValue = typeof binding.value === 'object' && binding.value !== null
        ? (binding.value.value ?? binding.value.numeric ?? binding.value.amount ?? 0)
        : binding.value;

      numericValue = typeof rawValue === 'number'
        ? rawValue
        : parseFloat(String(rawValue));
    }

    if (isNaN(numericValue)) {
      numericValue = 0;
    }

    // Determine which period(s) this binding applies to
    const grain = binding.grain_signature || {};
    const periodId = grain.period_id || '*';

    const key = `${varName}::${periodId}`;
    if (!seen.has(key)) {
      assumptions.set(varName, periodId, numericValue);
      seen.add(key);
    }
  }

  // ── Step 8: Validate grain completeness ─────────────────────────────────
  // Every critical assumption must be declared at its grain
  const missingCritical: string[] = [];
  for (const varName of CRITICAL_ASSUMPTIONS) {
    if (!assumptions.has(varName)) {
      missingCritical.push(varName);
    }
  }

  if (missingCritical.length > 0) {
    throw new Error(
      `Missing critical assumptions with no fallback: ${missingCritical.join(', ')}. ` +
      `Cannot proceed with compute pipeline.`
    );
  }

  // ── Step 9: Flag stale, missing, or impossible values ───────────────────
  for (const varName of REQUIRED_ASSUMPTION_VARIABLES) {
    if (!assumptions.has(varName)) {
      assumptions.warnings.push({
        variable: varName,
        message: `Assumption '${varName}' not found in any pack — defaulting to 0`,
      });
    }
  }

  // Validate impossible values
  const rateVariables = [
    'reach_rate',
    'conversion_rate',
    'retention_rate',
    'capacity_factor',
    'discount_rate',
    'refund_rate',
    'channel_fee_rate',
    'tax_rate',
  ];

  for (const varName of rateVariables) {
    if (assumptions.has(varName)) {
      for (const pid of assumptions.getPeriodsForVariable(varName)) {
        const val = assumptions.getNumeric(varName, pid);
        if (val < 0) {
          assumptions.warnings.push({
            variable: varName,
            period: pid,
            message: `Impossible value: ${varName}=${val} is negative`,
          });
        }
        if (val > 1 && varName !== 'channel_fee_rate') {
          assumptions.warnings.push({
            variable: varName,
            period: pid,
            message: `Suspicious value: ${varName}=${val} exceeds 1.0 (100%)`,
          });
        }
      }
    }
  }

  // Check incompatible combinations: discount + refund + channel fee rates sum > 100%
  for (const period of state.planning_spine.periods) {
    const pid = period.period_id;
    const discountRate = assumptions.getNumeric('discount_rate', pid);
    const refundRate = assumptions.getNumeric('refund_rate', pid);
    const channelFeeRate = assumptions.getNumeric('channel_fee_rate', pid);
    const totalDeductions = discountRate + refundRate + channelFeeRate;

    if (totalDeductions >= 1.0) {
      assumptions.warnings.push({
        variable: 'deduction_rates',
        period: pid,
        message: `Discount(${discountRate}) + Refund(${refundRate}) + Channel(${channelFeeRate}) = ${totalDeductions} >= 100%`,
      });
    }
  }

  // ── Step 10: Emit resolved assumption snapshot ──────────────────────────
  if (assumptions.warnings.length > 0) {
    logger.warn(
      {
        module: 'assumption-packs',
        count: assumptions.warnings.length,
        warnings: assumptions.warnings,
      },
      'assumption-packs %d warnings',
      assumptions.warnings.length
    );
  }

  state.assumptions = assumptions;

  logger.info(
    {
      loadedVariables: assumptions.getLoadedVariables().length,
      packCount: packIds.length,
      warnings: assumptions.warnings.length,
    },
    'assumption-packs resolved'
  );
}
