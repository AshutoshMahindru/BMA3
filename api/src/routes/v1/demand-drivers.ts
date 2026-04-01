import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /demand-drivers
router.get('/', async (req, res, next) => {
  try {
    const { scenario_id, planning_period_id } = req.query;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';
    
    // In production, robust filtering mechanism goes here
    const result = await db.query(
      `SELECT * FROM demand_drivers 
       WHERE tenant_id = $1 AND scenario_id = $2 
       AND is_deleted = false LIMIT 100`,
      [tenant_id, scenario_id]
    );
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /demand-drivers/upsert
// Bulk operation for inserting/updating demand drivers
router.post('/upsert', async (req, res, next) => {
  try {
    const drivers = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    if (!Array.isArray(drivers) || drivers.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Payload must be an array of drivers' } });
    }

    // Begin bulk transaction
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      const upserted = [];
      for (const driver of drivers) {
        // We assume driver contains all necessary IDs (scenario_id, assumption_set_id, planning_period_id, etc.)
        const result = await client.query(
          `INSERT INTO demand_drivers 
           (tenant_id, scenario_id, assumption_set_id, planning_period_id, market_id, platform_id, product_family_id, base_orders, growth_rate_pct, seasonality_index, penetration_rate_pct, marketing_uplift_pct) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
           ON CONFLICT (tenant_id, scenario_id, assumption_set_id, planning_period_id, market_id, platform_id, product_family_id) 
           DO UPDATE SET 
              base_orders = EXCLUDED.base_orders,
              growth_rate_pct = EXCLUDED.growth_rate_pct,
              seasonality_index = EXCLUDED.seasonality_index,
              penetration_rate_pct = EXCLUDED.penetration_rate_pct,
              marketing_uplift_pct = EXCLUDED.marketing_uplift_pct,
              updated_at = NOW()
           RETURNING id`,
          [
            tenant_id, driver.scenario_id, driver.assumption_set_id, driver.planning_period_id, 
            driver.market_id, driver.platform_id, driver.product_family_id,
            driver.base_orders || 0, driver.growth_rate_pct || 0, driver.seasonality_index || 1, 
            driver.penetration_rate_pct || 0, driver.marketing_uplift_pct || 0
          ]
        );
        upserted.push(result.rows[0].id);
      }
      
      await client.query('COMMIT');
      res.status(200).json({ upserted: upserted.length, rows: upserted.map(id => ({ id, status: 'CREATED_OR_UPDATED' })) });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

export default router;
