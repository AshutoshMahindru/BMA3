import { Queue, Worker, QueueEvents } from 'bullmq';
const IORedis = require('ioredis');
import { db } from '../db';

const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  retryStrategy(times: number) {
    return Math.min(times * 1000, 5000); // Wait up to 5s before reconnecting
  }
});

// Suppress unhandled infinite error spam
connection.on('error', () => {
   // Silent background reconnect
});

export const projectionQueue = new Queue('FinancialProjections', { connection });
export const projectionQueueEvents = new QueueEvents('FinancialProjections', { connection });

export const projectionWorker = new Worker(
  'FinancialProjections',
  async (job) => {
    const { tenant_id, scenario_id, period_range_start, period_range_end } = job.data;
    
    // Step 1: Initialize Database Connection
    const client = await db.connect();
    
    try {
      await client.query('BEGIN');
      await job.updateProgress(10);

      // Step 2: Fetch Base Demand Data
      // For MVP, we will assume period_range_start defines the target planning_period_id
      const period_id = period_range_start || 'p_2026_01';
      
      const demandRes = await client.query(
        `SELECT SUM(base_orders) as total_base_orders, AVG(growth_rate_pct) as avg_growth, AVG(seasonality_index) as avg_seasonality 
         FROM demand_drivers WHERE tenant_id = $1 AND scenario_id = $2 AND planning_period_id = $3`,
        [tenant_id, scenario_id, period_id]
      );
      
      // Real Mathematical Compute for Orders
      const baseOrders = parseFloat(demandRes.rows[0]?.total_base_orders || '0');
      const growth = parseFloat(demandRes.rows[0]?.avg_growth || '0');
      const seasonality = parseFloat(demandRes.rows[0]?.avg_seasonality || '1');
      const ordersCount = Math.round(baseOrders * (1 + growth) * seasonality);
      
      await job.updateProgress(30);

      // Step 3: Fetch Pricing and Mix to compute Gross & Net Revenue
      const priceRes = await client.query(
        `SELECT AVG(list_price) as avg_price, AVG(discount_pct) as avg_discount, AVG(net_realized_price) as avg_net 
         FROM price_plans WHERE tenant_id = $1 AND scenario_id = $2`,
        [tenant_id, scenario_id]
      );
      
      const aovGross = parseFloat(priceRes.rows[0]?.avg_price || '0');
      const discountPct = parseFloat(priceRes.rows[0]?.avg_discount || '0');
      
      // Exact Spec Formula
      const grossRevenue = ordersCount * aovGross;
      const discounts = grossRevenue * discountPct;
      const netRevenueAfterDiscount = grossRevenue - discounts;
      
      // Deduct 20% platform proxy commission
      const platformCommission = netRevenueAfterDiscount * 0.20;
      const netRevenue = netRevenueAfterDiscount - platformCommission;
      
      await job.updateProgress(50);

      // Step 4: Unit Costs / COGS
      const costRes = await client.query(
        `SELECT AVG(food_cost_per_order) as fco, AVG(packaging_cost_per_order) as pco 
         FROM unit_cost_profiles WHERE tenant_id = $1 AND scenario_id = $2`,
        [tenant_id, scenario_id]
      );
      
      const cogs = ordersCount * (parseFloat(costRes.rows[0]?.fco || '0') + parseFloat(costRes.rows[0]?.pco || '0'));
      const grossProfit = netRevenue - cogs;
      
      // Labor Cost
      const laborRes = await client.query(
        `SELECT role_definitions FROM labor_models WHERE tenant_id = $1 AND scenario_id = $2`,
        [tenant_id, scenario_id]
      );
      
      let laborCost = 0;
      if (laborRes.rows.length > 0 && typeof laborRes.rows[0].role_definitions === 'string') {
         const roles = JSON.parse(laborRes.rows[0].role_definitions);
         roles.forEach((r: any) => {
           laborCost += parseFloat(r.fixed_monthly_cost || '0') * (r.headcount || 1);
           laborCost += parseFloat(r.variable_cost_per_order || '0') * ordersCount;
         });
      }

      await job.updateProgress(70);

      // Step 5: Opex, Marketing & Capex
      const opexRes = await client.query(`SELECT * FROM opex_plans WHERE tenant_id = $1 AND scenario_id = $2`, [tenant_id, scenario_id]);
      let opexOther = 0;
      let rent = 0;
      if (opexRes.rows.length > 0) {
        const opex = opexRes.rows[0];
        rent = parseFloat(opex.monthly_rent || '0');
        opexOther = parseFloat(opex.utilities || '0') + parseFloat(opex.tech_saas_fees || '0') + parseFloat(opex.insurance || '0') + parseFloat(opex.maintenance || '0');
      }

      const mktRes = await client.query(`SELECT SUM(total_budget) as tmb FROM marketing_plans WHERE tenant_id = $1 AND scenario_id = $2`, [tenant_id, scenario_id]);
      const marketingCost = parseFloat(mktRes.rows[0]?.tmb || '0');

      const capexRes = await client.query(`SELECT SUM(monthly_depreciation) as md FROM capex_plans WHERE tenant_id = $1 AND scenario_id = $2`, [tenant_id, scenario_id]);
      const depreciation = parseFloat(capexRes.rows[0]?.md || '0');

      // Final EBITDA and Net Income (Spec Logic)
      const ebitda = grossProfit - laborCost - rent - opexOther - marketingCost;
      const ebit = ebitda - depreciation;
      const financeCosts = 0; // Stub phase 4 capital modules
      const netIncome = ebit - financeCosts;
      
      await job.updateProgress(90);

      // Step 6: Upsert into PNL Projections Table
      await client.query(
        `INSERT INTO pnl_projections (
           tenant_id, scenario_id, planning_period_id, 
           gross_revenue, net_revenue, cogs, gross_profit, gross_margin_pct,
           labor_cost, rent, opex_other, marketing_cost, 
           ebitda, ebitda_margin_pct, depreciation, ebit, finance_costs, net_income
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
         ) ON CONFLICT (tenant_id, scenario_id, planning_period_id) 
           DO UPDATE SET 
             gross_revenue = EXCLUDED.gross_revenue,
             net_revenue = EXCLUDED.net_revenue,
             cogs = EXCLUDED.cogs,
             gross_profit = EXCLUDED.gross_profit,
             labor_cost = EXCLUDED.labor_cost,
             rent = EXCLUDED.rent,
             opex_other = EXCLUDED.opex_other,
             marketing_cost = EXCLUDED.marketing_cost,
             ebitda = EXCLUDED.ebitda,
             depreciation = EXCLUDED.depreciation,
             ebit = EXCLUDED.ebit,
             net_income = EXCLUDED.net_income
        `,
        [tenant_id, scenario_id, period_id, 
         grossRevenue, netRevenue, cogs, grossProfit, (grossProfit / (netRevenue || 1)),
         laborCost, rent, opexOther, marketingCost, 
         ebitda, (ebitda / (netRevenue || 1)), depreciation, ebit, financeCosts, netIncome
        ]
      );

      // Step 7: SPRINT 3.1 - KPI Extraction Engine
      const runwayMonths = ebitda < 0 ? Math.round(1000000 / Math.abs(ebitda)) : 999; // Mock total cash divided by burn
      const newCustomers = 2000; // Expected from marketing
      const cac = marketingCost / (newCustomers || 1);
      const clv = (netRevenue / ordersCount) * 1.5 * 6; // AOV * Freq * Retention Month
      const roicPct = ebit / 395000; // EBIT / Capital Layout

      await client.query(
        `INSERT INTO kpi_projections (
           tenant_id, scenario_id, planning_period_id,
           runway_months, monthly_burn, cac, clv, clv_cac_ratio, roic_pct, ebitda_margin_pct
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (tenant_id, scenario_id, planning_period_id)
         DO UPDATE SET
           runway_months = EXCLUDED.runway_months,
           monthly_burn = EXCLUDED.monthly_burn,
           cac = EXCLUDED.cac,
           clv = EXCLUDED.clv,
           clv_cac_ratio = EXCLUDED.clv_cac_ratio,
           roic_pct = EXCLUDED.roic_pct,
           ebitda_margin_pct = EXCLUDED.ebitda_margin_pct
        `,
        [tenant_id, scenario_id, period_id, 
         runwayMonths, Math.abs(ebitda < 0 ? ebitda : 0), cac, clv, (clv / (cac || 1)), roicPct, (ebitda / (netRevenue || 1))]
      );

      await client.query('COMMIT');
      
      return {
        status: 'COMPLETED',
        result_url: `/api/v1/financial-projections/pnl?scenario_id=${scenario_id}`
      };
      
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
  { connection }
);
