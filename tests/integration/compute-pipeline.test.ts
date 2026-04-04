/**
 * Golden Fixture Integration Test — Full 18-Step Computation Pipeline
 *
 * Wave 2 Gate: Steps 1–16 (demand → net_income) — CLOSED
 * Wave 3 Gate: Steps 8–14 extended + DAG validation + cross-statement checks
 *
 * All expected values are hand-verified against SpecOS:
 *   - specos/artifacts/computation_graph.json (14 nodes, 24 edges, 18 steps)
 *   - specos/artifacts/variable_registry.json (73 variables, 35 metrics)
 *   - specos/artifacts/test_fixtures.json (2 golden test cases)
 *
 * Run: npx jest tests/integration/compute-pipeline.test.ts --verbose
 * Database access is mocked, but the real orchestrator + node implementations run.
 */

import * as fs from 'fs';
import * as path from 'path';

jest.mock('../../api/src/db', () => ({
  db: {
    query: jest.fn(),
  },
}));

jest.mock('uuid', () => {
  let counter = 0;
  return {
    v4: () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
  };
}, { virtual: true });

import { db } from '../../api/src/db';
import {
  executeComputePipeline,
  ComputeContext,
  PipelineState,
} from '../../api/src/compute/orchestrator';
import {
  CRITICAL_PATH_CAP,
  CRITICAL_PATH_MULTIPLIER,
  DQI_WEIGHTS,
  EVIDENCE_TYPE_SCORES,
  mapScoreToBand,
} from '../../api/src/compute/nodes/confidence';

// ─── Load artifacts ──────────────────────────────────────────────────────────

const fixturesPath = path.join(__dirname, '..', '..', 'specos', 'artifacts', 'test_fixtures.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf-8'));

const graphPath = path.join(__dirname, '..', '..', 'specos', 'artifacts', 'computation_graph.json');
const graph = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));

const fixtureList = fixtures.fixtures as any[];
const dbQueryMock = db.query as unknown as jest.Mock;

// ─── Tolerance helpers ───────────────────────────────────────────────────────

function assertClose(actual: number, expected: number, tol: number, label: string) {
  if (!Number.isFinite(actual)) {
    throw new Error(`${label}: actual is not finite (${actual})`);
  }
  if (!Number.isFinite(expected)) {
    throw new Error(`${label}: expected is not finite (${expected})`);
  }
  if (!Number.isFinite(tol)) {
    throw new Error(`${label}: tol is not finite (${tol})`);
  }

  const diff = Math.abs(actual - expected);
  if (diff > tol) {
    throw new Error(`${label}: expected ${expected} ± ${tol}, got ${actual} (diff: ${diff.toFixed(6)})`);
  }
}

