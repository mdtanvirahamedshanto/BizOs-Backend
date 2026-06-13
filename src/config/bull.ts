import { Queue, Worker, QueueEvents } from 'bullmq';

import type { QueueName } from '@/queues/queueRegistry';
import { logger } from '@/config/logger';
import { createRedisConnection } from './redis';

const queues = new Map<QueueName, Queue>();
const workers = new Map<QueueName, Worker>();
const queueEvents = new Map<QueueName, QueueEvents>();

export const bullConnection = createRedisConnection();

/**
 * Get or initialize a BullMQ Queue.
 */
export function getQueue(name: QueueName): Queue {
  if (!queues.has(name)) {
    const queue = new Queue(name, { connection: bullConnection as any });
    queues.set(name, queue);
    logger.info({ queue: name }, 'Queue initialized');
  }
  return queues.get(name)!;
}

/**
 * Register a worker for a queue.
 */
export function registerWorker(
  name: QueueName,
  processor: (job: any) => Promise<any>,
  concurrency = 5,
): Worker {
  if (workers.has(name)) {
    logger.warn({ queue: name }, 'Worker already registered for queue');
    return workers.get(name)!;
  }

  const worker = new Worker(name, processor, {
    connection: bullConnection as any,
    concurrency,
  });

  worker.on('completed', (job) => {
    logger.debug({ queue: name, jobId: job.id }, 'Job completed successfully');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { queue: name, jobId: job?.id, error: err instanceof Error ? err.message : String(err) },
      'Job failed',
    );
  });

  workers.set(name, worker);
  logger.info({ queue: name, concurrency }, 'Worker registered');

  return worker;
}

/**
 * Gracefully close all queues and workers.
 */
export async function closeAllQueues(): Promise<void> {
  const promises: Promise<void>[] = [];

  for (const worker of workers.values()) {
    promises.push(worker.close());
  }

  for (const queue of queues.values()) {
    promises.push(queue.close());
  }

  for (const events of queueEvents.values()) {
    promises.push(events.close());
  }

  await Promise.all(promises);
  logger.info('All queues and workers closed gracefully');
}
