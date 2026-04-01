import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /rollout-plans
router.get('/', async (req, res, next) => {
  try {
    const { scenario_id } = req.query;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';
    
    if (!scenario_id) {
      return res.status(400).json({ error: 'scenario_id is required' });
    }

    const plans = await db.query(
      'SELECT * FROM expansion_plans WHERE tenant_id = $1 AND scenario_id = $2',
      [tenant_id, scenario_id]
    );

    const planIds = plans.rows.map(p => p.id);
    let phases: any[] = [];
    
    if (planIds.length > 0) {
      const phasesResult = await db.query(
        'SELECT * FROM expansion_phases WHERE tenant_id = $1 AND expansion_plan_id = ANY($2)',
        [tenant_id, planIds]
      );
      phases = phasesResult.rows;
    }

    res.json({
      data: {
        plans: plans.rows,
        phases: phases
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /rollout-plans (Synchronized Bulk Upsert)
router.post('/', async (req, res, next) => {
  const client = await db.connect();
  try {
    const { scenario_id, plans } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    if (!scenario_id) {
      return res.status(400).json({ error: 'scenario_id is required' });
    }

    await client.query('BEGIN');

    // 1. Delete existing phases then plans for this scenario
    await client.query(
      `DELETE FROM expansion_phases 
       WHERE tenant_id = $1 AND expansion_plan_id IN (
         SELECT id FROM expansion_plans WHERE scenario_id = $2
       )`,
      [tenant_id, scenario_id]
    );
    await client.query(
      'DELETE FROM expansion_plans WHERE tenant_id = $1 AND scenario_id = $2',
      [tenant_id, scenario_id]
    );

    // 2. Insert new rollout plans and their nested phases
    if (Array.isArray(plans)) {
      for (const p of plans) {
        const planResult = await client.query(
          `INSERT INTO expansion_plans (tenant_id, scenario_id, plan_name, target_kitchen_count)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [tenant_id, scenario_id, p.plan_name, p.target_kitchen_count]
        );
        const planId = planResult.rows[0].id;

        if (Array.isArray(p.phases)) {
          for (const phase of p.phases) {
            await client.query(
              `INSERT INTO expansion_phases (tenant_id, expansion_plan_id, phase_number, phase_name, kitchen_target, capex_budget)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [tenant_id, planId, phase.phase_number, phase.phase_name, phase.kitchen_target, phase.capex_budget]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ status: 'success', message: 'Rollout plans synchronized successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

export default router;
