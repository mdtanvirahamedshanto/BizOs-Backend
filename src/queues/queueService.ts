import type { JobsOptions } from 'bullmq';
import { getQueue } from '@/config/bull';
import type { QueueName } from './queueRegistry';
import { logger } from '@/config/logger';

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

/**
 * Queue service — the public API for enqueuing jobs.
 * All modules use this service instead of accessing BullMQ directly.
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
    const job = await queue.add(jobName, data, {
      ...DEFAULT_JOB_OPTIONS,
      ...options,
    });

    logger.debug({ queue: queueName, jobName, jobId: job.id }, 'Job enqueued');

    return job.id;
  },

  /**
   * Enqueue a job with explicit priority (lower number = higher priority).
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
   */
  async enqueueUnique<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    uniqueId: string,
  ): Promise<string | undefined> {
    return this.enqueue(queueName, jobName, data, { jobId: uniqueId });
  },

  /**
   * Register a repeatable scheduled job (cron).
   */
  async scheduleRepeat<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    pattern: string,
    jobId: string,
  ): Promise<void> {
    const queue = getQueue(queueName);
    await queue.add(jobName, data, {
      ...DEFAULT_JOB_OPTIONS,
      repeat: { pattern },
      jobId,
    });
    logger.info({ queue: queueName, jobName, pattern }, 'Scheduled repeat job registered');
  },
};
