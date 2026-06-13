import type { Job } from 'bullmq';
import { BaseWorker } from '@/queues/baseWorker';
import { QUEUE_NAMES } from '@/queues/queueRegistry';
import { RealtimeService } from '@/services/realtime.service';
import type { LowStockEvent } from '@/events/eventTypes';

export class StockAlertWorker extends BaseWorker<LowStockEvent> {
  constructor() {
    super(QUEUE_NAMES.INVENTORY_STOCK_ALERT, { concurrency: 3 });
  }

  protected async process(job: Job<LowStockEvent>): Promise<{ alerted: boolean }> {
    const payload = job.data;

    await RealtimeService.pushNotification(payload.shopId, 'broadcast', {
      type: 'inventory.lowStock',
      title: 'Low stock alert',
      body: `${payload.productName} (${payload.sku}) is low: ${payload.currentStock} remaining (threshold: ${payload.threshold})`,
      data: payload,
      timestamp: new Date().toISOString(),
    });

    return { alerted: true };
  }
}
