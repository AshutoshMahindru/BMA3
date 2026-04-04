import os from 'os';
import { Worker } from 'bullmq';
import { db } from './db';
import { logger } from './lib/logger';
import {
  computeQueueName,
  createRedisConnection,
  setComputeWorkerHeartbeat,
  type ComputeQueueJob,
  type ComputeWorkerHeartbeat,
} from './lib/queue';
import { executeComputePipeline } from './compute/orchestrator';

const concurrency = Math.max(Number(process.env.COMPUTE_WORKER_CONCURRENCY || '1') || 1, 1);
const heartbeatIntervalMs = 5_000;
const workerId = `${os.hostname()}:${process.pid}`;
const activeRunIds = new Set<string>();

async function publishHeartbeat(status: ComputeWorkerHeartbeat['status']) {
  try {
    await setComputeWorkerHeartbeat({
      workerId,
      queue: computeQueueName,
      status,
      updatedAt: new Date().toISOString(),
      concurrency,
      activeJobs: activeRunIds.size,
      hostname: os.hostname(),
      pid: process.pid,
    });
  } catch (error) {
    logger.warn(
      {
        queue: computeQueueName,
        workerId,
        err: error,
      },
      'Failed to publish compute worker heartbeat',
    );
  }
}

async function syncRunQueueDiagnostics(runId: string, retryCount: number, lastFailureReason?: string | null) {
  try {
    const diagnostics = {
      retryCount: Math.max(retryCount, 0),
      workerHeartbeatAt: new Date().toISOString(),
      workerId,
      workerStatus: activeRunIds.size > 0 ? 'processing' : 'ready',
      ...(lastFailureReason !== undefined ? { lastFailureReason } : {}),
    };

    await db.query(
      `UPDATE compute_runs
          SET metadata = jsonb_set(
                COALESCE(metadata, '{}'::jsonb),
                '{queueDiagnostics}',
                COALESCE(metadata->'queueDiagnostics', '{}'::jsonb) || $2::jsonb,
                true
              ),
              updated_at = NOW()
        WHERE id = $1`,
      [runId, JSON.stringify(diagnostics)],
    );
  } catch (error) {
    logger.warn(
      {
        queue: computeQueueName,
        workerId,
        runId,
        err: error,
      },
      'Failed to persist compute queue diagnostics',
    );
  }
}

const worker = new Worker<ComputeQueueJob>(
  computeQueueName,
  async (job) => {
    activeRunIds.add(job.data.runId);
    await publishHeartbeat('processing');
    await syncRunQueueDiagnostics(job.data.runId, job.attemptsMade);

    logger.info(
      {
        jobId: job.id,
        runId: job.data.runId,
        companyId: job.data.companyId,
        scenarioId: job.data.scenarioId,
        versionId: job.data.versionId,
      },
      'Processing queued compute run',
    );

    try {
      await executeComputePipeline({
        tenant_id: job.data.tenantId,
        company_id: job.data.companyId,
        scenario_id: job.data.scenarioId,
        assumption_set_id: job.data.assumptionSetId,
        version_id: job.data.versionId,
        period_range: job.data.periodRange,
        run_id: job.data.runId,
      });

      await syncRunQueueDiagnostics(job.data.runId, job.attemptsMade);
    } catch (error) {
      const lastFailureReason = error instanceof Error ? error.message : String(error);
      await syncRunQueueDiagnostics(job.data.runId, job.attemptsMade + 1, lastFailureReason);
      throw error;
    } finally {
      activeRunIds.delete(job.data.runId);
      await publishHeartbeat(activeRunIds.size > 0 ? 'processing' : 'ready');
    }
  },
  {
    connection: createRedisConnection(),
    concurrency,
  },
);

worker.on('ready', () => {
  void publishHeartbeat('ready');
  logger.info({ queue: computeQueueName, concurrency }, 'Compute worker ready');
});

worker.on('completed', (job) => {
  logger.info({ queue: computeQueueName, jobId: job?.id }, 'Compute job completed');
});

worker.on('failed', (job, error) => {
  logger.error(
    {
      queue: computeQueueName,
      jobId: job?.id,
      runId: job?.data?.runId,
      err: error,
    },
    'Compute job failed',
  );
});

const heartbeatTimer = setInterval(() => {
  void publishHeartbeat(activeRunIds.size > 0 ? 'processing' : 'ready');
}, heartbeatIntervalMs);
heartbeatTimer.unref();

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down compute worker');
  clearInterval(heartbeatTimer);
  await publishHeartbeat('shutting_down');
  await worker.close();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
