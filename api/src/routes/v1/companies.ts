import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /companies/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM companies WHERE id = $1 AND is_deleted = false', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Company not found' }
      });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /companies
router.post('/', async (req, res, next) => {
  try {
    const { name, base_currency, fiscal_year_start_month } = req.body;
    
    // In a real multi-tenant system, tenant_id would be extracted from the JWT token.
    // For scaffolding, we generate a mock standard one or expect it.
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    const result = await db.query(
      `INSERT INTO companies (tenant_id, name, base_currency, fiscal_year_start_month, country_code) 
       VALUES ($1, $2, $3, $4, 'US') 
       RETURNING id, name, base_currency`,
      [tenant_id, name, base_currency || 'USD', fiscal_year_start_month || 1]
    );

    res.status(201).json({
      id: result.rows[0].id,
      name: result.rows[0].name,
      base_currency: result.rows[0].base_currency,
      status: 'ACTIVE'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
