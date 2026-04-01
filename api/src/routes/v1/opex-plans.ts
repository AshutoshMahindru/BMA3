import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /opex-plans
router.get('/', async (req, res, next) => {
  try {
    const { scenario_id, kitchen_id } = req.query;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';
    
    let query = 'SELECT * FROM opex_plans WHERE tenant_id = $1 AND is_deleted = false';
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

// POST /opex-plans
router.post('/', async (req, res, next) => {
  try {
    const { scenario_id, assumption_set_id, planning_period_id, kitchen_id, monthly_rent, utilities, tech_saas_fees, insurance, maintenance, cost_behavior, escalation_rate_annual_pct } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    const result = await db.query(
      `INSERT INTO opex_plans (tenant_id, scenario_id, assumption_set_id, planning_period_id, kitchen_id, monthly_rent, utilities, tech_saas_fees, insurance, maintenance, cost_behavior, escalation_rate_annual_pct) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
       ON CONFLICT (tenant_id, scenario_id, assumption_set_id, planning_period_id, kitchen_id)
       DO UPDATE SET
          monthly_rent = EXCLUDED.monthly_rent,
          utilities = EXCLUDED.utilities,
          tech_saas_fees = EXCLUDED.tech_saas_fees,
          insurance = EXCLUDED.insurance,
          maintenance = EXCLUDED.maintenance,
          cost_behavior = EXCLUDED.cost_behavior,
          escalation_rate_annual_pct = EXCLUDED.escalation_rate_annual_pct,
          updated_at = NOW()
       RETURNING *`,
      [tenant_id, scenario_id, assumption_set_id, planning_period_id, kitchen_id, monthly_rent || 0, utilities || 0, tech_saas_fees || 0, insurance || 0, maintenance || 0, cost_behavior || 'FIXED', escalation_rate_annual_pct || 0]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
