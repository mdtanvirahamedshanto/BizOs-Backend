import { prisma } from '@/prisma/client';
import { redis } from '@/config/redis';
import { closeAllQueues } from '@/config/bull';
import { logger } from '@/config/logger';
import { registerEventHandlers } from '@/events/eventHandlers';
import {
  EmailNotificationWorker,
  SmsNotificationWorker,
  PushNotificationWorker,
} from './notification.worker';
import { ReportGenerationWorker } from './reportGeneration.worker';
import { StockAlertWorker } from './stockAlert.worker';
import { registerScheduledJobs } from './scheduledJobs';
import type { BaseWorker } from '@/queues/baseWorker';

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  logger.info('Worker process connected to PostgreSQL');

  registerEventHandlers();

  const workers: BaseWorker[] = [
    new EmailNotificationWorker(),
    new SmsNotificationWorker(),
    new PushNotificationWorker(),
    new ReportGenerationWorker(),
    new StockAlertWorker(),
  ];

  await registerScheduledJobs();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down workers...`);

    for (const worker of workers) {
      await worker.close();
    }

    await closeAllQueues();
    await prisma.$disconnect();
    await redis.quit();

    logger.info('Worker process shut down gracefully');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.info({ workerCount: workers.length }, 'BizOS worker process started');
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start worker process');
  process.exit(1);
});
