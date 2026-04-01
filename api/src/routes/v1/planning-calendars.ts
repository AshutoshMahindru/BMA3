import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /planning-calendars
router.get('/', async (req, res, next) => {
  try {
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';
    const result = await db.query(
      'SELECT * FROM planning_calendars WHERE tenant_id = $1 AND is_deleted = false',
      [tenant_id]
    );
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /planning-calendars
router.post('/', async (req, res, next) => {
  try {
    const { company_id, name, start_date, end_date } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    const result = await db.query(
      `INSERT INTO planning_calendars (tenant_id, company_id, name, start_date, end_date) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [tenant_id, company_id, name, start_date, end_date]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
