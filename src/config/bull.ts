import { Queue, type ConnectionOptions } from 'bullmq';
import { env } from '../env';
import { QUEUE_NAMES } from '../common/queues/queueRegistry';
import { logger } from './logger';

/**
 * BullMQ shared connection configuration.
 * All queues and workers use this connection config.
 */
export const bullConnection: ConnectionOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  db: env.REDIS_DB,
};

/**
 * Default queue options applied to all queues.
 */
const defaultQueueOptions = {
  defaultJobOptions: {
    removeOnComplete: { count: 1000 }, // Keep last 1000 completed jobs
    removeOnFail: { count: 5000 },     // Keep last 5000 failed jobs
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 2000, // Base delay: 2s → 4s → 8s
    },
  },
};

/**
 * Queue registry — lazily created queue instances.
 * Access queues via getQueue() helper.
 */
const queues = new Map<string, Queue>();

export function getQueue(name: string): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection: bullConnection,
      ...defaultQueueOptions,
    });
    queues.set(name, queue);
    logger.debug({ queue: name }, 'BullMQ queue initialized');
  }
  return queue;
}

/**
 * Initialize all registered queues at startup.
 * This ensures queues exist before any jobs are enqueued.
 */
export function initializeQueues(): void {
  for (const queueName of Object.values(QUEUE_NAMES)) {
    getQueue(queueName);
  }
  logger.info(
    { queueCount: Object.values(QUEUE_NAMES).length },
    'All BullMQ queues initialized',
  );
}

/**
 * Gracefully close all queue connections.
 */
export async function closeQueues(): Promise<void> {
  const closePromises = Array.from(queues.values()).map((q) => q.close());
  await Promise.all(closePromises);
  queues.clear();
  logger.info('All BullMQ queues closed');
}