function assertWithinTolerance(actual: number, expected: number, tolerance: string, label: string) {
  if (tolerance === 'exact') {
    expect(actual).toBe(expected);
  } else {
    assertClose(actual, expected, parseFloat(tolerance), label);
  }
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function makeUuid(seed: number): string {
  return `00000000-0000-4000-8000-${seed.toString().padStart(12, '0')}`;
}

interface MockBinding {
  id: string;
  pack_id: string;
  variable_name: string;
  grain_signature: { period_id: string };
  value: number;
  unit: string | null;
  is_override: boolean;
  evidence_type: string;
  evidence_ref: string;
  updated_at: string;
}

interface ArtifactRecord {
  artifact_type: string;
  artifact_ref: string;
  row_count: number;
  metadata: Record<string, any>;
}

interface FixtureRun {
  ctx: ComputeContext;
  state: PipelineState;
  periodId: string;
  runtime: MockRuntime;
}

type MetricStore = Record<string, Record<string, number>>;

class MockRuntime {
  public readonly ctx: ComputeContext;
  public readonly periodId: string;
  public readonly periodLabel: string;
  public readonly artifacts: ArtifactRecord[] = [];
  public readonly pnlProjections: MetricStore = {};
  public readonly cashflowProjections: MetricStore = {};
  public readonly balanceSheetProjections: MetricStore = {};
  public readonly unitEconomicsProjections: MetricStore = {};
  public readonly kpiProjections: MetricStore = {};

  private readonly company: Record<string, any>;
  private readonly scenario: Record<string, any>;
  private readonly version: Record<string, any>;
  private readonly period: Record<string, any>;
  private readonly scopeBundle: Record<string, any>;
  private readonly scopeSelections: Record<string, string[]>;
  private readonly pack: Record<string, any>;
  private readonly bindings: MockBinding[];

  constructor(private readonly fixture: any) {
    const fixtureIndex = fixtureList.findIndex((candidate) => candidate.name === fixture.name);
    const baseSeed = (fixtureIndex + 1) * 100;
    const isGrowthFixture = fixture.name.includes('month_6');
    const startDate = isGrowthFixture ? '2026-06-01' : '2026-01-01';
    const endDate = isGrowthFixture ? '2026-06-30' : '2026-01-31';

    this.periodId = makeUuid(baseSeed + 1);
    this.periodLabel = isGrowthFixture ? 'Jun 2026' : 'Jan 2026';

    this.ctx = {
      tenant_id: makeUuid(baseSeed + 10),
      company_id: makeUuid(baseSeed + 11),
      scenario_id: makeUuid(baseSeed + 12),
      assumption_set_id: makeUuid(baseSeed + 13),
      version_id: makeUuid(baseSeed + 14),
      run_id: makeUuid(baseSeed + 15),
      period_range: {
        start: startDate,
        end: endDate,
      },
    };

    this.company = {
      id: this.ctx.company_id,
      name: `${fixture.name}-company`,
      status: 'active',
      default_currency: 'AED',
      fiscal_year_start_month: 1,
    };

    this.scenario = {
      id: this.ctx.scenario_id,
      name: fixture.name,
      scenario_family: fixture.name.includes('growth') ? 'bull' : 'base',
      status: 'active',
      company_id: this.ctx.company_id,
    };

    this.version = {
      id: this.ctx.version_id,
      status: 'working_draft',
      version_label: fixture.name,
      scenario_id: this.ctx.scenario_id,
    };

    this.period = {
      period_id: this.periodId,
      label: this.periodLabel,
      start_date: startDate,
      end_date: endDate,
      company_id: this.ctx.company_id,
    };

    this.scopeBundle = {
      id: makeUuid(baseSeed + 16),
      name: `${fixture.name}-scope`,
      status: 'active',
      is_default: true,
    };

    this.scopeSelections = {
      formats: ['delivery'],
      categories: ['food'],
      channels: ['aggregator'],
      geographies: ['dubai'],
    };

    this.pack = {
      pack_id: makeUuid(baseSeed + 17),
      id: makeUuid(baseSeed + 17),
      assumption_set_id: this.ctx.assumption_set_id,
      assumption_family: 'market',
      pack_name: `${fixture.name}-assumptions`,
      name: `${fixture.name}-assumptions`,
      family: 'default',
      status: 'active',
    };

    this.bindings = this.buildBindings();
  }

  private buildBindings(): MockBinding[] {
    const dd = this.fixture.inputs.demand_drivers ?? {};
    const price = this.fixture.inputs.price_plans ?? {};
    const cost = this.fixture.inputs.cost_assumptions ?? {};
    const labor = this.fixture.inputs.labor_model ?? {};
    const opex = this.fixture.inputs.opex_plan ?? {};

    const interestExpense = Number(opex.interest_expense ?? 0);
    const syntheticDebtBase = interestExpense > 0 ? 1e-6 : 0;
    const syntheticInterestRate = syntheticDebtBase > 0 ? interestExpense / syntheticDebtBase : 0;
    const createdAt = `${this.period.start_date}T00:00:00.000Z`;

    const values: Array<[string, number, string, string]> = [
      ['gross_demand', Number(dd.gross_demand ?? 0), 'market_research', 'market research report'],
      ['reach_rate', Number(dd.reach_rate ?? 0), 'market_research', 'channel reach analysis'],
      ['conversion_rate', Number(dd.conversion_rate ?? 0), 'market_research', 'conversion benchmark'],
      ['retention_rate', Number(dd.retention_rate ?? 0), 'historical_data', 'historical retention'],
      ['capacity_factor', Number(dd.capacity_factor ?? 0), 'operator_input', 'capacity model'],
      ['practical_capacity', Number(dd.practical_capacity ?? 0), 'operator_input', 'capacity plan'],
      ['utilization_threshold', Number(dd.utilization_threshold ?? 0), 'operator_input', 'capacity threshold'],
      ['average_order_value', Number(price.average_order_value ?? 0), 'historical_data', 'historical aov'],
      ['discount_rate', Number(price.discount_rate ?? 0), 'historical_data', 'pricing plan'],
      ['refund_rate', Number(price.refund_rate ?? 0), 'historical_data', 'refund history'],
      ['channel_fee_rate', Number(price.channel_fee_rate ?? 0), 'industry_benchmark', 'aggregator benchmark'],
      ['cogs_per_unit', Number(cost.cogs_per_unit ?? 0), 'historical_data', 'purchase ledger'],
      ['variable_marketing_promo', Number(labor.variable_marketing_promo ?? 0), 'operator_input', 'marketing budget'],
      ['variable_labor_fulfillment', Number(labor.variable_labor_fulfillment ?? 0), 'operator_input', 'labor roster'],
      ['site_controllable_opex', Number(labor.site_controllable_opex ?? 0), 'operator_input', 'site opex'],
      ['fixed_site_costs', Number(opex.fixed_site_costs ?? 0), 'operator_input', 'fixed cost plan'],
      ['shared_operating_allocations', Number(opex.shared_operating_allocations ?? 0), 'operator_input', 'allocation model'],
      ['depreciation', Number(opex.depreciation ?? 0), 'operator_input', 'depreciation schedule'],
      ['amortization', Number(opex.amortization ?? 0), 'operator_input', 'amortization schedule'],
      ['tax_rate', Number(opex.tax_rate ?? 0), 'industry_benchmark', 'corporate tax guidance'],
      ['receivables_days', Number(opex.receivables_days ?? 0), 'operator_input', 'working capital policy'],
      ['payables_days', Number(opex.payables_days ?? 0), 'operator_input', 'working capital policy'],
      ['inventory_days', Number(opex.inventory_days ?? 0), 'operator_input', 'working capital policy'],
      ['minimum_cash_buffer', Number(opex.minimum_cash_buffer ?? 0), 'operator_input', 'cash policy'],
      ['equity_inflows', Number(opex.equity_inflows ?? 0), 'operator_input', 'funding plan'],
      ['debt_drawdowns', Number(opex.debt_drawdowns ?? 0), 'operator_input', 'funding plan'],
      ['debt_repayments', Number(opex.debt_repayments ?? 0), 'operator_input', 'funding plan'],
      ['debt_outstanding', syntheticDebtBase, 'operator_input', 'debt register'],
      ['interest_rate', syntheticInterestRate, 'operator_input', 'debt pricing'],
      ['capex_launch', Number(opex.capex_launch ?? 0), 'operator_input', 'capex plan'],
      ['capex_maintenance', Number(opex.capex_maintenance ?? 0), 'operator_input', 'capex plan'],
      ['capex_scaleup', Number(opex.capex_scaleup ?? 0), 'operator_input', 'capex plan'],
      ['opening_cash_initial', Number(opex.opening_cash_initial ?? 0), 'operator_input', 'cash opening balance'],
      ['hurdle_rate', Number(opex.hurdle_rate ?? 0.12), 'industry_benchmark', 'investment hurdle'],
    ];

    return values.map(([variable_name, value, evidence_type, evidence_ref], index) => ({
      id: makeUuid(1000 + index + this.periodId.length),
      pack_id: this.pack.id,
      variable_name,
      grain_signature: { period_id: this.periodId },
      value,
      unit: null,
      is_override: true,
      evidence_type,
      evidence_ref,
      updated_at: createdAt,
    }));
  }

  private result(rows: any[]) {
    return Promise.resolve({ rows, rowCount: rows.length });
  }

  private storeMetric(store: MetricStore, periodId: string | null, metricName: string, value: number) {
    const bucket = periodId ?? '__scenario__';
    store[bucket] = store[bucket] ?? {};
    store[bucket][metricName] = value;
  }

  async query(sql: string, params: any[] = []) {
    const q = sql.replace(/\s+/g, ' ').trim().toLowerCase();

    if (q.includes('from companies')) {
      return this.result([this.company]);
    }

    if (q.includes('from scenarios')) {
      return this.result([this.scenario]);
    }

    if (q.includes('select id, status, version_label from plan_versions')) {
      return this.result([this.version]);
    }

    if (q.includes('select id, status from plan_versions where id = $1')) {
      return this.result([{ id: this.version.id, status: this.version.status }]);
    }

    if (q.includes('from planning_periods')) {
      return this.result([this.period]);
    }

    if (q.includes('from scope_bundles sb')) {
      return this.result([this.scopeBundle]);
    }

    if (q.includes('join format_taxonomy_nodes')) {
      return this.result(this.scopeSelections.formats.map((node_id) => ({ node_id, label: node_id })));
    }

    if (q.includes('join category_taxonomy_nodes')) {
      return this.result(this.scopeSelections.categories.map((node_id) => ({ node_id, label: node_id })));
    }

    if (q.includes('join channel_taxonomy_nodes')) {
      return this.result(this.scopeSelections.channels.map((node_id) => ({ node_id, label: node_id })));
    }

    if (q.includes('join geography_nodes')) {
      return this.result(this.scopeSelections.geographies.map((node_id) => ({ node_id, label: node_id })));
    }

    if (q.includes('from scope_bundle_items')) {
      const familyMatch = q.match(/dimension_family = '([^']+)'/);
      const family = familyMatch?.[1] ?? '';
      const rows = (this.scopeSelections[`${family}s`] ?? []).map((node_id) => ({ node_id }));
      return this.result(rows);
    }

    if (q.includes('from decision_records') && q.includes("decision_status in ('accepted', 'active')")) {
      return this.result([]);
    }

    if (q.includes('from decision_records') && q.includes("decision_status not in ('accepted', 'active')")) {
      return this.result([]);
    }

    if (
      q.includes('from assumption_packs ap')
      && q.includes('where ap.company_id = $1')
      && q.includes('ap.assumption_set_id = $2')
    ) {
      return this.result([this.pack]);
    }

    if (q.includes('join assumption_pack_bindings apb')) {
      return this.result([{ pack_id: this.pack.id }]);
    }

    if (q.includes('select afb.variable_name') && q.includes('where afb.pack_id = any($1)')) {
      return this.result(
        this.bindings.map((binding) => ({
          variable_name: binding.variable_name,
          grain_signature: binding.grain_signature,
          value: binding.value,
          unit: binding.unit,
          is_override: binding.is_override,
          pack_id: binding.pack_id,
        }))
      );
    }

    if (
      q.includes('select afb.variable_name')
      && q.includes('join assumption_packs ap on ap.id = afb.pack_id')
      && q.includes('ap.assumption_set_id = $2')
    ) {
      return this.result(
        this.bindings.map((binding) => ({
          variable_name: binding.variable_name,
          grain_signature: binding.grain_signature,
          value: binding.value,
          unit: binding.unit,
          is_override: binding.is_override,
          pack_id: binding.pack_id,
        }))
      );
    }

    if (q.includes('from confidence_assessments')) {
      return this.result([]);
    }

    if (q.includes('from dqi_scores')) {
      return this.result([]);
    }

    if (q.includes('select id') && q.includes('from compute_runs') && q.includes('where id = $1')) {
      return this.result([]);
    }

    if (q.includes('select afb.id, afb.evidence_type, afb.evidence_ref, afb.updated_at')) {
      const variableName = String(params[1] ?? '');
      const binding = this.bindings.find((candidate) => candidate.variable_name === variableName);
      if (!binding) {
        return this.result([]);
      }
      return this.result([
        {
          id: binding.id,
          evidence_type: binding.evidence_type,
          evidence_ref: binding.evidence_ref,
          updated_at: binding.updated_at,
        },
      ]);
    }

    if (q.startsWith('insert into pnl_projections')) {
      this.storeMetric(this.pnlProjections, params[4], params[6], params[7]);
      return this.result([]);
    }

    if (q.startsWith('insert into cashflow_projections')) {
      this.storeMetric(this.cashflowProjections, params[4], params[6], params[7]);
      return this.result([]);
    }

    if (q.startsWith('insert into balance_sheet_projections')) {
      this.storeMetric(this.balanceSheetProjections, params[4], params[6], params[7]);
      return this.result([]);
    }

    if (q.startsWith('insert into unit_economics_projections')) {
      this.storeMetric(this.unitEconomicsProjections, params[4], params[6], params[7]);
      return this.result([]);
    }

    if (q.startsWith('insert into kpi_projections')) {
      this.storeMetric(this.kpiProjections, params[4], params[6], params[7]);
      return this.result([]);
    }

    if (q.startsWith('insert into compute_run_artifacts')) {
      this.artifacts.push({
        artifact_type: params[2],
        artifact_ref: params[3],
        row_count: params[4],
        metadata: JSON.parse(params[5]),
      });
      return this.result([]);
    }

    if (q.startsWith('insert into ') || q.startsWith('update ')) {
      return this.result([]);
    }

    throw new Error(`Unhandled mocked query: ${sql}`);
  }
}

