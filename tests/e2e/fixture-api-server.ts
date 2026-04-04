import { createApp } from '../../api/src/server';
import { db } from '../../api/src/db';

type RowResult = {
  rowCount: number;
  rows: Array<Record<string, unknown>>;
};

type CompanyRecord = {
  id: string;
  tenant_id: string;
  name: string;
  base_currency: string;
  fiscal_year_start_month: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
};

type ScenarioRecord = {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type VersionRecord = {
  id: string;
  tenant_id: string;
  company_id: string;
  scenario_id: string;
  assumption_set_id: string;
  name: string;
  status: string;
  is_frozen: boolean;
  created_at: string;
  updated_at: string;
};

type ScopeBundleRecord = {
  id: string;
  company_id: string;
  scenario_id: string;
  version_id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type ComputeRunRecord = {
  id: string;
  company_id: string;
  scenario_id: string;
  version_id: string;
  trigger_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
};

type ComputeRunStepRecord = {
  id: string;
  compute_run_id: string;
  step_code: string;
  step_label: string;
  step_order: number;
  status: string;
  started_at: string;
  completed_at: string;
  output_summary: Record<string, unknown>;
};

const tenantId = '10000000-0000-4000-8000-000000000001';
const companyId = '10000000-0000-4000-8000-000000000111';
const calendarId = '10000000-0000-4000-8000-000000000211';

const company: CompanyRecord = {
  id: companyId,
  tenant_id: tenantId,
  name: 'Acme Kitchens',
  base_currency: 'AED',
  fiscal_year_start_month: 1,
  metadata: { industry: 'Food Delivery' },
  created_at: '2026-04-01T00:00:00.000Z',
  updated_at: '2026-04-01T00:00:00.000Z',
};

const scenarios: ScenarioRecord[] = [
  {
    id: '20000000-0000-4000-8000-000000000111',
    tenant_id: tenantId,
    company_id: companyId,
    name: 'Base Plan',
    description: 'Baseline planning scenario',
    created_at: '2026-04-02T00:00:00.000Z',
    updated_at: '2026-04-02T00:00:00.000Z',
  },
  {
    id: '20000000-0000-4000-8000-000000000112',
    tenant_id: tenantId,
    company_id: companyId,
    name: 'Upside Plan',
    description: 'Aggressive expansion variant',
    created_at: '2026-04-03T00:00:00.000Z',
    updated_at: '2026-04-03T00:00:00.000Z',
  },
];

const assumptionSets = new Map<string, string>([
  [scenarios[0].id, '40000000-0000-4000-8000-000000000111'],
  [scenarios[1].id, '40000000-0000-4000-8000-000000000112'],
]);

const versions: VersionRecord[] = [
  {
    id: '30000000-0000-4000-8000-000000000111',
    tenant_id: tenantId,
    company_id: companyId,
    scenario_id: scenarios[0].id,
    assumption_set_id: assumptionSets.get(scenarios[0].id) || '',
    name: 'Base Draft v1',
    status: 'draft',
    is_frozen: false,
    created_at: '2026-04-02T04:00:00.000Z',
    updated_at: '2026-04-02T04:00:00.000Z',
  },
  {
    id: '30000000-0000-4000-8000-000000000112',
    tenant_id: tenantId,
    company_id: companyId,
    scenario_id: scenarios[1].id,
    assumption_set_id: assumptionSets.get(scenarios[1].id) || '',
    name: 'Upside Draft v1',
    status: 'draft',
    is_frozen: false,
    created_at: '2026-04-03T04:00:00.000Z',
    updated_at: '2026-04-03T04:00:00.000Z',
  },
];

const scopeBundles: ScopeBundleRecord[] = [
  {
    id: '66000000-0000-4000-8000-000000000111',
    company_id: companyId,
    scenario_id: scenarios[0].id,
    version_id: versions[0].id,
    name: 'FY26 Core Rollout',
    status: 'active',
    created_at: '2026-04-02T06:00:00.000Z',
    updated_at: '2026-04-02T06:00:00.000Z',
  },
  {
    id: '66000000-0000-4000-8000-000000000112',
    company_id: companyId,
    scenario_id: scenarios[1].id,
    version_id: versions[1].id,
    name: 'Upside Expansion Scope',
    status: 'draft',
    created_at: '2026-04-03T06:00:00.000Z',
    updated_at: '2026-04-03T06:00:00.000Z',
  },
];

const scopeBundleCounts = new Map<string, number>([
  [scopeBundles[0].id, 3],
  [scopeBundles[1].id, 4],
]);

const computeRuns: ComputeRunRecord[] = [
  {
    id: '72000000-0000-4000-8000-000000000111',
    company_id: companyId,
    scenario_id: scenarios[0].id,
    version_id: versions[0].id,
    trigger_type: 'manual',
    status: 'completed',
    created_at: '2026-04-03T10:15:00.000Z',
    completed_at: '2026-04-03T10:17:30.000Z',
    metadata: {
      warnings: [],
      outputCounts: {
        pnl: 12,
        cashflow: 12,
        balanceSheet: 12,
        unitEconomics: 12,
        kpis: 6,
        explainability: 4,
      },
    },
  },
  {
    id: '72000000-0000-4000-8000-000000000112',
    company_id: companyId,
    scenario_id: scenarios[0].id,
    version_id: versions[0].id,
    trigger_type: 'compare_prep',
    status: 'queued',
    created_at: '2026-04-04T08:00:00.000Z',
    completed_at: null,
    metadata: {
      warnings: ['No seeded financial projections were found for this scenario.'],
      outputCounts: {},
    },
  },
];

const computeRunSteps = new Map<string, ComputeRunStepRecord[]>([
  [
    computeRuns[0].id,
    [
      {
        id: '73000000-0000-4000-8000-000000000111',
        compute_run_id: computeRuns[0].id,
        step_code: 'planning_spine',
        step_label: 'Resolve planning context',
        step_order: 1,
        status: 'completed',
        started_at: '2026-04-03T10:15:00.000Z',
        completed_at: '2026-04-03T10:15:20.000Z',
        output_summary: { companyId, scenarioId: scenarios[0].id, versionId: versions[0].id },
      },
      {
        id: '73000000-0000-4000-8000-000000000112',
        compute_run_id: computeRuns[0].id,
        step_code: 'aggregate_financials',
        step_label: 'Aggregate seeded projections',
        step_order: 2,
        status: 'completed',
        started_at: '2026-04-03T10:15:20.000Z',
        completed_at: '2026-04-03T10:16:20.000Z',
        output_summary: { pnl: 12, cashflow: 12, balanceSheet: 12 },
      },
      {
        id: '73000000-0000-4000-8000-000000000113',
        compute_run_id: computeRuns[0].id,
        step_code: 'finalize',
        step_label: 'Finalize compute run',
        step_order: 3,
        status: 'completed',
        started_at: '2026-04-03T10:16:20.000Z',
        completed_at: '2026-04-03T10:17:30.000Z',
        output_summary: { warningCount: 0 },
      },
    ],
  ],
  [
    computeRuns[1].id,
    [
      {
        id: '73000000-0000-4000-8000-000000000114',
        compute_run_id: computeRuns[1].id,
        step_code: 'planning_spine',
        step_label: 'Resolve planning context',
        step_order: 1,
        status: 'queued',
        started_at: '',
        completed_at: '',
        output_summary: {},
      },
    ],
  ],
]);

const periods = [
  { id: '50000000-0000-4000-8000-000000000111', name: 'Jan 2026', start_date: '2026-01-01', end_date: '2026-01-31', period_type: 'month', sequence_order: 1, calendar_id: calendarId },
  { id: '50000000-0000-4000-8000-000000000112', name: 'Feb 2026', start_date: '2026-02-01', end_date: '2026-02-28', period_type: 'month', sequence_order: 2, calendar_id: calendarId },
  { id: '50000000-0000-4000-8000-000000000113', name: 'Mar 2026', start_date: '2026-03-01', end_date: '2026-03-31', period_type: 'month', sequence_order: 3, calendar_id: calendarId },
];

const metricStore: Record<string, { revenue: number; ebitda: number; runway: number }> = {
  [scenarios[0].id]: { revenue: 1200000, ebitda: 180000, runway: 14.5 },
  [scenarios[1].id]: { revenue: 1480000, ebitda: 265000, runway: 17.8 },
};

const sensitivityRows = [
  { variable_name: 'conversion_rate', base_value: 0.24, delta_pct: 5, impact_value: 98000 },
  { variable_name: 'delivery_fee', base_value: 8.5, delta_pct: 4, impact_value: 76000 },
  { variable_name: 'food_cost_pct', base_value: 0.31, delta_pct: 3, impact_value: -64000 },
];

const driverExplainabilityRows = [
  { id: '76000000-0000-4000-8000-000000000111', company_id: companyId, scenario_id: scenarios[0].id, target_metric: 'EBITDA', driver_name: 'Average Order Value', contribution_value: 124000, contribution_pct: 38.5, impact_amount: 124000, created_at: '2026-04-03T10:00:00.000Z' },
  { id: '76000000-0000-4000-8000-000000000112', company_id: companyId, scenario_id: scenarios[0].id, target_metric: 'EBITDA', driver_name: 'Conversion Rate', contribution_value: 91000, contribution_pct: 24.2, impact_amount: 91000, created_at: '2026-04-03T10:01:00.000Z' },
  { id: '76000000-0000-4000-8000-000000000113', company_id: companyId, scenario_id: scenarios[0].id, target_metric: 'EBITDA', driver_name: 'Food Cost %', contribution_value: -67000, contribution_pct: -18.1, impact_amount: -67000, created_at: '2026-04-03T10:02:00.000Z' },
  { id: '76000000-0000-4000-8000-000000000114', company_id: companyId, scenario_id: scenarios[0].id, target_metric: 'Net Revenue', driver_name: 'Order Volume', contribution_value: 156000, contribution_pct: 44.8, impact_amount: 156000, created_at: '2026-04-03T10:03:00.000Z' },
];

const confidenceRollups = [
  { company_id: companyId, rollup_scope: 'scenario', avg_score: 78, assessment_count: 6, critical_floor: 62 },
  { company_id: companyId, rollup_scope: 'portfolio', avg_score: 71, assessment_count: 4, critical_floor: 58 },
  { company_id: companyId, rollup_scope: 'operating_model', avg_score: 83, assessment_count: 3, critical_floor: 69 },
];

const assumptionBindingRows = [
  { id: '77000000-0000-4000-8000-000000000111', company_id: companyId, assumption_set_id: versions[0].assumption_set_id, variable_name: 'avg_order_value', current_value: 64, unit: 'AED', evidence_ref: 'market_research', family: 'demand', pack_name: 'Demand Core' },
  { id: '77000000-0000-4000-8000-000000000112', company_id: companyId, assumption_set_id: versions[0].assumption_set_id, variable_name: 'conversion_rate', current_value: 0.24, unit: 'ratio', evidence_ref: 'historical_data', family: 'demand', pack_name: 'Demand Core' },
  { id: '77000000-0000-4000-8000-000000000113', company_id: companyId, assumption_set_id: versions[0].assumption_set_id, variable_name: 'food_cost_pct', current_value: 0.31, unit: 'ratio', evidence_ref: 'industry_benchmark', family: 'cost', pack_name: 'Cost Guardrails' },
];

const researchTasks = [
  { company_id: companyId, entity_type: 'scenario', entity_id: scenarios[0].id, title: 'Validate competitor pricing signal', status: 'open', description: 'Review marketplace discounting trends.' },
  { company_id: companyId, entity_type: 'scenario', entity_id: scenarios[0].id, title: 'Refresh UAE demand benchmark', status: 'open', description: 'Confirm quarter-on-quarter delivery frequency.' },
];

const evidenceItems = [
  { company_id: companyId, entity_type: 'scenario', entity_id: scenarios[0].id, title: 'Talabat Q1 marketplace trend', source_url: 'https://example.com/talabat-q1', source_type: 'market_report', source_name: 'Talabat benchmark', metadata: { description: 'Marketplace take-rate trend and promo pressure.' } },
  { company_id: companyId, entity_type: 'scenario', entity_id: scenarios[0].id, title: 'Internal basket-size study', source_url: 'https://example.com/basket-study', source_type: 'internal_research', source_name: 'Ops analytics', metadata: { description: 'Basket-size uplift from combo merchandising.' } },
];

const scopeRows = {
  formats: [
    { id: '60000000-0000-4000-8000-000000000111', name: 'Dark Kitchen', parent_id: null, level_depth: 0 },
    { id: '60000000-0000-4000-8000-000000000112', name: 'Express Pickup', parent_id: '60000000-0000-4000-8000-000000000111', level_depth: 1 },
  ],
  categories: [
    { id: '61000000-0000-4000-8000-000000000111', name: 'Burgers', parent_id: null, level_depth: 0 },
  ],
  portfolio: [
    { id: '62000000-0000-4000-8000-000000000111', name: 'Flagship Brand', parent_id: null, level_depth: 0, node_type: 'brand' },
  ],
  channels: [
    { id: '63000000-0000-4000-8000-000000000111', name: 'Marketplace', channel_type: 'aggregator' },
  ],
  operatingModels: [
    { id: '64000000-0000-4000-8000-000000000111', name: 'Hub & Spoke', model_type: 'hybrid' },
  ],
  geography: [
    { id: '65000000-0000-4000-8000-000000000111', name: 'Dubai', parent_id: null, level_depth: 0, iso_code: 'AE-DU' },
  ],
};

function result(rows: Array<Record<string, unknown>> = []): RowResult {
  return { rowCount: rows.length, rows };
}

function nextUuid(seed: number) {
  return `00000000-0000-4000-8000-${String(seed).padStart(12, '0')}`;
}

function countResult(count: number, key = 'count'): RowResult {
  return result([{ [key]: count }]);
}

async function mockQuery(sqlText: string, params: unknown[] = []): Promise<RowResult> {
  const sql = sqlText.replace(/\s+/g, ' ').trim();

  if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
    return result();
  }

  if (sql.includes('FROM companies') && sql.includes('ORDER BY created_at DESC')) {
    return result([
      {
        id: company.id,
        name: company.name,
        base_currency: company.base_currency,
        fiscal_year_start_month: company.fiscal_year_start_month,
        metadata: company.metadata,
        created_at: company.created_at,
        updated_at: company.updated_at,
      },
    ]);
  }

  if (sql.includes('SELECT id, tenant_id FROM companies WHERE id = $1')) {
    return params[0] === company.id ? result([{ id: company.id, tenant_id: company.tenant_id }]) : result();
  }

  if (sql.includes('SELECT id FROM companies WHERE id::text = $1 AND tenant_id::text = $2 AND is_deleted = FALSE')) {
    return params[0] === company.id && params[1] === company.tenant_id ? result([{ id: company.id }]) : result();
  }

  if (sql.includes('FROM scenarios s') && sql.includes('LEFT JOIN LATERAL')) {
    const companyFilter = String(params[0]);
    const rows = scenarios
      .filter((scenario) => scenario.company_id === companyFilter)
      .map((scenario) => {
        const latestVersion = versions
          .filter((version) => version.scenario_id === scenario.id)
          .sort((left, right) => right.created_at.localeCompare(left.created_at))[0];
        return {
          id: scenario.id,
          name: scenario.name,
          description: scenario.description,
          created_at: scenario.created_at,
          latest_version_id: latestVersion?.id || null,
          latest_version_status: latestVersion?.status || 'draft',
          latest_version_is_frozen: latestVersion?.is_frozen || false,
        };
      });
    return result(rows);
  }

  if (sql.includes('FROM planning_periods pp') && sql.includes('JOIN planning_calendars pc ON pc.id = pp.calendar_id')) {
    return result(
      periods.map((period) => ({
        period_id: period.id,
        label: period.name,
        start_date: period.start_date,
        end_date: period.end_date,
        period_type: period.period_type,
        sequence_order: period.sequence_order,
        calendar_id: period.calendar_id,
      })),
    );
  }

  if (sql.includes('FROM scenarios WHERE id = ANY')) {
    const scenarioIds = Array.isArray(params[0]) ? params[0].map(String) : [];
    return result(
      scenarios
        .filter((scenario) => scenarioIds.includes(scenario.id))
        .map((scenario) => ({
          id: scenario.id,
          company_id: scenario.company_id,
          tenant_id: scenario.tenant_id,
          name: scenario.name,
        })),
    );
  }

  if (sql.includes('SELECT s.id, s.company_id FROM scenarios s') && sql.includes('c.tenant_id::text = $2')) {
    const scenario = scenarios.find((row) => row.id === String(params[0]) && row.tenant_id === String(params[1]));
    return scenario ? result([{ id: scenario.id, company_id: scenario.company_id }]) : result();
  }

  if (sql.includes('SELECT s.company_id FROM scenarios s') && sql.includes('c.tenant_id::text = $2')) {
    const scenario = scenarios.find((row) => row.id === String(params[0]) && row.tenant_id === String(params[1]));
    return scenario ? result([{ company_id: scenario.company_id }]) : result();
  }

  if (sql.includes('SELECT pv.id, pv.company_id, pv.scenario_id, pv.assumption_set_id, pv.status, pv.is_frozen') && sql.includes('c.tenant_id::text = $2')) {
    const version = versions.find((row) => row.id === String(params[0]) && row.tenant_id === String(params[1]));
    return version
      ? result([{
          id: version.id,
          company_id: version.company_id,
          scenario_id: version.scenario_id,
          assumption_set_id: version.assumption_set_id,
          status: version.status,
          is_frozen: version.is_frozen,
        }])
      : result();
  }

  if (sql.includes('SELECT COALESCE(SUM(net_revenue), 0)::float8 AS value FROM pnl_projections')) {
    return result([{ value: metricStore[String(params[0])]?.revenue || 0 }]);
  }

  if (sql.includes('SELECT COALESCE(SUM(ebitda), 0)::float8 AS value FROM pnl_projections')) {
    return result([{ value: metricStore[String(params[0])]?.ebitda || 0 }]);
  }

  if (sql.includes('SELECT COALESCE(MAX(cash_runway_months), 0)::float8 AS value FROM cashflow_projections')) {
    return result([{ value: metricStore[String(params[0])]?.runway || 0 }]);
  }

  if (sql.includes('FROM sensitivity_analyses sa')) {
    return result(sensitivityRows);
  }

  if (sql.includes('SELECT COALESCE(SUM(t.net_revenue), 0) AS revenue') && sql.includes('FROM pnl_projections t')) {
    return result([{ revenue: 1200000, gross_profit: 540000, ebitda: 180000, net_income: 96000 }]);
  }

  if (sql.includes('SELECT COALESCE(AVG(GREATEST(-t.net_change, 0)), 0) AS burn') && sql.includes('FROM cashflow_projections t')) {
    return result([{ burn: 125000, runway: 14.5 }]);
  }

  if (sql.includes('SELECT pv.id, pv.company_id, pv.scenario_id, pv.assumption_set_id, pv.status, pv.is_frozen') && sql.includes('FROM plan_versions pv')) {
    const version = versions.find(
      (row) => row.id === String(params[0]) && row.company_id === String(params[1]) && row.scenario_id === String(params[2]),
    );
    return version
      ? result([{
          id: version.id,
          company_id: version.company_id,
          scenario_id: version.scenario_id,
          assumption_set_id: version.assumption_set_id,
          status: version.status,
          is_frozen: version.is_frozen,
        }])
      : result();
  }

  if (sql.includes('FROM planning_periods pp') && sql.includes('LEFT JOIN pnl_projections t') && sql.includes('COALESCE(SUM(t.gross_revenue), 0) AS gross_revenue')) {
    return result([
      { period_id: periods[0].id, label: periods[0].name, sequence_order: 1, gross_revenue: 420000, platform_commission: 88000, net_revenue: 332000, cogs_total: 138000, gross_profit: 194000, labor_cost: 54000, marketing_cost: 28000, opex_total: 46000, ebitda: 66000, depreciation: 9000, interest_expense: 5000, net_income: 42000 },
      { period_id: periods[1].id, label: periods[1].name, sequence_order: 2, gross_revenue: 460000, platform_commission: 96000, net_revenue: 364000, cogs_total: 151000, gross_profit: 213000, labor_cost: 58000, marketing_cost: 31000, opex_total: 49000, ebitda: 75000, depreciation: 9000, interest_expense: 5000, net_income: 50000 },
      { period_id: periods[2].id, label: periods[2].name, sequence_order: 3, gross_revenue: 500000, platform_commission: 104000, net_revenue: 396000, cogs_total: 163000, gross_profit: 233000, labor_cost: 62000, marketing_cost: 34000, opex_total: 52000, ebitda: 84000, depreciation: 9000, interest_expense: 6000, net_income: 57000 },
    ]);
  }

  if (sql.includes('SELECT driver_name, COALESCE(SUM(impact_amount), 0) AS impact') && sql.includes('FROM driver_explainability')) {
    const scenarioId = String(params[0]);
    const rows = driverExplainabilityRows
      .filter((row) => row.scenario_id === scenarioId)
      .map((row) => ({ driver_name: row.driver_name, impact: row.impact_amount }));
    return result(rows);
  }

  if (sql.includes('FROM format_taxonomy_nodes t')) {
    return result(scopeRows.formats);
  }

  if (sql.includes('FROM category_taxonomy_nodes t')) {
    return result(scopeRows.categories);
  }

  if (sql.includes('FROM portfolio_nodes t')) {
    return result(scopeRows.portfolio);
  }

  if (sql.includes('FROM geography_nodes t')) {
    return result(scopeRows.geography);
  }

  if (sql.includes('FROM channel_taxonomy_nodes')) {
    return result(scopeRows.channels);
  }

  if (sql.includes('FROM operating_model_nodes')) {
    return result(scopeRows.operatingModels);
  }

  if (sql.includes('WITH RECURSIVE tree AS (') && sql.includes('FROM format_taxonomy_nodes t')) {
    return result([
      { node_id: '70000000-0000-4000-8000-000000000111', parent_node_id: null, label: 'Dark Kitchen', code: 'DK', level: 0 },
      { node_id: '70000000-0000-4000-8000-000000000112', parent_node_id: '70000000-0000-4000-8000-000000000111', label: 'Express Pickup', code: 'XP', level: 1 },
    ]);
  }

  if (sql.includes('SELECT COUNT(*)::int AS total FROM scope_bundles')) {
    return result([{ total: 2 }]);
  }

  if (sql.includes('FROM scope_bundles sb') && sql.includes('dimension_count') && sql.includes('ORDER BY sb.created_at DESC')) {
    const filtered = scopeBundles
      .filter((bundle) => bundle.company_id === String(params[0]))
      .filter((bundle) => !params[3] || bundle.scenario_id === String(params[3]))
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map((bundle) => ({
        id: bundle.id,
        name: bundle.name,
        status: bundle.status,
        dimension_count: scopeBundleCounts.get(bundle.id) || 0,
      }));
    return result(filtered);
  }

  if (sql.includes('SELECT id FROM scope_bundles WHERE id::text = $1 AND company_id::text = $2 AND is_deleted = FALSE')) {
    const bundle = scopeBundles.find((row) => row.id === String(params[0]) && row.company_id === String(params[1]));
    return bundle ? result([{ id: bundle.id }]) : result();
  }

  if (sql.includes('SELECT id FROM scope_bundles WHERE id::text = $1 AND is_deleted = FALSE')) {
    const bundle = scopeBundles.find((row) => row.id === String(params[0]));
    return bundle ? result([{ id: bundle.id }]) : result();
  }

  if (sql.includes('SELECT COUNT(*)::int AS cnt FROM scope_bundle_items WHERE scope_bundle_id::text = $1')) {
    return result([{ cnt: scopeBundleCounts.get(String(params[0])) || 0 }]);
  }

  if (sql.includes('FROM scope_bundle_items sbi') && sql.includes('GROUP BY sbi.dimension_family')) {
    return result([{ dimension_family: 'formats', cnt: 2 }, { dimension_family: 'geography', cnt: 1 }]);
  }

  if (sql.includes('FROM assumption_field_bindings afb') && sql.includes('JOIN assumption_packs ap')) {
    const companyFilter = String(params[0]);
    const assumptionSetId = params[1] ? String(params[1]) : null;
    const rows = assumptionBindingRows
      .filter((row) => row.company_id === companyFilter)
      .filter((row) => !assumptionSetId || row.assumption_set_id === assumptionSetId)
      .map((row) => ({
        id: row.id,
        variable_name: row.variable_name,
        current_value: row.current_value,
        unit: row.unit,
        evidence_ref: row.evidence_ref,
        family: row.family,
        pack_name: row.pack_name,
      }));
    return result(rows);
  }

  if (sql.includes('SELECT id, status, trigger_type, created_at, completed_at FROM compute_runs') && sql.includes('WHERE company_id::text = $1')) {
    const companyFilter = String(params[0]);
    const scenarioFilter = String(params[1]);
    const versionFilter = params.length > 4 ? String(params[2]) : null;
    const statusFilter = params.length > 5 ? String(params[3]) : null;
    const rows = computeRuns
      .filter((run) => run.company_id === companyFilter && run.scenario_id === scenarioFilter)
      .filter((run) => !versionFilter || run.version_id === versionFilter)
      .filter((run) => !statusFilter || run.status === statusFilter)
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map((run) => ({
        id: run.id,
        status: run.status,
        trigger_type: run.trigger_type,
        created_at: run.created_at,
        completed_at: run.completed_at,
      }));
    return result(rows);
  }

  if (sql.includes('SELECT id, status, trigger_type, created_at, completed_at FROM compute_runs') && sql.includes('WHERE id::text = $1')) {
    const run = computeRuns.find((row) => row.id === String(params[0]));
    return run
      ? result([{
          id: run.id,
          status: run.status,
          trigger_type: run.trigger_type,
          created_at: run.created_at,
          completed_at: run.completed_at,
        }])
      : result();
  }

  if (sql.includes('SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = \'completed\')::int AS completed FROM compute_run_steps')) {
    const runId = String(params[0]);
    const steps = computeRunSteps.get(runId) || [];
    return result([{ total: steps.length, completed: steps.filter((step) => step.status === 'completed').length }]);
  }

  if (sql.includes('SELECT id, step_label, status, started_at, completed_at, COALESCE(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000, 0) AS duration_ms FROM compute_run_steps')) {
    const runId = String(params[0]);
    const rows = (computeRunSteps.get(runId) || []).map((step) => ({
      id: step.id,
      step_label: step.step_label,
      status: step.status,
      started_at: step.started_at || null,
      completed_at: step.completed_at || null,
      duration_ms: step.started_at && step.completed_at
        ? Math.max(new Date(step.completed_at).getTime() - new Date(step.started_at).getTime(), 0)
        : 0,
    }));
    return result(rows);
  }

  if (sql.includes('SELECT id, status, metadata FROM compute_runs') && sql.includes('WHERE id::text = $1')) {
    const run = computeRuns.find((row) => row.id === String(params[0]));
    return run ? result([{ id: run.id, status: run.status, metadata: run.metadata }]) : result();
  }

  if (sql.includes('SELECT id, status, completed_at, metadata FROM compute_runs') && sql.includes('WHERE company_id::text = $1')) {
    const companyFilter = String(params[0]);
    const scenarioFilter = params[1] ? String(params[1]) : null;
    const run = computeRuns
      .filter((row) => row.company_id === companyFilter)
      .filter((row) => !scenarioFilter || row.scenario_id === scenarioFilter)
      .sort((left, right) => {
        const leftDate = left.completed_at || left.created_at;
        const rightDate = right.completed_at || right.created_at;
        return rightDate.localeCompare(leftDate);
      })[0];
    return run ? result([{ id: run.id, status: run.status, completed_at: run.completed_at, metadata: run.metadata }]) : result();
  }

  if (sql.includes('SELECT rollup_scope, COALESCE(AVG(weighted_score), 0)::float8 AS avg_score')) {
    const companyFilter = String(params[0]);
    return result(
      confidenceRollups
        .filter((row) => row.company_id === companyFilter)
        .map((row) => ({
          rollup_scope: row.rollup_scope,
          avg_score: row.avg_score,
          assessment_count: row.assessment_count,
          critical_floor: row.critical_floor,
        })),
    );
  }

  if (sql.includes('SELECT de.driver_name, COALESCE(de.contribution_value, de.impact_amount, 0)::float8 AS contribution_value') && sql.includes('FROM driver_explainability de')) {
    const companyFilter = String(params[0]);
    const maybeScenarioId = params.length > 2 ? String(params[1]) : null;
    const targetMetric = String(params[params.length - 1]).toLowerCase();
    const rows = driverExplainabilityRows
      .filter((row) => row.company_id === companyFilter)
      .filter((row) => !maybeScenarioId || row.scenario_id === maybeScenarioId)
      .filter((row) => row.target_metric.toLowerCase() === targetMetric)
      .map((row) => ({
        driver_name: row.driver_name,
        contribution_value: row.contribution_value,
      }));
    return result(rows);
  }

  if (sql.includes('SELECT de.id, de.driver_name, COALESCE(de.contribution_value, de.impact_amount, 0)::float8 AS contribution_value') && sql.includes('FROM driver_explainability de')) {
    const companyFilter = String(params[0]);
    const scenarioFilter = String(params[1]);
    const targetMetric = String(params[2]).toLowerCase();
    const rows = driverExplainabilityRows
      .filter((row) => row.company_id === companyFilter && row.scenario_id === scenarioFilter)
      .filter((row) => row.target_metric.toLowerCase() === targetMetric)
      .map((row) => ({
        id: row.id,
        driver_name: row.driver_name,
        contribution_value: row.contribution_value,
        contribution_pct: row.contribution_pct,
      }));
    return result(rows);
  }

  if (sql.includes('SELECT COUNT(*)::int AS open_count') && sql.includes('FROM research_tasks')) {
    const companyFilter = String(params[0]);
    return result([{ open_count: researchTasks.filter((task) => task.company_id === companyFilter && task.status === 'open').length }]);
  }

  if (sql.includes('SELECT ei.title, ei.source_url, ei.source_type, ei.source_name, ei.metadata') && sql.includes('FROM evidence_items ei')) {
    const companyFilter = String(params[0]);
    const entityType = String(params[1]);
    const entityId = String(params[2]);
    return result(
      evidenceItems
        .filter((row) => row.company_id === companyFilter && row.entity_type === entityType && row.entity_id === entityId)
        .map((row) => ({
          title: row.title,
          source_url: row.source_url,
          source_type: row.source_type,
          source_name: row.source_name,
          metadata: row.metadata,
        })),
    );
  }

  if (sql.includes('SELECT title, status, description FROM research_tasks') && sql.includes('entity_type = $2')) {
    const companyFilter = String(params[0]);
    const entityType = String(params[1]);
    const entityId = String(params[2]);
    return result(
      researchTasks
        .filter((row) => row.company_id === companyFilter && row.entity_type === entityType && row.entity_id === entityId)
        .map((row) => ({
          title: row.title,
          status: row.status,
          description: row.description,
        })),
    );
  }

  if (sql.includes('SELECT COUNT(*)::int AS count FROM pnl_projections WHERE scenario_id::text = $1')) {
    return countResult(12);
  }

  if (sql.includes('SELECT COUNT(*)::int AS count FROM cashflow_projections WHERE scenario_id::text = $1')) {
    return countResult(12);
  }

  if (sql.includes('SELECT COUNT(*)::int AS count FROM balance_sheet_projections WHERE scenario_id::text = $1')) {
    return countResult(12);
  }

  if (sql.includes('SELECT COUNT(*)::int AS count FROM unit_economics_projections WHERE scenario_id::text = $1')) {
    return countResult(12);
  }

  if (sql.includes('SELECT COUNT(*)::int AS count FROM kpi_projections WHERE scenario_id::text = $1')) {
    return countResult(6);
  }

  if (sql.includes('SELECT COUNT(*)::int AS count FROM driver_explainability WHERE scenario_id::text = $1')) {
    return countResult(4);
  }

  if (sql.includes('INSERT INTO compute_runs') && sql.includes('RETURNING id, trigger_type, status, created_at, completed_at')) {
    const createdAt = '2026-04-05T11:30:00.000Z';
    const run: ComputeRunRecord = {
      id: String(params[0]),
      company_id: String(params[1]),
      scenario_id: String(params[2]),
      version_id: String(params[3]),
      trigger_type: String(params[4]),
      status: 'completed',
      created_at: createdAt,
      completed_at: createdAt,
      metadata: JSON.parse(String(params[6])),
    };
    computeRuns.unshift(run);
    computeRunSteps.set(run.id, []);
    return result([{
      id: run.id,
      trigger_type: run.trigger_type,
      status: run.status,
      created_at: run.created_at,
      completed_at: run.completed_at,
    }]);
  }

  if (sql.includes('INSERT INTO compute_run_steps')) {
    const runId = String(params[0]);
    const steps = computeRunSteps.get(runId) || [];
    steps.push({
      id: nextUuid(7400 + steps.length + 1),
      compute_run_id: runId,
      step_code: String(params[1]),
      step_label: String(params[2]),
      step_order: Number(params[3]),
      status: 'completed',
      started_at: '2026-04-05T11:30:00.000Z',
      completed_at: '2026-04-05T11:30:10.000Z',
      output_summary: JSON.parse(String(params[4])),
    });
    computeRunSteps.set(runId, steps);
    return result();
  }

  if (sql.includes('INSERT INTO compute_run_artifacts') || sql.includes('INSERT INTO compute_dependency_snapshots')) {
    return result();
  }

  if (sql.includes('SELECT id, status, metadata FROM compute_runs WHERE id::text = $1')) {
    const run = computeRuns.find((row) => row.id === String(params[0]));
    return run ? result([{ id: run.id, status: run.status, metadata: run.metadata }]) : result();
  }

  if (sql.includes('UPDATE compute_runs SET status = \'cancelled\'')) {
    const run = computeRuns.find((row) => row.id === String(params[0]));
    if (!run) {
      return result();
    }
    run.status = 'cancelled';
    run.completed_at = '2026-04-05T11:40:00.000Z';
    run.metadata = JSON.parse(String(params[1]));
    return result([{
      id: run.id,
      status: run.status,
      trigger_type: run.trigger_type,
      created_at: run.created_at,
      completed_at: run.completed_at,
    }]);
  }

  if (sql.includes('INSERT INTO scenarios (tenant_id, company_id, name, scenario_type, description, base_scenario_id)')) {
    const createdId = nextUuid(7000 + scenarios.length + 1);
    scenarios.unshift({
      id: createdId,
      tenant_id: String(params[0]),
      company_id: String(params[1]),
      name: String(params[2]),
      description: params[3] ? String(params[3]) : null,
      created_at: '2026-04-05T09:00:00.000Z',
      updated_at: '2026-04-05T09:00:00.000Z',
    });
    assumptionSets.set(createdId, nextUuid(8000 + assumptionSets.size + 1));
    return result([{ id: createdId, name: String(params[2]), created_at: '2026-04-05T09:00:00.000Z' }]);
  }

  if (sql.includes('INSERT INTO assumption_sets')) {
    return result([{ id: nextUuid(8000 + assumptionSets.size + 1) }]);
  }

  if (sql.includes('SELECT tenant_id FROM scenarios WHERE id = $1 AND company_id = $2')) {
    const scenario = scenarios.find((row) => row.id === String(params[0]) && row.company_id === String(params[1]));
    return scenario ? result([{ tenant_id: scenario.tenant_id }]) : result();
  }

  if (sql.includes('SELECT id FROM assumption_sets') && sql.includes('ORDER BY created_at DESC')) {
    const scenarioId = String(params[0]);
    const assumptionSetId = assumptionSets.get(scenarioId);
    return assumptionSetId ? result([{ id: assumptionSetId }]) : result();
  }

  if (sql.includes('INSERT INTO plan_versions')) {
    const createdId = nextUuid(9000 + versions.length + 1);
    const version: VersionRecord = {
      id: createdId,
      tenant_id: String(params[0]),
      company_id: String(params[1]),
      scenario_id: String(params[2]),
      assumption_set_id: String(params[3]),
      name: String(params[4]),
      status: 'draft',
      is_frozen: false,
      created_at: '2026-04-05T09:05:00.000Z',
      updated_at: '2026-04-05T09:05:00.000Z',
    };
    versions.unshift(version);
    return result([{ id: version.id, name: version.name, status: version.status, is_frozen: version.is_frozen, created_at: version.created_at }]);
  }

  return result();
}

(db as unknown as { query: typeof mockQuery }).query = mockQuery;
(db as unknown as { connect: () => Promise<{ query: typeof mockQuery; release: () => void }> }).connect = async () => ({
  query: mockQuery,
  release: () => undefined,
});

const port = Number(process.env.PLAYWRIGHT_API_PORT || '4100');
const app = createApp();

app.listen(port, '127.0.0.1', () => {
  process.stdout.write(`Fixture API listening on ${port}\n`);
});
