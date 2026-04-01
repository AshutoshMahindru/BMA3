import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /price-plans
router.get('/', async (req, res, next) => {
  try {
    const { scenario_id, product_family_id } = req.query;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';
    
    let query = 'SELECT * FROM price_plans WHERE tenant_id = $1 AND is_deleted = false';
    const params: any[] = [tenant_id];

    if (scenario_id) {
      params.push(scenario_id);
      query += ` AND scenario_id = $${params.length}`;
    }

    if (product_family_id) {
      params.push(product_family_id);
      query += ` AND product_family_id = $${params.length}`;
    }

    const result = await db.query(query, params);
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /price-plans
router.post('/', async (req, res, next) => {
  try {
    const { scenario_id, assumption_set_id, planning_period_id, product_family_id, list_price, discount_pct, net_realized_price, platform_markup_pct, promo_funding_pct } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    const result = await db.query(
      `INSERT INTO price_plans (tenant_id, scenario_id, assumption_set_id, planning_period_id, product_family_id, list_price, discount_pct, net_realized_price, platform_markup_pct, promo_funding_pct) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
       ON CONFLICT (tenant_id, scenario_id, assumption_set_id, planning_period_id, product_family_id)
       DO UPDATE SET
          list_price = EXCLUDED.list_price,
          discount_pct = EXCLUDED.discount_pct,
          net_realized_price = EXCLUDED.net_realized_price,
          platform_markup_pct = EXCLUDED.platform_markup_pct,
          promo_funding_pct = EXCLUDED.promo_funding_pct,
          updated_at = NOW()
       RETURNING *`,
      [tenant_id, scenario_id, assumption_set_id, planning_period_id, product_family_id, list_price, discount_pct || 0, net_realized_price, platform_markup_pct || 0, promo_funding_pct || 0]
    );

    const pricePlan = result.rows[0];
    res.status(201).json({
      id: pricePlan.id,
      net_realized_price: pricePlan.net_realized_price,
      effective_aov: pricePlan.net_realized_price // Simplified for API spec proxy
    });
  } catch (error) {
    next(error);
  }
});

export default router;
