import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /marketing-plans
router.get('/', async (req, res, next) => {
  try {
    const { scenario_id, market_id } = req.query;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';
    
    let query = 'SELECT * FROM marketing_plans WHERE tenant_id = $1 AND is_deleted = false';
    const params: any[] = [tenant_id];

    if (scenario_id) {
      params.push(scenario_id);
      query += ` AND scenario_id = $${params.length}`;
    }

    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /marketing-plans
router.post('/', async (req, res, next) => {
  try {
    const { scenario_id, assumption_set_id, planning_period_id, market_id, total_budget, channel_allocation, cac_assumption, expected_new_customers, expected_demand_uplift_pct } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    const result = await db.query(
      `INSERT INTO marketing_plans (tenant_id, scenario_id, assumption_set_id, planning_period_id, market_id, total_budget, channel_allocation, cac_assumption, expected_new_customers, expected_demand_uplift_pct) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       ON CONFLICT (tenant_id, scenario_id, assumption_set_id, planning_period_id, market_id)
       DO UPDATE SET
          total_budget = EXCLUDED.total_budget,
          channel_allocation = EXCLUDED.channel_allocation,
          cac_assumption = EXCLUDED.cac_assumption,
          expected_new_customers = EXCLUDED.expected_new_customers,
          expected_demand_uplift_pct = EXCLUDED.expected_demand_uplift_pct,
          updated_at = NOW()
       RETURNING *`,
      [tenant_id, scenario_id, assumption_set_id, planning_period_id, market_id, total_budget || 0, JSON.stringify(channel_allocation || {}), cac_assumption || 0, expected_new_customers || 0, expected_demand_uplift_pct || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
