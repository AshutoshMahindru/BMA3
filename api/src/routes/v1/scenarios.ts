import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /scenarios
router.get('/', async (req, res, next) => {
  try {
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';
    const result = await db.query(
      'SELECT * FROM scenarios WHERE tenant_id = $1 AND is_deleted = false',
      [tenant_id]
    );
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /scenarios
router.post('/', async (req, res, next) => {
  try {
    const { company_id, name, scenario_type, description, base_scenario_id } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    const result = await db.query(
      `INSERT INTO scenarios (tenant_id, company_id, name, scenario_type, description, base_scenario_id) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [tenant_id, company_id, name, scenario_type || 'base', description, base_scenario_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
