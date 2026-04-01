import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /mix-plans
router.get('/', async (req, res, next) => {
  try {
    const { scenario_id, market_id } = req.query;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';
    
    let query = 'SELECT * FROM mix_plans WHERE tenant_id = $1 AND is_deleted = false';
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

// POST /mix-plans
router.post('/', async (req, res, next) => {
  try {
    const { scenario_id, assumption_set_id, planning_period_id, market_id, platform_mix, attach_rate_sides, attach_rate_beverages } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    const result = await db.query(
      `INSERT INTO mix_plans (tenant_id, scenario_id, assumption_set_id, planning_period_id, market_id, platform_mix, attach_rate_sides, attach_rate_beverages) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       ON CONFLICT (tenant_id, scenario_id, assumption_set_id, planning_period_id, market_id)
       DO UPDATE SET
          platform_mix = EXCLUDED.platform_mix,
          attach_rate_sides = EXCLUDED.attach_rate_sides,
          attach_rate_beverages = EXCLUDED.attach_rate_beverages,
          updated_at = NOW()
       RETURNING *`,
      [tenant_id, scenario_id, assumption_set_id, planning_period_id, market_id, platform_mix, attach_rate_sides || 0, attach_rate_beverages || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
