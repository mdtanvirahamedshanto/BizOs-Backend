import type { JobsOptions } from 'bullmq';
import { getQueue } from '../../config/bull';
import type { QueueName } from './queueRegistry';
import { logger } from '../../config/logger';

/**
 * Queue service — the public API for enqueuing jobs.
 * All modules use this service instead of accessing BullMQ directly.
 *
 * Usage:
 *   await queueService.enqueue('notification.email', 'sendWelcome', { to, subject, body });
 *   await queueService.enqueueWithPriority('notification.email', 'sendPasswordReset', data, 1);
 */
export const queueService = {
  /**
   * Enqueue a job to a named queue.
   */
  async enqueue<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    options?: JobsOptions,
  ): Promise<string | undefined> {
    const queue = getQueue(queueName);
    const job = await queue.add(jobName, data, options);

    logger.debug(
      { queue: queueName, jobName, jobId: job.id },
      'Job enqueued',
    );

    return job.id;
  },

  /**
   * Enqueue a job with explicit priority (lower number = higher priority).
   * Priority 1 = highest, 10 = lowest.
   */
  async enqueueWithPriority<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    priority: number,
  ): Promise<string | undefined> {
    return this.enqueue(queueName, jobName, data, { priority });
  },

  /**
   * Enqueue a job with a delay (in milliseconds).
   */
  async enqueueDelayed<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    delayMs: number,
  ): Promise<string | undefined> {
    return this.enqueue(queueName, jobName, data, { delay: delayMs });
  },

  /**
   * Enqueue a job with deduplication using a custom jobId.
   * If a job with the same ID exists, it won't be duplicated.
   */
  async enqueueUnique<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    uniqueId: string,
  ): Promise<string | undefined> {
    return this.enqueue(queueName, jobName, data, { jobId: uniqueId });
  },
};
