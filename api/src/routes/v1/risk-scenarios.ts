import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /risk-scenarios?scenario_id=...
// Returns all risk objects joined with their scenario-specific estimates
router.get('/', async (req, res, next) => {
  try {
    const { scenario_id } = req.query;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    if (!scenario_id) {
      return res.status(400).json({ error: { code: 'MISSING_PARAM', message: 'scenario_id is required' } });
    }

    const query = `
      SELECT 
        ro.id as risk_id,
        ro.name,
        ro.category,
        ro.mitigation_plan,
        rs.id as scenario_risk_id,
        rs.scenario_id,
        COALESCE(rs.probability_pct, 
          CASE ro.likelihood 
            WHEN 'very_low' THEN 0.1 
            WHEN 'low' THEN 0.3 
            WHEN 'medium' THEN 0.5 
            WHEN 'high' THEN 0.7 
            WHEN 'very_high' THEN 0.9 
            ELSE 0.5 
          END
        ) as probability_pct,
        COALESCE(rs.financial_impact_estimate, 
          CASE ro.impact 
            WHEN 'negligible' THEN 50000 
            WHEN 'minor' THEN 150000 
            WHEN 'moderate' THEN 400000 
            WHEN 'major' THEN 1000000 
            WHEN 'critical' THEN 2500000 
            ELSE 0 
          END
        ) as financial_impact_estimate,
        rs.time_to_materialise_months,
        ro.likelihood as base_likelihood,
        ro.impact as base_impact
      FROM risk_objects ro
      LEFT JOIN risk_scenarios rs ON ro.id = rs.risk_object_id AND rs.scenario_id = $2
      WHERE ro.tenant_id = $1
    `;

    const result = await db.query(query, [tenant_id, scenario_id]);
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /risk-scenarios/upsert
router.post('/upsert', async (req, res, next) => {
  try {
    const { scenario_id, risks } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    if (!scenario_id || !Array.isArray(risks)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'scenario_id and risks array are required' } });
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      for (const risk of risks) {
        // 1. Ensure Risk Object exists or update it
        let riskObjectId = risk.risk_id;
        if (!riskObjectId) {
          const roResult = await client.query(
            `INSERT INTO risk_objects (tenant_id, name, category, likelihood, impact, mitigation_plan)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [tenant_id, risk.name, risk.category || 'operational', risk.likelihood || 'medium', risk.impact || 'moderate', risk.mitigation_plan]
          );
          riskObjectId = roResult.rows[0].id;
        } else {
           await client.query(
            `UPDATE risk_objects SET name = $1, category = $2, mitigation_plan = $3 WHERE id = $4 AND tenant_id = $5`,
            [risk.name, risk.category, risk.mitigation_plan, riskObjectId, tenant_id]
          );
        }

        // 2. Upsert Scenario-specific estimate
        await client.query(
          `INSERT INTO risk_scenarios (tenant_id, risk_object_id, scenario_id, probability_pct, financial_impact_estimate, time_to_materialise_months)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (tenant_id, risk_object_id, scenario_id) 
           DO UPDATE SET 
            probability_pct = EXCLUDED.probability_pct,
            financial_impact_estimate = EXCLUDED.financial_impact_estimate,
            time_to_materialise_months = EXCLUDED.time_to_materialise_months`,
          [tenant_id, riskObjectId, scenario_id, risk.probability_pct, risk.financial_impact_estimate, risk.time_to_materialise_months]
        );
      }

      await client.query('COMMIT');
      res.json({ status: 'SUCCESS', message: 'Risks updated successfully' });
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
