import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /labor-models
router.get('/', async (req, res, next) => {
  try {
    const { scenario_id, kitchen_id, planning_period_id } = req.query;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';
    
    let query = 'SELECT * FROM labor_models WHERE tenant_id = $1 AND is_deleted = false';
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

// POST /labor-models
router.post('/', async (req, res, next) => {
  try {
    const { scenario_id, assumption_set_id, planning_period_id, kitchen_id, role_definitions, hiring_triggers } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    const result = await db.query(
      `INSERT INTO labor_models (tenant_id, scenario_id, assumption_set_id, planning_period_id, kitchen_id, role_definitions, hiring_triggers) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       ON CONFLICT (tenant_id, scenario_id, assumption_set_id, planning_period_id, kitchen_id)
       DO UPDATE SET
          role_definitions = EXCLUDED.role_definitions,
          hiring_triggers = EXCLUDED.hiring_triggers,
          updated_at = NOW()
       RETURNING *`,
      [tenant_id, scenario_id, assumption_set_id, planning_period_id, kitchen_id, JSON.stringify(role_definitions), JSON.stringify(hiring_triggers)]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
