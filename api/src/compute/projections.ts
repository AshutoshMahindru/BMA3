import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { ComputeContext } from './orchestrator';

type ProjectionTable =
  | 'pnl_projections'
  | 'cashflow_projections'
  | 'balance_sheet_projections'
  | 'unit_economics_projections'
  | 'kpi_projections';

const PROJECTION_TABLES = new Set<ProjectionTable>([
  'pnl_projections',
  'cashflow_projections',
  'balance_sheet_projections',
  'unit_economics_projections',
  'kpi_projections',
]);

const defaultKitchenIds = new Map<string, string>();

async function getDefaultKitchenId(tenantId: string): Promise<string> {
  const cached = defaultKitchenIds.get(tenantId);
  if (cached) {
    return cached;
  }

  const result = await db.query(
    `SELECT id
       FROM kitchens
      WHERE tenant_id = $1
        AND is_deleted = FALSE
      ORDER BY created_at ASC
      LIMIT 1`,
    [tenantId]
  );

  if (result.rowCount === 0) {
    throw new Error(`[projections] No kitchen found for tenant ${tenantId}`);
  }

  const kitchenId = result.rows[0].id as string;
  defaultKitchenIds.set(tenantId, kitchenId);
  return kitchenId;
}

function inferKpiCategory(metricName: string): string {
  if (
    metricName.includes('irr')
    || metricName.includes('roic')
    || metricName.includes('npv')
    || metricName.includes('payback')
  ) {
    return 'return';
  }

  if (metricName.includes('runway') || metricName.includes('burn')) {
    return 'liquidity';
  }

  if (
    metricName.includes('orders')
    || metricName.includes('capacity')
    || metricName.includes('utilization')
  ) {
    return 'operational';
  }

  if (metricName.includes('cac') || metricName.includes('clv')) {
    return 'commercial';
  }

  return 'financial';
}

export async function replaceProjectionMetric(
  table: ProjectionTable,
  ctx: ComputeContext,
  periodId: string,
  metricName: string,
  value: number,
  dimensionSignatures: Record<string, unknown> = {}
): Promise<void> {
  if (!PROJECTION_TABLES.has(table)) {
    throw new Error(`Unsupported projection table: ${table}`);
  }

  await db.query(
    `DELETE FROM ${table}
      WHERE company_id = $1
        AND scenario_id = $2
        AND version_id = $3
        AND period_id = $4
        AND compute_run_id = $5
        AND metric_name = $6`,
    [ctx.company_id, ctx.scenario_id, ctx.version_id, periodId, ctx.run_id, metricName]
  );

  const jsonDimensions = JSON.stringify(dimensionSignatures);

  if (table === 'pnl_projections') {
    await db.query(
      `INSERT INTO pnl_projections
         (id, tenant_id, scenario_id, planning_period_id, geographic_level, entity_id,
          company_id, version_id, period_id, compute_run_id, metric_name, value,
          dimension_signatures, created_at)
       VALUES ($1, $2, $3, $4, 'company'::geographic_level, $5,
               $6, $7, $8, $9, $10, $11, $12::jsonb, NOW())`,
      [
        uuidv4(),
        ctx.tenant_id,
        ctx.scenario_id,
        periodId,
        ctx.company_id,
        ctx.company_id,
        ctx.version_id,
        periodId,
        ctx.run_id,
        metricName,
        value,
        jsonDimensions,
      ]
    );
    return;
  }

  if (table === 'cashflow_projections') {
    await db.query(
      `INSERT INTO cashflow_projections
         (id, tenant_id, scenario_id, planning_period_id,
          opening_balance, operating_cashflow, investing_cashflow,
          financing_cashflow, net_change, closing_balance,
          company_id, version_id, period_id, compute_run_id, metric_name, value,
          dimension_signatures, created_at)
       VALUES ($1, $2, $3, $4,
               0, 0, 0, 0, 0, 0,
               $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())`,
      [
        uuidv4(),
        ctx.tenant_id,
        ctx.scenario_id,
        periodId,
        ctx.company_id,
        ctx.version_id,
        periodId,
        ctx.run_id,
        metricName,
        value,
        jsonDimensions,
      ]
    );
    return;
  }

  if (table === 'balance_sheet_projections') {
    await db.query(
      `INSERT INTO balance_sheet_projections
         (id, tenant_id, scenario_id, planning_period_id,
          company_id, version_id, period_id, compute_run_id, metric_name, value,
          dimension_signatures, created_at)
       VALUES ($1, $2, $3, $4,
               $5, $6, $7, $8, $9, $10, $11::jsonb, NOW())`,
      [
        uuidv4(),
        ctx.tenant_id,
        ctx.scenario_id,
        periodId,
        ctx.company_id,
        ctx.version_id,
        periodId,
        ctx.run_id,
        metricName,
        value,
        jsonDimensions,
      ]
    );
    return;
  }

  if (table === 'unit_economics_projections') {
    const kitchenId = await getDefaultKitchenId(ctx.tenant_id);
    await db.query(
      `INSERT INTO unit_economics_projections
         (id, tenant_id, scenario_id, kitchen_id, planning_period_id,
          company_id, version_id, period_id, compute_run_id, metric_name, value,
          dimension_signatures, created_at)
       VALUES ($1, $2, $3, $4, $5,
               $6, $7, $8, $9, $10, $11, $12::jsonb, NOW())`,
      [
        uuidv4(),
        ctx.tenant_id,
        ctx.scenario_id,
        kitchenId,
        periodId,
        ctx.company_id,
        ctx.version_id,
        periodId,
        ctx.run_id,
        metricName,
        value,
        jsonDimensions,
      ]
    );
    return;
  }

  await db.query(
    `INSERT INTO kpi_projections
       (id, tenant_id, scenario_id, planning_period_id, kpi_name, kpi_category, kpi_value,
        company_id, version_id, period_id, compute_run_id, metric_name, value,
        dimension_signatures, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::kpi_category, $7,
             $8, $9, $10, $11, $12, $13, $14::jsonb, NOW())`,
    [
      uuidv4(),
      ctx.tenant_id,
      ctx.scenario_id,
      periodId,
      metricName,
      inferKpiCategory(metricName),
      value,
      ctx.company_id,
      ctx.version_id,
      periodId,
      ctx.run_id,
      metricName,
      value,
      jsonDimensions,
    ]
  );
}
