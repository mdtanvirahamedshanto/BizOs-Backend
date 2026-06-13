import { Worker, type Job, type WorkerOptions } from 'bullmq';
import { bullConnection } from '@/config/bull';
import { createModuleLogger } from '@/config/logger';
import { env } from '@/env';

/**
 * Abstract base worker class.
 * All BullMQ workers extend this to get consistent:
 * - Structured logging with job context
 * - Error handling and reporting
 * - Graceful shutdown
 * - Tenant context injection
 */
export abstract class BaseWorker<TData = unknown, TResult = unknown> {
  protected worker: Worker;
  protected readonly log;

  constructor(
    queueName: string,
    options?: Partial<WorkerOptions>,
  ) {
    this.log = createModuleLogger(queueName);

    this.worker = new Worker<TData, TResult>(
      queueName,
      async (job: Job<TData, TResult>) => {
        this.log.info(
          { jobId: job.id, jobName: job.name, attempt: job.attemptsMade + 1 },
          'Processing job',
        );

        try {
          const result = await this.process(job);

          this.log.info(
            { jobId: job.id, jobName: job.name },
            'Job completed successfully',
          );

          return result;
        } catch (error) {
          this.log.error(
            { err: error, jobId: job.id, jobName: job.name, attempt: job.attemptsMade + 1 },
            'Job processing failed',
          );
          throw error; // Let BullMQ handle retries
        }
      },
      {
        connection: bullConnection as any,
        concurrency: env.WORKER_CONCURRENCY,
        ...options,
      },
    );

    // Worker lifecycle events
    this.worker.on('ready', () => {
      this.log.info('Worker ready and listening for jobs');
    });

    this.worker.on('failed', (job, error) => {
      this.log.error(
        { jobId: job?.id, err: error, attempts: job?.attemptsMade },
        'Job permanently failed',
      );
    });

    this.worker.on('error', (error) => {
      this.log.error({ err: error }, 'Worker error');
    });
  }

  /**
   * Process a single job. Must be implemented by subclasses.
   */
  protected abstract process(job: Job<TData, TResult>): Promise<TResult>;

  /**
   * Gracefully shut down the worker.
   */
  async close(): Promise<void> {
    this.log.info('Shutting down worker...');
    await this.worker.close();
    this.log.info('Worker shut down');
  }
}
