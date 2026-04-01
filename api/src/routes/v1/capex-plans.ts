import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /capex-plans
router.get('/', async (req, res, next) => {
  try {
    const { scenario_id, kitchen_id } = req.query;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';
    
    let query = 'SELECT * FROM capex_plans WHERE tenant_id = $1 AND is_deleted = false';
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

// POST /capex-plans
router.post('/', async (req, res, next) => {
  try {
    const { scenario_id, assumption_set_id, kitchen_id, capex_month, equipment_capex, fitout_capex, tech_capex, permits_capex, depreciation_method, useful_life_months } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    // MATHEMATICAL CALCULATION IMPLEMENTATION
    const e = parseFloat(equipment_capex || '0');
    const f = parseFloat(fitout_capex || '0');
    const t = parseFloat(tech_capex || '0');
    const p = parseFloat(permits_capex || '0');
    
    const total_capex = e + f + t + p;
    const months = useful_life_months || 60; // default 5 years
    
    let monthly_depreciation = 0;
    if (depreciation_method === 'STRAIGHT_LINE' && months > 0) {
      monthly_depreciation = total_capex / months;
    }

    // Default payback assumption based on typical $25k monthly EBITDA
    const payback_estimate_months = total_capex > 0 ? total_capex / 25000 : 0;

    const result = await db.query(
      `INSERT INTO capex_plans (tenant_id, scenario_id, assumption_set_id, kitchen_id, capex_month_id, equipment_capex, fitout_capex, tech_capex, permits_capex, total_capex, depreciation_method, useful_life_months, monthly_depreciation, payback_estimate_months) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) 
       ON CONFLICT (tenant_id, scenario_id, assumption_set_id, kitchen_id)
       DO UPDATE SET
          equipment_capex = EXCLUDED.equipment_capex,
          fitout_capex = EXCLUDED.fitout_capex,
          tech_capex = EXCLUDED.tech_capex,
          permits_capex = EXCLUDED.permits_capex,
          total_capex = EXCLUDED.total_capex,
          depreciation_method = EXCLUDED.depreciation_method,
          useful_life_months = EXCLUDED.useful_life_months,
          monthly_depreciation = EXCLUDED.monthly_depreciation,
          payback_estimate_months = EXCLUDED.payback_estimate_months,
          updated_at = NOW()
       RETURNING *`,
      [tenant_id, scenario_id, assumption_set_id, kitchen_id, capex_month, e, f, t, p, total_capex, depreciation_method || 'STRAIGHT_LINE', months, monthly_depreciation, payback_estimate_months]
    );

    res.status(201).json({
       id: result.rows[0].id,
       total_capex: result.rows[0].total_capex,
       monthly_depreciation: result.rows[0].monthly_depreciation,
       payback_estimate_months: Math.round(result.rows[0].payback_estimate_months)
    });
  } catch (error) {
    next(error);
  }
});

export default router;
