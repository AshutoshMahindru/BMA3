import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /working-capital-policies
router.get('/', async (req, res, next) => {
  try {
    const { scenario_id, kitchen_id } = req.query;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';
    
    let query = 'SELECT * FROM working_capital_policies WHERE tenant_id = $1 AND is_deleted = false';
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

// POST /working-capital-policies
router.post('/', async (req, res, next) => {
  try {
    const { scenario_id, assumption_set_id, kitchen_id, inventory_days, payable_days, platform_settlement_days, cash_buffer_minimum, cash_buffer_months } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    const result = await db.query(
      `INSERT INTO working_capital_policies (tenant_id, scenario_id, assumption_set_id, kitchen_id, inventory_days, payable_days, platform_settlement_days, cash_buffer_minimum, cash_buffer_months) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       ON CONFLICT (tenant_id, scenario_id, assumption_set_id, kitchen_id)
       DO UPDATE SET
          inventory_days = EXCLUDED.inventory_days,
          payable_days = EXCLUDED.payable_days,
          platform_settlement_days = EXCLUDED.platform_settlement_days,
          cash_buffer_minimum = EXCLUDED.cash_buffer_minimum,
          cash_buffer_months = EXCLUDED.cash_buffer_months,
          updated_at = NOW()
       RETURNING *`,
      [tenant_id, scenario_id, assumption_set_id, kitchen_id, inventory_days || 7, payable_days || 30, platform_settlement_days || 14, cash_buffer_minimum || 0, cash_buffer_months || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
