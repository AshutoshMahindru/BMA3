import crypto from 'crypto';
import { db } from '../db';

export type OutputCounts = {
  pnl: number;
  cashflow: number;
  balanceSheet: number;
  unitEconomics: number;
  kpis: number;
  explainability: number;
};

export const dependencyGraph = {
  nodes: [
    { id: 'planning_spine', label: 'Resolve Planning Spine', stage: 'context' },
    { id: 'financial_aggregate', label: 'Aggregate Seeded Financials', stage: 'compute' },
    { id: 'artifact_manifest', label: 'Record Artifacts', stage: 'finalize' },
  ],
  edges: [
    { from: 'planning_spine', to: 'financial_aggregate' },
    { from: 'financial_aggregate', to: 'artifact_manifest' },
  ],
  criticalPath: ['planning_spine', 'financial_aggregate', 'artifact_manifest'],
};

async function countQuery(sql: string, params: string[]): Promise<number> {
  const result = await db.query(sql, params);
  return Number(result.rows[0]?.count || 0);
}

export async function projectionCountsByScenario(scenarioId: string): Promise<OutputCounts> {
  const [pnl, cash, balance, unit, kpi, explainability] = await Promise.all([
    countQuery('SELECT COUNT(*)::int AS count FROM pnl_projections WHERE scenario_id::text = $1', [scenarioId]),
    countQuery('SELECT COUNT(*)::int AS count FROM cashflow_projections WHERE scenario_id::text = $1', [scenarioId]),
    countQuery('SELECT COUNT(*)::int AS count FROM balance_sheet_projections WHERE scenario_id::text = $1', [scenarioId]),
    countQuery('SELECT COUNT(*)::int AS count FROM unit_economics_projections WHERE scenario_id::text = $1', [scenarioId]),
    countQuery('SELECT COUNT(*)::int AS count FROM kpi_projections WHERE scenario_id::text = $1', [scenarioId]),
    countQuery('SELECT COUNT(*)::int AS count FROM driver_explainability WHERE scenario_id::text = $1', [scenarioId]),
  ]);

  return {
    pnl,
    cashflow: cash,
    balanceSheet: balance,
    unitEconomics: unit,
    kpis: kpi,
    explainability,
  };
}

export async function projectionCountsByRun(runId: string): Promise<OutputCounts> {
  const [pnl, cash, balance, unit, kpi, explainability] = await Promise.all([
    countQuery('SELECT COUNT(*)::int AS count FROM pnl_projections WHERE compute_run_id::text = $1', [runId]),
    countQuery('SELECT COUNT(*)::int AS count FROM cashflow_projections WHERE compute_run_id::text = $1', [runId]),
    countQuery('SELECT COUNT(*)::int AS count FROM balance_sheet_projections WHERE compute_run_id::text = $1', [runId]),
    countQuery('SELECT COUNT(*)::int AS count FROM unit_economics_projections WHERE compute_run_id::text = $1', [runId]),
    countQuery('SELECT COUNT(*)::int AS count FROM kpi_projections WHERE compute_run_id::text = $1', [runId]),
    countQuery('SELECT COUNT(*)::int AS count FROM driver_explainability WHERE compute_run_id::text = $1', [runId]),
  ]);

  return {
    pnl,
    cashflow: cash,
    balanceSheet: balance,
    unitEconomics: unit,
    kpis: kpi,
    explainability,
  };
}

export async function replaceRunArtifacts(args: {
  runId: string;
  companyId: string;
  scenarioId: string;
  versionId: string;
  assumptionSetId?: string | null;
  scopeBundleId?: string | null;
  counts: OutputCounts;
}): Promise<void> {
  const {
    runId,
    companyId,
    scenarioId,
    versionId,
    assumptionSetId,
    scopeBundleId,
    counts,
  } = args;

  await db.query(`DELETE FROM compute_run_artifacts WHERE compute_run_id = $1`, [runId]);
  await db.query(`DELETE FROM compute_dependency_snapshots WHERE compute_run_id = $1`, [runId]);

  const artifactRows: Array<[string, number]> = [
    ['pnl_projections', counts.pnl],
    ['cashflow_projections', counts.cashflow],
    ['balance_sheet_projections', counts.balanceSheet],
    ['unit_economics_projections', counts.unitEconomics],
    ['kpi_projections', counts.kpis],
    ['driver_explainability', counts.explainability],
  ];

  for (const [artifactType, rowCount] of artifactRows) {
    await db.query(
      `INSERT INTO compute_run_artifacts (compute_run_id, artifact_type, row_count, metadata)
       VALUES ($1, $2, $3, '{}'::jsonb)`,
      [runId, artifactType, rowCount],
    );
  }

  await db.query(
    `INSERT INTO compute_dependency_snapshots
       (compute_run_id, snapshot_hash, dependency_manifest, assumption_set_ids, scope_bundle_state, metadata)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, '{}'::jsonb)`,
    [
      runId,
      crypto.createHash('sha1').update(`${companyId}:${scenarioId}:${versionId}`).digest('hex'),
      JSON.stringify(dependencyGraph),
      JSON.stringify(assumptionSetId ? [assumptionSetId] : []),
      JSON.stringify({ scopeBundleId: scopeBundleId || null }),
    ],
  );
}
