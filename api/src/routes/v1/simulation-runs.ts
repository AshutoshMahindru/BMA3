import { Router } from 'express';
import { db } from '../../db';

const router = Router();

// GET /simulation-runs/:id/results
// Returns statistical summaries for a simulation run
router.get('/:id/results', async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    const result = await db.query(
      `SELECT * FROM monte_carlo_summaries WHERE run_id = $1 AND tenant_id = $2`,
      [id, tenant_id]
    );
    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /simulation-runs
// Triggers a new simulation run
router.post('/', async (req, res, next) => {
  try {
    const { scenario_id, simulator_type, iterations = 1000, input_params } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    if (!scenario_id || !simulator_type) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'scenario_id and simulator_type are required' } });
    }

    // 1. Create Run Record
    const runResult = await db.query(
      `INSERT INTO simulation_runs (tenant_id, scenario_id, simulator_type, name, input_params, status)
       VALUES ($1, $2, $3, $4, $5, 'completed') RETURNING id`,
      [tenant_id, scenario_id, simulator_type, `Run ${new Date().toISOString()}`, JSON.stringify(input_params || {})]
    );
    const run_id = runResult.rows[0].id;

    // 2. Mock / Execute Simulation Logic
    // In production, this would trigger BullMQ. For MVP, we insert seed-like statistical summaries.
    if (simulator_type === 'monte_carlo') {
      await db.query(
        `INSERT INTO monte_carlo_runs (id, tenant_id, scenario_id, iterations, status, completed_at)
         VALUES ($1, $2, $3, $4, 'completed', NOW())`,
        [run_id, tenant_id, scenario_id, iterations]
      );

      // Seed P10, P50, P90 for EBITDA
      await db.query(
        `INSERT INTO monte_carlo_summaries (tenant_id, run_id, metric_name, p10_value, p25_value, p50_value, p75_value, p90_value, mean_value, std_dev)
         VALUES 
         ($1, $2, 'EBITDA', 850000, 920000, 1050000, 1180000, 1300000, 1065000, 180000),
         ($1, $2, 'Net Revenue', 4200000, 4500000, 4800000, 5100000, 5500000, 4850000, 500000)`,
        [tenant_id, run_id]
      );
    } else if (simulator_type === 'sensitivity') {
       // Seed sensitivity matrix points
       await db.query(
        `INSERT INTO simulation_results (tenant_id, run_id, metric_name, metric_value)
         VALUES 
         ($1, $2, 'Base EBITDA', 1050000),
         ($1, $2, 'Shock EBITDA (-10% Price)', 820000),
         ($1, $2, 'Shock EBITDA (+10% Price)', 1280000)`,
        [tenant_id, run_id]
      );
    }

    res.json({ data: { run_id, status: 'completed' } });
  } catch (error) {
    next(error);
  }
});

export default router;
