import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /unit-cost-profiles
router.get('/', async (req, res, next) => {
  try {
    const { scenario_id, product_family_id } = req.query;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';
    
    let query = 'SELECT * FROM unit_cost_profiles WHERE tenant_id = $1 AND is_deleted = false';
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

// POST /unit-cost-profiles
router.post('/', async (req, res, next) => {
  try {
    const { scenario_id, assumption_set_id, product_family_id, food_cost_per_order, packaging_cost_per_order, food_cost_pct, effective_from, escalation_rate_annual_pct } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    const result = await db.query(
      `INSERT INTO unit_cost_profiles (tenant_id, scenario_id, assumption_set_id, product_family_id, food_cost_per_order, packaging_cost_per_order, food_cost_pct, effective_from, escalation_rate_annual_pct) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [tenant_id, scenario_id, assumption_set_id, product_family_id, food_cost_per_order, packaging_cost_per_order, food_cost_pct, effective_from, escalation_rate_annual_pct || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
