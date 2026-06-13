import { queueService } from '@/queues/queueService';
import { QUEUE_NAMES } from '@/queues/queueRegistry';
import { createModuleLogger } from '@/config/logger';

const log = createModuleLogger('scheduled-jobs');

/**
 * Register repeatable BullMQ jobs for background automation.
 */
export async function registerScheduledJobs(): Promise<void> {
  await queueService.scheduleRepeat(
    QUEUE_NAMES.REPORTING_GENERATE,
    'scheduledDailyReports',
    { type: 'scheduledDailyReports' },
    '0 1 * * *',
    'scheduled-daily-reports',
  );

  log.info('Scheduled jobs registered');
}
