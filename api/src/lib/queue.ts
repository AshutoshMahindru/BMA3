import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const computeQueueName = 'compute-runs';

export type ComputeQueueJob = {
  runId: string;
  tenantId: string;
  companyId: string;
  scenarioId: string;
  versionId: string;
  assumptionSetId: string;
  periodRange: {
    start: string;
    end: string;
  };
};

let computeQueue: Queue<ComputeQueueJob> | null = null;

function redisUrl(): string {
  return process.env.REDIS_URL || 'redis://127.0.0.1:6379';
}

export function isAsyncComputeEnabled(): boolean {
  return (process.env.COMPUTE_EXECUTION_MODE || 'sync') === 'async_queue';
}

export function createRedisConnection() {
  return new IORedis(redisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export function getComputeQueue() {
  if (!computeQueue) {
    computeQueue = new Queue<ComputeQueueJob>(computeQueueName, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
      },
    });
  }

  return computeQueue;
}
