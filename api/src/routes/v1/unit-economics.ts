import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /unit-economics
router.get('/', async (req, res, next) => {
  try {
    const { scenario_id, planning_period_id } = req.query;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';
    
    // In the real system, unit economics are continuously derived from PNL Projections divided by demand orders
    let query = 'SELECT * FROM unit_economics_projections WHERE tenant_id = $1 AND is_deleted = false';
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

export default router;
