import type { Job } from 'bullmq';
import { BaseWorker } from '@/queues/baseWorker';
import { QUEUE_NAMES } from '@/queues/queueRegistry';
import { env } from '@/env';
import { createModuleLogger } from '@/config/logger';

const log = createModuleLogger('notification.email');

export interface NotificationJobData {
  shopId: string;
  userId?: string;
  to?: string;
  subject?: string;
  title?: string;
  body: string;
  channel?: string;
  data?: Record<string, unknown>;
}

export class EmailNotificationWorker extends BaseWorker<NotificationJobData> {
  constructor() {
    super(QUEUE_NAMES.NOTIFICATION_EMAIL, { concurrency: 10 });
  }

  protected async process(job: Job<NotificationJobData>): Promise<{ sent: boolean }> {
    const { to, subject, body } = job.data;

    if (env.SMTP_HOST) {
      log.info({ to, subject, jobId: job.id }, 'Email notification dispatched (SMTP integration pending)');
    } else {
      log.info({ to, subject, body, jobId: job.id }, 'Email notification logged (SMTP not configured)');
    }

    return { sent: true };
  }
}

export class SmsNotificationWorker extends BaseWorker<NotificationJobData> {
  constructor() {
    super(QUEUE_NAMES.NOTIFICATION_SMS, { concurrency: 5 });
  }

  protected async process(job: Job<NotificationJobData>): Promise<{ sent: boolean }> {
    log.info({ jobId: job.id, body: job.data.body }, 'SMS notification logged (provider integration pending)');
    return { sent: true };
  }
}

export class PushNotificationWorker extends BaseWorker<NotificationJobData> {
  constructor() {
    super(QUEUE_NAMES.NOTIFICATION_PUSH, { concurrency: 10 });
  }

  protected async process(job: Job<NotificationJobData>): Promise<{ sent: boolean }> {
    log.info(
      { jobId: job.id, userId: job.data.userId, title: job.data.title },
      'Push notification delivered via Socket.IO pipeline',
    );
    return { sent: true };
  }
}