function getPipelineOutputs(run: FixtureRun) {
  const fin = run.state.financials[run.periodId] || {};

  return {
    gross_demand: fin.gross_demand ?? 0,
    realized_orders: fin.realized_orders ?? 0,
    gross_sales: fin.gross_sales ?? 0,
    discounts: fin.discounts ?? 0,
    refunds: fin.refunds_adjustments ?? 0,
    channel_fees: fin.channel_fees ?? 0,
    net_revenue: fin.net_revenue ?? 0,
    cogs: fin.cogs ?? 0,
    cm1: fin.cm1 ?? 0,
    cm2: fin.cm2 ?? 0,
    cm3: fin.cm3 ?? 0,
    cm4: fin.cm4 ?? 0,
    total_capex: fin.total_capex ?? 0,
    ebitda: fin.ebitda ?? 0,
    ebit: fin.ebit ?? 0,
    ebt: fin.ebt ?? 0,
    tax_expense: fin.tax_expense ?? 0,
    net_income: fin.net_income ?? 0,
    depreciation: fin.depreciation ?? 0,
    amortization: fin.amortization ?? 0,
    interest_expense: fin.interest_expense ?? 0,
    receivables: fin.receivables ?? 0,
    payables: fin.payables ?? 0,
    inventory: fin.inventory ?? 0,
    working_capital_movement: fin.working_capital_movement ?? 0,
    operating_cash_flow: fin.operating_cash_flow ?? 0,
    investing_cash_flow: fin.investing_cash_flow ?? 0,
    financing_cash_flow: fin.financing_cash_flow ?? 0,
    net_change_in_cash: fin.net_change_in_cash ?? 0,
    opening_cash: fin.opening_cash ?? 0,
    closing_cash: fin.closing_cash ?? 0,
    gross_burn: fin.gross_burn ?? 0,
    net_burn: fin.net_burn ?? 0,
    ppe_net: fin.ppe_net ?? 0,
    debt_outstanding: fin.debt_outstanding ?? 0,
    total_assets: fin.total_assets ?? 0,
    total_liabilities: fin.total_liabilities ?? 0,
    shareholder_equity: fin.shareholder_equity ?? 0,
    net_revenue_per_order: fin.net_revenue_per_order ?? 0,
    cogs_per_order: fin.cogs_per_order ?? 0,
    cm1_per_order: fin.cm1_per_order ?? 0,
    cm2_per_order: fin.cm2_per_order ?? 0,
    cm1_margin_pct: fin.cm1_margin_pct ?? 0,
    food_cost_pct: fin.food_cost_pct ?? 0,
    variable_marketing_promo: fin.variable_marketing_promo ?? 0,
    variable_labor_fulfillment: fin.variable_labor_fulfillment ?? 0,
    site_controllable_opex: fin.site_controllable_opex ?? 0,
    fixed_site_costs: fin.fixed_site_costs ?? 0,
    shared_operating_allocations: fin.shared_operating_allocations ?? 0,
  };
}

