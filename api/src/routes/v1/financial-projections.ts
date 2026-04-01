import { Router } from 'express';
import { db } from '../../db';
import { projectionQueue } from '../../jobs';

const router = Router();

// POST /financial-projections/compute
router.post('/compute', async (req, res, next) => {
  try {
    const { scenario_id, assumption_set_id, period_range_start, period_range_end, scope } = req.body;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';

    // Add job to BullMQ
    const job = await projectionQueue.add('Calculate Financial Projections', {
      tenant_id,
      scenario_id,
      assumption_set_id,
      period_range_start,
      period_range_end,
      scope
    });

    res.status(200).json({
      job_id: job.id,
      status: 'QUEUED',
      estimated_completion_seconds: 45
    });
  } catch (error) {
    next(error);
  }
});

// GET /jobs/:id
router.get('/jobs/:id', async (req, res, next) => {
  try {
    const job = await projectionQueue.getJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Job not found' } });
    }
    const state = await job.getState();
    const progress = job.progress;
    
    if (state === 'completed') {
      return res.json({
        status: 'COMPLETED',
        result_url: `/api/v1/financial-projections/pnl?scenario_id=${job.data.scenario_id}`
      });
    }

    res.json({ status: state?.toUpperCase(), progress_pct: progress });
  } catch (error) {
    next(error);
  }
});

// GET /financial-projections/pnl
router.get('/pnl', async (req, res, next) => {
  try {
    const { scenario_id } = req.query;
    const tenant_id = req.headers['x-tenant-id'] || 'tttttttt-0000-0000-0000-000000000001';
    
    let query = 'SELECT * FROM pnl_projections WHERE tenant_id = $1 AND is_deleted = false';
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
