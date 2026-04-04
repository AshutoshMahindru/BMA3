import { Queue, Worker, QueueEvents } from 'bullmq';
const IORedis = require('ioredis');
import { db } from '../db';
import { executeComputePipeline, ComputeContext } from '../compute/orchestrator';
import { v4 as uuidv4 } from 'uuid';

const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  retryStrategy(times: number) {
    return Math.min(times * 1000, 5000); // Wait up to 5s before reconnecting
  }
});

// Suppress unhandled infinite error spam
connection.on('error', () => {
  // Silent background reconnect
});

export const computeQueue = new Queue('compute', { connection });
export const computeQueueEvents = new QueueEvents('compute', { connection });

// Keep legacy queue alias so financial-projections route still works
export const projectionQueue = computeQueue;
export const projectionQueueEvents = computeQueueEvents;

export const computeWorker = new Worker(
  'compute',
  async (job) => {
    const { runId, companyId, scenarioId, versionId, tenantId } = job.data;

    // Build ComputeContext from job data. run_id may already exist (created by
    // the compute route when it inserted the 'queued' record); fall back to a
    // fresh UUID so the orchestrator can always create/update the row safely.
    const ctx: ComputeContext = {
      tenant_id: tenantId || companyId, // tenant_id is company_id for single-tenant setups
      company_id: companyId,
      scenario_id: scenarioId,
      assumption_set_id: job.data.assumptionSetId || '',
      version_id: versionId,
      period_range: job.data.periodRange || { start: '', end: '' },
      run_id: runId || uuidv4(),
    };

    try {
      await executeComputePipeline(ctx);
      return {
        status: 'COMPLETED',
        run_id: ctx.run_id,
      };
    } catch (err) {
      // executeComputePipeline already updates compute_runs to 'failed' internally,
      // but we also want to make sure the record is stamped in case of unexpected
      // errors before that DB update runs.
      const errorMessage = err instanceof Error ? err.message : String(err);
      try {
        await db.query(
          `UPDATE compute_runs
           SET status = 'failed',
               completed_at = NOW(),
               error_message = $1,
               updated_at = NOW()
           WHERE id = $2 AND status NOT IN ('completed', 'failed', 'cancelled')`,
          [errorMessage, ctx.run_id]
        );
      } catch (dbErr) {
        // DB update is best-effort; don't mask the original error
        console.error('[computeWorker] Failed to update compute_run status on error:', dbErr);
      }
      throw err;
    }
  },
  { connection }
);

computeWorker.on('completed', (job) => {
  console.log(`[computeWorker] Job ${job.id} completed. Run: ${job.data.runId}`);
});

computeWorker.on('failed', (job, err) => {
  console.error(`[computeWorker] Job ${job?.id} failed. Run: ${job?.data?.runId}. Error: ${err.message}`);
});
