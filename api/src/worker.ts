import { Worker } from 'bullmq';
import { logger } from './lib/logger';
import { computeQueueName, createRedisConnection, type ComputeQueueJob } from './lib/queue';
import { executeComputePipeline } from './compute/orchestrator';

const concurrency = Math.max(Number(process.env.COMPUTE_WORKER_CONCURRENCY || '1') || 1, 1);

const worker = new Worker<ComputeQueueJob>(
  computeQueueName,
  async (job) => {
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

    await executeComputePipeline({
      tenant_id: job.data.tenantId,
      company_id: job.data.companyId,
      scenario_id: job.data.scenarioId,
      assumption_set_id: job.data.assumptionSetId,
      version_id: job.data.versionId,
      period_range: job.data.periodRange,
      run_id: job.data.runId,
    });
  },
  {
    connection: createRedisConnection(),
    concurrency,
  },
);

worker.on('ready', () => {
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

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down compute worker');
  await worker.close();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