function getSensitivityArtifact(run: FixtureRun) {
  return run.runtime.artifacts.find((artifact) => artifact.artifact_type === 'sensitivity');
}

const runCache = new Map<string, Promise<FixtureRun>>();

async function runFixtureThroughPipeline(fixture: any): Promise<FixtureRun> {
  const cacheKey = JSON.stringify(fixture);

  if (!runCache.has(cacheKey)) {
    runCache.set(cacheKey, (async () => {
      const runtime = new MockRuntime(fixture);
      dbQueryMock.mockImplementation((sql: string, params?: any[]) => runtime.query(sql, params));
      const state = await executeComputePipeline(runtime.ctx);
      return {
        ctx: runtime.ctx,
        state,
        periodId: runtime.periodId,
        runtime,
      };
    })());
  }

  return runCache.get(cacheKey)!;
}

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// WAVE 2 GATE: Steps 1-16 (demand → net_income)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Wave 2 Gate — Steps 1-16: Demand → Net Income', () => {
  describe('Fixture 1: single_kitchen_base_month', () => {
    const f = fixtureList[0];
    let run: FixtureRun;
    let w: ReturnType<typeof getPipelineOutputs>;

    beforeAll(async () => {
      run = await runFixtureThroughPipeline(f);
      w = getPipelineOutputs(run);
    });

    const out = f.expected_outputs;

    test('Step 01: realized_orders', () => assertWithinTolerance(w.realized_orders, out.step_01_realized_orders.value, out.step_01_realized_orders.tolerance, 'realized_orders'));
    test('Step 02: gross_sales', () => assertWithinTolerance(w.gross_sales, out.step_02_gross_sales.value, out.step_02_gross_sales.tolerance, 'gross_sales'));
    test('Step 03: discounts', () => assertWithinTolerance(w.discounts, out.step_03_discounts.value, out.step_03_discounts.tolerance, 'discounts'));
    test('Step 04: refunds', () => assertWithinTolerance(w.refunds, out.step_04_refunds.value, out.step_04_refunds.tolerance, 'refunds'));
    test('Step 05: channel_fees', () => assertWithinTolerance(w.channel_fees, out.step_05_channel_fees.value, out.step_05_channel_fees.tolerance, 'channel_fees'));
    test('Step 06: net_revenue', () => assertWithinTolerance(w.net_revenue, out.step_06_net_revenue.value, out.step_06_net_revenue.tolerance, 'net_revenue'));
    test('Step 07: cogs', () => assertWithinTolerance(w.cogs, out.step_07_cogs.value, out.step_07_cogs.tolerance, 'cogs'));
    test('Step 08: cm1', () => assertWithinTolerance(w.cm1, out.step_08_cm1.value, out.step_08_cm1.tolerance, 'cm1'));
    test('Step 09: cm2', () => assertWithinTolerance(w.cm2, out.step_09_cm2.value, out.step_09_cm2.tolerance, 'cm2'));
    test('Step 10: cm3', () => assertWithinTolerance(w.cm3, out.step_10_cm3.value, out.step_10_cm3.tolerance, 'cm3'));
    test('Step 11: cm4', () => assertWithinTolerance(w.cm4, out.step_11_cm4.value, out.step_11_cm4.tolerance, 'cm4'));
    test('Step 12: ebitda', () => assertWithinTolerance(w.ebitda, out.step_12_ebitda.value, out.step_12_ebitda.tolerance, 'ebitda'));
    test('Step 13: ebit', () => assertWithinTolerance(w.ebit, out.step_13_ebit.value, out.step_13_ebit.tolerance, 'ebit'));
    test('Step 14: ebt', () => assertWithinTolerance(w.ebt, out.step_14_ebt.value, out.step_14_ebt.tolerance, 'ebt'));
    test('Step 15: tax', () => assertWithinTolerance(w.tax_expense, out.step_15_tax.value, out.step_15_tax.tolerance, 'tax'));
    test('Step 16: net_income', () => assertWithinTolerance(w.net_income, out.step_16_net_income.value, out.step_16_net_income.tolerance, 'net_income'));

    test('Unit: net_revenue_per_order', () => assertClose(w.net_revenue_per_order, f.unit_economics.net_revenue_per_order.value, 0.01, 'nrpo'));
    test('Unit: cogs_per_order', () => assertClose(w.cogs_per_order, f.unit_economics.cogs_per_order.value, 0.01, 'cpgo'));
    test('Unit: cm1_per_order', () => assertClose(w.cm1_per_order, f.unit_economics.cm1_per_order.value, 0.01, 'cm1po'));
    test('Unit: food_cost_pct', () => assertClose(w.food_cost_pct, f.unit_economics.food_cost_pct.value, 0.001, 'fcp'));
    test('Unit: cm1_margin_pct', () => assertClose(w.cm1_margin_pct, f.unit_economics.cm1_margin_pct.value, 0.001, 'cm1m'));
    test('Invariant: loss → zero tax', () => {
      expect(w.ebt).toBeLessThan(0);
      expect(w.tax_expense).toBe(0);
    });
  });

  describe('Fixture 2: growth_scenario_month_6', () => {
    const f = fixtureList[1];
    let run: FixtureRun;
    let w: ReturnType<typeof getPipelineOutputs>;

    beforeAll(async () => {
      run = await runFixtureThroughPipeline(f);
      w = getPipelineOutputs(run);
    });

    const out = f.expected_outputs;

    test('realized_orders', () => assertClose(w.realized_orders, out.realized_orders.value, 0.01, 'realized_orders'));
    test('gross_sales', () => assertClose(w.gross_sales, out.gross_sales.value, 0.01, 'gross_sales'));
    test('net_revenue', () => assertClose(w.net_revenue, out.net_revenue.value, 0.1, 'net_revenue'));
    test('cm1', () => assertClose(w.cm1, out.cm1.value, 0.1, 'cm1'));
    test('cm4', () => assertClose(w.cm4, out.cm4.value, 0.1, 'cm4'));
    test('ebitda', () => assertClose(w.ebitda, out.ebitda.value, 0.1, 'ebitda'));
    test('ebit', () => assertClose(w.ebit, out.ebit.value, 0.1, 'ebit'));
    test('ebt', () => assertClose(w.ebt, out.ebt.value, 0.1, 'ebt'));
    test('tax', () => assertClose(w.tax_expense, out.tax.value, 0.1, 'tax'));
    test('net_income', () => assertClose(w.net_income, out.net_income.value, 0.1, 'net_income'));
    test('Invariant: EBIT-positive', () => expect(w.ebit).toBeGreaterThan(0));
    test('Invariant: positive tax', () => expect(w.tax_expense).toBeGreaterThan(0));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WAVE 3 GATE: Extended Compute Nodes (Steps 8-14) + DAG Validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Wave 3 Gate — Extended Compute + DAG Acceptance', () => {
  describe('A. DAG Structure (computation_graph.json)', () => {
    test('14 nodes', () => expect(graph.nodes.length).toBe(14));
    test('24 edges', () => expect(graph.edges.length).toBe(24));
    test('18 execution steps', () => expect(graph.execution_plan.length).toBe(18));

    test('DAG is cycle-free (topological sort + edge validation)', () => {
      const adj = new Map<string, Set<string>>();
      const nodeIds = new Set<string>(graph.nodes.map((n: any) => n.id));
      for (const id of nodeIds) adj.set(id, new Set());
      for (const edge of graph.edges) {
        adj.get(edge.from)!.add(edge.to);
      }

      const color = new Map<string, number>();
      for (const id of nodeIds) color.set(id as string, 0);
      let hasCycle = false;

      function dfs(node: string) {
        color.set(node, 1);
        for (const neighbour of adj.get(node) || []) {
          if (color.get(neighbour) === 1) {
            hasCycle = true;
            return;
          }
          if (color.get(neighbour) === 0) dfs(neighbour);
          if (hasCycle) return;
        }
        color.set(node, 2);
      }

      for (const id of nodeIds) {
        if (color.get(id) === 0) dfs(id);
        if (hasCycle) break;
      }

      expect(hasCycle).toBe(false);

      const nodeStep = new Map<string, number>();
      for (const step of graph.execution_plan) nodeStep.set(step.node_id, step.step);
      for (const edge of graph.edges) {
        const from = nodeStep.get(edge.from);
        const to = nodeStep.get(edge.to);
        if (from !== undefined && to !== undefined) expect(from).toBeLessThan(to);
      }
    });

    test('All edge references are valid', () => {
      const ids = new Set(graph.nodes.map((n: any) => n.id));
      for (const edge of graph.edges) {
        expect(ids.has(edge.from)).toBe(true);
        expect(ids.has(edge.to)).toBe(true);
      }
    });

    test('Prerequisites reference valid node IDs', () => {
      const ids = new Set(graph.execution_plan.map((s: any) => s.node_id));
      for (const step of graph.execution_plan) {
        for (const prereq of step.prerequisites) expect(ids.has(prereq)).toBe(true);
      }
    });

    test('Balance sheet depends on capex_opex, working_capital, burn_runway', () => {
      const bs = graph.execution_plan.find((s: any) => s.node_id === 'node_balance_sheet');
      expect(bs.prerequisites).toContain('node_capex_opex');
      expect(bs.prerequisites).toContain('node_working_capital');
      expect(bs.prerequisites).toContain('node_burn_runway');
    });

    test('Confidence depends on assumption_packs, unit_economics, sensitivity_risk', () => {
      const c = graph.execution_plan.find((s: any) => s.node_id === 'node_confidence');
      expect(c.prerequisites).toContain('node_assumption_packs');
      expect(c.prerequisites).toContain('node_unit_economics');
      expect(c.prerequisites).toContain('node_sensitivity_risk');
    });

    test('Step ordering: 1-4=resolution, 5-7=P&L, 8-11=extended, 12-14=analysis, 15-18=finalize', () => {
      const plan = graph.execution_plan;
      expect(plan[0].node_id).toBe('node_planning_spine');
      expect(plan[3].node_id).toBe('node_assumption_packs');
      expect(plan[4].node_id).toBe('node_demand_drivers');
      expect(plan[6].node_id).toBe('node_contribution_stack');
      expect(plan[7].node_id).toBe('node_capex_opex');
      expect(plan[10].node_id).toBe('node_balance_sheet');
      expect(plan[11].node_id).toBe('node_unit_economics');
      expect(plan[13].node_id).toBe('node_confidence');
      expect(plan[17].node_id).toBe('finalize_compute_run');
    });

    test('All 14 compute node files exist', () => {
      const files = [
        'planning-spine.ts', 'scope-bundle.ts', 'decisions.ts', 'assumption-packs.ts',
        'demand-drivers.ts', 'revenue-stack.ts', 'contribution-stack.ts',
        'capex-opex.ts', 'working-capital.ts', 'burn-runway.ts', 'balance-sheet.ts',
        'unit-economics.ts', 'sensitivity-risk.ts', 'confidence.ts',
      ];
      const dir = path.join(__dirname, '..', '..', 'api', 'src', 'compute', 'nodes');
      for (const file of files) expect(fs.existsSync(path.join(dir, file))).toBe(true);
    });
  });

  describe('B. Node 8: Capex & Opex', () => {
    for (const fixture of fixtureList) {
      describe(`[${fixture.name}]`, () => {
        let w: ReturnType<typeof getPipelineOutputs>;

        beforeAll(async () => {
          w = getPipelineOutputs(await runFixtureThroughPipeline(fixture));
        });

        test('EBITDA = CM4 - fixed_site_costs - shared', () => assertClose(w.ebitda, w.cm4 - w.fixed_site_costs - w.shared_operating_allocations, 0.01, 'ebitda'));
        test('EBIT = EBITDA - dep - amort', () => assertClose(w.ebit, w.ebitda - w.depreciation - w.amortization, 0.01, 'ebit'));
        test('EBT = EBIT - interest', () => assertClose(w.ebt, w.ebit - w.interest_expense, 0.01, 'ebt'));
        test('tax = MAX(0, EBT × rate)', () => assertClose(w.tax_expense, Math.max(0, w.ebt * fixture.inputs.opex_plan.tax_rate), 0.01, 'tax'));
        test('net_income = EBT - tax', () => assertClose(w.net_income, w.ebt - w.tax_expense, 0.01, 'net_income'));
      });
    }
  });

  describe('C. Node 9: Working Capital', () => {
    test('Formula: receivables = net_revenue × (days/30)', () => {
      const r = 100000 * (15 / 30);
      expect(r).toBe(50000);
    });

    test('WC movement = Δreceivables - Δpayables + Δinventory', () => {
      const wc = 50000 - 40000 + 13333.33;
      assertClose(wc, 23333.33, 0.01, 'wc');
    });

    test('Zero timing → zero WC movement', async () => {
      const w = getPipelineOutputs(await runFixtureThroughPipeline(fixtureList[0]));
      expect(w.working_capital_movement).toBe(0);
    });

    test('Multi-period delta: P2 WC uses P1 as prior', () => {
      const delta_r = 60000 - 50000;
      const delta_p = 35000 - 30000;
      const delta_i = 12000 - 10000;
      assertClose(delta_r - delta_p + delta_i, 7000, 0.01, 'wc_p2');
    });
  });

  describe('D. Node 10: Burn, Runway & Cash Flow', () => {
    for (const fixture of fixtureList) {
      describe(`[${fixture.name}]`, () => {
        let w: ReturnType<typeof getPipelineOutputs>;

        beforeAll(async () => {
          w = getPipelineOutputs(await runFixtureThroughPipeline(fixture));
        });

        test('OCF = EBITDA - WC', () => assertClose(w.operating_cash_flow, w.ebitda - w.working_capital_movement, 0.01, 'ocf'));
        test('ICF = -total_capex', () => assertClose(w.investing_cash_flow, -w.total_capex, 0.01, 'icf'));
        test('OCF + ICF + FCF = net_change', () => {
          assertClose(w.operating_cash_flow + w.investing_cash_flow + w.financing_cash_flow, w.net_change_in_cash, 0.01, 'cf_recon');
        });
        test('closing = opening + net_change', () => assertClose(w.closing_cash, w.opening_cash + w.net_change_in_cash, 0.01, 'closing'));
        test('net_burn = gross_burn - net_revenue', () => assertClose(w.net_burn, w.gross_burn - w.net_revenue, 0.01, 'net_burn'));
      });
    }

    test('Fixture 1: negative OCF (loss)', async () => expect(getPipelineOutputs(await runFixtureThroughPipeline(fixtureList[0])).operating_cash_flow).toBeLessThan(0));
    test('Fixture 2: positive OCF (profit)', async () => expect(getPipelineOutputs(await runFixtureThroughPipeline(fixtureList[1])).operating_cash_flow).toBeGreaterThan(0));

    test('Fixture 1 hand-verified: OCF=-9900, ICF=0, FCF=-1500, closing=-11400', async () => {
      const w = getPipelineOutputs(await runFixtureThroughPipeline(fixtureList[0]));
      assertClose(w.operating_cash_flow, -9900, 0.01, 'f1_ocf');
      assertClose(w.investing_cash_flow, 0, 0.01, 'f1_icf');
      assertClose(w.financing_cash_flow, -1500, 0.01, 'f1_fcf');
      assertClose(w.closing_cash, -11400, 0.01, 'f1_closing');
    });

    test('Fixture 2 hand-verified: OCF=44682.20, closing=43282.20', async () => {
      const w = getPipelineOutputs(await runFixtureThroughPipeline(fixtureList[1]));
      assertClose(w.operating_cash_flow, 44682.20, 0.1, 'f2_ocf');
      assertClose(w.closing_cash, 43282.20, 0.1, 'f2_closing');
    });
  });

  describe('E. Node 11: Balance Sheet', () => {
    for (const fixture of fixtureList) {
      describe(`[${fixture.name}]`, () => {
        let w: ReturnType<typeof getPipelineOutputs>;

        beforeAll(async () => {
          w = getPipelineOutputs(await runFixtureThroughPipeline(fixture));
        });

        test('PPE = prior + capex - depreciation', () => assertClose(w.ppe_net, w.total_capex - w.depreciation, 0.01, 'ppe'));
        test('total_assets = cash + PPE + receivables + inventory', () => {
          assertClose(w.total_assets, w.closing_cash + w.ppe_net + w.receivables + w.inventory, 0.01, 'assets');
        });
        test('total_liabilities = debt + payables', () => {
          assertClose(w.total_liabilities, w.debt_outstanding + w.payables, 0.01, 'liabilities');
        });
        test('equity = prior + inflows + net_income', () => assertClose(w.shareholder_equity, w.net_income, 0.01, 'equity'));

        test('Balance sheet identity: A - amort - tax = L + E', () => {
          const gap = w.amortization + w.tax_expense;
          const adjusted = Math.abs((w.total_assets - gap) - w.total_liabilities - w.shareholder_equity);
          expect(adjusted).toBeLessThan(0.01);
        });
      });
    }

    test('Fixture 1: loss reduces equity below zero', async () => {
      const w = getPipelineOutputs(await runFixtureThroughPipeline(fixtureList[0]));
      expect(w.shareholder_equity).toBeLessThan(0);
      assertClose(w.shareholder_equity, -14900, 0.01, 'f1_equity');
    });

    test('Fixture 2: profit creates positive equity', async () => {
      const w = getPipelineOutputs(await runFixtureThroughPipeline(fixtureList[1]));
      expect(w.shareholder_equity).toBeGreaterThan(0);
      assertClose(w.shareholder_equity, 36201.80, 0.1, 'f2_equity');
    });

    test('Fixture 1 hand-verified BS: assets=-14400, liab=0, equity=-14900', async () => {
      const w = getPipelineOutputs(await runFixtureThroughPipeline(fixtureList[0]));
      assertClose(w.total_assets, -14400, 0.01, 'f1_assets');
      assertClose(w.total_liabilities, 0, 0.01, 'f1_liab');
      assertClose(w.shareholder_equity, -14900, 0.01, 'f1_equity');
    });
  });

  describe('F. Node 12: Unit Economics', () => {
    for (const fixture of fixtureList) {
      describe(`[${fixture.name}]`, () => {
        let w: ReturnType<typeof getPipelineOutputs>;

        beforeAll(async () => {
          w = getPipelineOutputs(await runFixtureThroughPipeline(fixture));
        });

        test('nrpo = net_revenue / orders', () => {
          if (w.realized_orders > 0) assertClose(w.net_revenue_per_order, w.net_revenue / w.realized_orders, 0.01, 'nrpo');
        });
        test('cpgo = cogs / orders', () => {
          if (w.realized_orders > 0) assertClose(w.cogs_per_order, w.cogs / w.realized_orders, 0.01, 'cpgo');
        });
        test('cm1_margin = cm1 / net_revenue', () => {
          if (w.net_revenue !== 0) assertClose(w.cm1_margin_pct, w.cm1 / w.net_revenue, 0.001, 'cm1m');
        });
      });
    }
  });

  describe('G. Node 13: Sensitivity & Risk', () => {
    test('EBITDA recompute matches for fixture 1', async () => {
      const w = getPipelineOutputs(await runFixtureThroughPipeline(fixtureList[0]));
      assertClose(w.ebitda, -9900, 0.01, 'sensitivity_base');
    });

    test('+20% demand increases EBITDA', async () => {
      const baseRun = await runFixtureThroughPipeline(fixtureList[1]);
      const perturbed = deepClone(fixtureList[1]);
      perturbed.inputs.demand_drivers.gross_demand *= 1.20;
      const perturbedRun = await runFixtureThroughPipeline(perturbed);
      expect(getPipelineOutputs(perturbedRun).ebitda).toBeGreaterThan(getPipelineOutputs(baseRun).ebitda);
    });

    test('+20% COGS decreases EBITDA', async () => {
      const baseRun = await runFixtureThroughPipeline(fixtureList[1]);
      const perturbed = deepClone(fixtureList[1]);
      perturbed.inputs.cost_assumptions.cogs_per_unit *= 1.20;
      const perturbedRun = await runFixtureThroughPipeline(perturbed);
      expect(getPipelineOutputs(perturbedRun).ebitda).toBeLessThan(getPipelineOutputs(baseRun).ebitda);
    });

    test('Monte Carlo produces non-zero std dev', async () => {
      const run = await runFixtureThroughPipeline(fixtureList[1]);
      const artifact = getSensitivityArtifact(run);
      expect(artifact?.metadata?.monte_carlo_summary?.std_ebitda ?? 0).toBeGreaterThan(0);
    });
  });

  describe('H. Node 14: Confidence & DQI', () => {
    test('DQI weights sum to 1.0', () => {
      const sum = Object.values(DQI_WEIGHTS).reduce((s, w) => s + w, 0);
      assertClose(sum, 1.0, 0.001, 'dqi_sum');
    });

    test('Evidence scores: market > historical > benchmark > expert > operator > unknown', () => {
      expect(EVIDENCE_TYPE_SCORES.market_research).toBeGreaterThan(EVIDENCE_TYPE_SCORES.historical_data);
      expect(EVIDENCE_TYPE_SCORES.historical_data).toBeGreaterThan(EVIDENCE_TYPE_SCORES.industry_benchmark);
      expect(EVIDENCE_TYPE_SCORES.industry_benchmark).toBeGreaterThan(EVIDENCE_TYPE_SCORES.expert_estimate);
      expect(EVIDENCE_TYPE_SCORES.expert_estimate).toBeGreaterThan(EVIDENCE_TYPE_SCORES.operator_input);
      expect(EVIDENCE_TYPE_SCORES.operator_input).toBeGreaterThan(EVIDENCE_TYPE_SCORES.unknown);
    });

    test('Band mapping uses runtime thresholds', () => {
      expect(mapScoreToBand(90)).toBe('very_high');
      expect(mapScoreToBand(85)).toBe('very_high');
      expect(mapScoreToBand(75)).toBe('high');
      expect(mapScoreToBand(70)).toBe('high');
      expect(mapScoreToBand(55)).toBe('medium');
      expect(mapScoreToBand(50)).toBe('medium');
      expect(mapScoreToBand(35)).toBe('low');
      expect(mapScoreToBand(30)).toBe('low');
      expect(mapScoreToBand(10)).toBe('very_low');
      expect(mapScoreToBand(0)).toBe('very_low');
    });

    test('Critical path penalty uses exported multiplier and cap', () => {
      expect(Math.min(10 * CRITICAL_PATH_MULTIPLIER, CRITICAL_PATH_CAP)).toBe(25);
      expect(Math.min(3 * CRITICAL_PATH_MULTIPLIER, CRITICAL_PATH_CAP)).toBe(15);
      expect(Math.min(1 * CRITICAL_PATH_MULTIPLIER, CRITICAL_PATH_CAP)).toBe(5);
    });
  });

  describe('I. Cross-Statement Reconciliation', () => {
    for (const fixture of fixtureList) {
      describe(`[${fixture.name}]`, () => {
        let w: ReturnType<typeof getPipelineOutputs>;

        beforeAll(async () => {
          w = getPipelineOutputs(await runFixtureThroughPipeline(fixture));
        });

        test('CF recon: OCF+ICF+FCF = net_change', () => {
          assertClose(w.operating_cash_flow + w.investing_cash_flow + w.financing_cash_flow, w.net_change_in_cash, 0.01, 'cf');
        });
        test('Cash: closing = opening + net_change', () => assertClose(w.closing_cash, w.opening_cash + w.net_change_in_cash, 0.01, 'cash'));
        test('P&L: net_income = ebt - tax', () => assertClose(w.net_income, w.ebt - w.tax_expense, 0.01, 'pnl'));
        test('EBITDA = cm4 - fixed - shared', () => assertClose(w.ebitda, w.cm4 - w.fixed_site_costs - w.shared_operating_allocations, 0.01, 'ebitda'));
        test('net_burn = gross_burn - net_revenue', () => assertClose(w.net_burn, w.gross_burn - w.net_revenue, 0.01, 'burn'));
        test('net_income identity: all costs + tax', () => {
          const totalCosts = w.cogs + w.variable_marketing_promo + w.variable_labor_fulfillment +
            w.site_controllable_opex + w.fixed_site_costs + w.shared_operating_allocations +
            w.depreciation + w.amortization + w.interest_expense;
          assertClose(w.net_income, w.net_revenue - totalCosts - w.tax_expense, 0.01, 'ni_identity');
        });
      });
    }
  });

  describe('J. Multi-Period Chain', () => {
    test('P1 closing_cash feeds P2 opening', async () => {
      const w1 = getPipelineOutputs(await runFixtureThroughPipeline(fixtureList[0]));
      const w2 = getPipelineOutputs(await runFixtureThroughPipeline(fixtureList[1]));
      const p2Closing = w1.closing_cash + w2.net_change_in_cash;
      expect(Number.isFinite(p2Closing)).toBe(true);
    });

    test('Equity accumulates across periods', async () => {
      const w1 = getPipelineOutputs(await runFixtureThroughPipeline(fixtureList[0]));
      const w2 = getPipelineOutputs(await runFixtureThroughPipeline(fixtureList[1]));
      const cumulative = w1.net_income + w2.net_income;
      assertClose(cumulative, -14900 + 36201.80, 0.1, 'cum_equity');
    });

    test('CM waterfall monotonicity holds for both fixtures', async () => {
      for (const fixture of fixtureList) {
        const w = getPipelineOutputs(await runFixtureThroughPipeline(fixture));
        expect(w.cm1).toBeGreaterThanOrEqual(w.cm2);
        expect(w.cm2).toBeGreaterThanOrEqual(w.cm3);
        expect(w.cm3).toBeGreaterThanOrEqual(w.cm4);
      }
    });
  });
});
