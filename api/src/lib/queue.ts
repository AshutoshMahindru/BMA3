import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const computeQueueName = 'compute-runs';
const computeWorkerHeartbeatKey = `${computeQueueName}:worker-heartbeat`;
const computeWorkerHeartbeatTtlSeconds = 30;

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

export type ComputeWorkerHeartbeat = {
  workerId: string;
  queue: string;
  status: 'starting' | 'ready' | 'processing' | 'shutting_down';
  updatedAt: string;
  concurrency: number;
  activeJobs: number;
  hostname: string;
  pid: number;
};

let computeQueue: Queue<ComputeQueueJob> | null = null;

function redisUrl(): string {
  return process.env.REDIS_URL || 'redis://127.0.0.1:6379';
}

export function isAsyncComputeEnabled(): boolean {
  return (process.env.COMPUTE_EXECUTION_MODE || 'sync') === 'async_queue';
}

export function createRedisConnection() {
  const connection = new IORedis(redisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  connection.on('error', () => undefined);

  return connection;
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

async function withRedisConnection<T>(fn: (connection: IORedis) => Promise<T>): Promise<T> {
  const connection = createRedisConnection();

  try {
    return await fn(connection);
  } finally {
    connection.disconnect();
  }
}

export async function setComputeWorkerHeartbeat(heartbeat: ComputeWorkerHeartbeat): Promise<void> {
  if (!isAsyncComputeEnabled()) {
    return;
  }

  await withRedisConnection(async (connection) => {
    await connection.set(
      computeWorkerHeartbeatKey,
      JSON.stringify(heartbeat),
      'EX',
      computeWorkerHeartbeatTtlSeconds,
    );
  });
}

export async function getComputeWorkerHeartbeat(): Promise<ComputeWorkerHeartbeat | null> {
  if (!isAsyncComputeEnabled()) {
    return null;
  }

  try {
    const raw = await withRedisConnection((connection) => connection.get(computeWorkerHeartbeatKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<ComputeWorkerHeartbeat>;
    if (
      typeof parsed.workerId !== 'string' ||
      typeof parsed.queue !== 'string' ||
      typeof parsed.status !== 'string' ||
      typeof parsed.updatedAt !== 'string' ||
      typeof parsed.concurrency !== 'number' ||
      typeof parsed.activeJobs !== 'number' ||
      typeof parsed.hostname !== 'string' ||
      typeof parsed.pid !== 'number'
    ) {
      return null;
    }

    return {
      workerId: parsed.workerId,
      queue: parsed.queue,
      status: parsed.status,
      updatedAt: parsed.updatedAt,
      concurrency: parsed.concurrency,
      activeJobs: parsed.activeJobs,
      hostname: parsed.hostname,
      pid: parsed.pid,
    };
  } catch {
    return null;
  }
}
