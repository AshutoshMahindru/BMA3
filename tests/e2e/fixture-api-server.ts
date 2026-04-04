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

  if (sql.includes('FROM scope_bundle_items sbi') && sql.includes('GROUP BY sbi.dimension_family')) {
    return result([{ dimension_family: 'formats', cnt: 2 }, { dimension_family: 'geography', cnt: 1 }]);
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
