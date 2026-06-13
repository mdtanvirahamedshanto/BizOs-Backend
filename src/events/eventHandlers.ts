import { eventBus } from './eventBus';
import { logger } from '@/config/logger';

/**
 * Register all domain event subscribers.
 * This should be called once during application bootstrap.
 */
export function registerEventHandlers(): void {
  // ─── Auth Handlers ─────────────────────────────────────
  eventBus.on('user.registered', async (payload) => {
    logger.info({ shopId: payload.shopId, userId: payload.userId }, 'Handling user registered event');
    // E.g., enqueue welcome email
  });

  eventBus.on('user.login', async (_payload) => {
    // E.g., send suspicious login alert if IP is new
  });

  // ─── Sales Handlers ────────────────────────────────────
  eventBus.on('sale.completed', async (payload) => {
    logger.info({ shopId: payload.shopId, saleId: payload.saleId }, 'Handling sale completed event');
    // E.g., update inventory, send invoice, notify telegram
  });

  // ─── Inventory Handlers ────────────────────────────────
  eventBus.on('inventory.lowStock', async (payload) => {
    logger.warn({ shopId: payload.shopId, productId: payload.productId }, 'Low stock alert');
    // E.g., send push notification / telegram message to owner
  });

  logger.info('All event handlers registered');
}
