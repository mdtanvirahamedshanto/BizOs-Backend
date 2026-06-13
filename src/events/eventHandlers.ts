import { eventBus } from './eventBus';
import { logger } from '@/config/logger';
import { CacheService } from '@/services/cache.service';
import { queueService } from '@/queues/queueService';
import { QUEUE_NAMES } from '@/queues/queueRegistry';

function invalidateDashboardCache(shopId: string): Promise<number> {
  return CacheService.invalidatePattern(`bizos:${shopId}:reports:*`);
}

function invalidateProductCache(shopId: string, productId?: string): Promise<void> {
  if (productId) {
    return CacheService.del(CacheService.buildKey(shopId, 'inventory', 'product', productId));
  }
  return CacheService.invalidatePattern(`bizos:${shopId}:inventory:product:*`).then(() => undefined);
}

/**
 * Register all domain event subscribers.
 * Called once during application bootstrap.
 */
export function registerEventHandlers(): void {
  // ─── Auth Handlers ─────────────────────────────────────
  eventBus.on('user.registered', async (payload) => {
    logger.info({ shopId: payload.shopId, userId: payload.userId }, 'Handling user registered event');

    await queueService.enqueue(QUEUE_NAMES.NOTIFICATION_EMAIL, 'welcomeEmail', {
      shopId: payload.shopId,
      userId: payload.userId,
      to: payload.email,
      subject: 'Welcome to BizOS',
      body: 'Your shop account has been created successfully.',
      channel: 'email',
    });
  });

  eventBus.on('user.login', async (_payload) => {
    // Reserved for suspicious login alerts
  });

  // ─── Sales Handlers ────────────────────────────────────
  eventBus.on('sale.completed', async (payload) => {
    logger.info({ shopId: payload.shopId, saleId: payload.saleId }, 'Handling sale completed event');
    await invalidateDashboardCache(payload.shopId);
  });

  eventBus.on('sale.created', async (payload) => {
    await invalidateDashboardCache(payload.shopId);
  });

  // ─── Finance Handlers ──────────────────────────────────
  eventBus.on('payment.recorded', async (payload) => {
    await invalidateDashboardCache(payload.shopId);
  });

  eventBus.on('expense.created', async (payload) => {
    await invalidateDashboardCache(payload.shopId);
  });

  eventBus.on('khata.entryAdded', async (payload) => {
    await invalidateDashboardCache(payload.shopId);
  });

  // ─── Inventory Handlers ────────────────────────────────
  eventBus.on('inventory.lowStock', async (payload) => {
    logger.warn({ shopId: payload.shopId, productId: payload.productId }, 'Low stock alert');

    await queueService.enqueue(QUEUE_NAMES.INVENTORY_STOCK_ALERT, 'lowStockAlert', payload);
    await invalidateProductCache(payload.shopId, payload.productId);
  });

  eventBus.on('product.updated', async (payload) => {
    await invalidateProductCache(payload.shopId, payload.productId);
  });

  // ─── Notification Handlers ─────────────────────────────
  eventBus.on('notification.requested', async (payload) => {
    const queueName =
      payload.channel === 'sms'
        ? QUEUE_NAMES.NOTIFICATION_SMS
        : payload.channel === 'push'
          ? QUEUE_NAMES.NOTIFICATION_PUSH
          : QUEUE_NAMES.NOTIFICATION_EMAIL;

    await queueService.enqueue(queueName, payload.type, payload);
  });

  // ─── Report Handlers ───────────────────────────────────
  eventBus.on('report.requested', async (payload) => {
    await queueService.enqueue(QUEUE_NAMES.REPORTING_GENERATE, 'generateReport', payload);
  });

  logger.info('All event handlers registered');
}
