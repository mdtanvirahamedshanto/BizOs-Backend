import type { Job } from 'bullmq';
import { BaseWorker } from '@/queues/baseWorker';
import { QUEUE_NAMES } from '@/queues/queueRegistry';
import { ReportsRepository } from '@/repositories/reports.repository';
import { ReportsService } from '@/services/reports.service';
import { RealtimeService } from '@/services/realtime.service';
import { prisma } from '@/prisma/client';
import { createModuleLogger } from '@/config/logger';

const log = createModuleLogger('report.worker');

export interface ReportJobData {
  shopId: string;
  userId: string;
  reportType: string;
  parameters: Record<string, unknown>;
}

export class ReportGenerationWorker extends BaseWorker<ReportJobData | { type: string }> {
  private reportsService: ReportsService;

  constructor() {
    super(QUEUE_NAMES.REPORTING_GENERATE, { concurrency: 2 });
    this.reportsService = new ReportsService(new ReportsRepository(prisma));
  }

  protected async process(
    job: Job<ReportJobData | { type: string }>,
  ): Promise<Record<string, unknown>> {
    if (job.name === 'scheduledDailyReports') {
      return this.processScheduledDailyReports();
    }

    const { shopId, userId, reportType, parameters } = job.data as ReportJobData;
    let result;

    switch (reportType) {
      case 'daily_sales':
        result = await this.reportsService.getDailySales(shopId, parameters as { startDate?: Date; endDate?: Date });
        break;
      case 'monthly_sales':
        result = await this.reportsService.getMonthlySales(shopId, parameters as { startDate?: Date; endDate?: Date });
        break;
      case 'profit':
        result = await this.reportsService.getProfitReport(shopId, parameters as { startDate?: Date; endDate?: Date });
        break;
      case 'inventory':
        result = await this.reportsService.getInventoryReport(shopId);
        break;
      case 'dues':
        result = await this.reportsService.getDueReport(shopId);
        break;
      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }

    await RealtimeService.pushNotification(shopId, userId, {
      type: 'report.completed',
      title: 'Report ready',
      body: `Your ${reportType} report has been generated.`,
      data: result.data as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    });
    await RealtimeService.refreshDashboard(shopId, 'report', reportType);

    return { reportType, generatedAt: new Date().toISOString() };
  }

  private async processScheduledDailyReports(): Promise<Record<string, unknown>> {
    const shops = await prisma.shop.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });

    log.info({ shopCount: shops.length }, 'Running scheduled daily profit reports');

    for (const shop of shops) {
      await this.reportsService.getProfitReport(shop.id, {});
      await RealtimeService.refreshDashboard(shop.id, 'scheduled-report', 'profit');
    }

    return { shopsProcessed: shops.length, generatedAt: new Date().toISOString() };
  }
}
