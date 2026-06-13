import { eventBus } from './eventBus';
import { logger } from '../../config/logger';

/**
 * Register all cross-module event handlers.
 *
 * This is the ONLY place where modules react to each other's events.
 * Each handler delegates to the appropriate service — no business logic here.
 *
 * Called once at application startup from container.ts.
 */
export function registerEventHandlers(): void {
  const log = logger.child({ module: 'eventHandlers' });

  // ─── Audit: Log all significant events ───────────

  eventBus.on('user.registered', (payload) => {
    log.info({ event: 'user.registered', userId: payload.userId }, 'Audit: User registered');
    // TODO: auditService.log({ tenantId, action: 'user.registered', ... })
  });

  eventBus.on('user.login', (payload) => {
    log.info({ event: 'user.login', userId: payload.userId }, 'Audit: User login');
    // TODO: auditService.log(...)
  });

  eventBus.on('order.created', (payload) => {
    log.info(
      { event: 'order.created', orderId: payload.orderId, orderNumber: payload.orderNumber },
      'Audit: Order created',
    );
    // TODO: auditService.log(...)
  });

  eventBus.on('payment.received', (payload) => {
    log.info(
      { event: 'payment.received', paymentId: payload.paymentId },
      'Audit: Payment received',
    );
    // TODO: auditService.log(...)
  });

  // ─── Notifications: Trigger async notifications ──

  eventBus.on('order.created', (_payload) => {
    // TODO: queueService.enqueue(QUEUE_NAMES.NOTIFICATION_EMAIL, { ... })
  });

  eventBus.on('inventory.lowStock', (_payload) => {
    // TODO: queueService.enqueue(QUEUE_NAMES.INVENTORY_STOCK, { ... })
  });

  eventBus.on('employee.onboarded', (_payload) => {
    // TODO: queueService.enqueue(QUEUE_NAMES.NOTIFICATION_EMAIL, { ... })
  });

  // ─── Finance: React to sales events ──────────────

  eventBus.on('order.completed', (_payload) => {
    // TODO: financeService.createJournalEntry(...)
  });

  eventBus.on('payment.received', (_payload) => {
    // TODO: salesService.markOrderPaid(...)  (via event, not direct call — breaks circular dep)
  });

  // ─── Cache Invalidation ──────────────────────────

  eventBus.on('product.updated', (_payload) => {
    // TODO: cacheService.invalidate(`bizos:${tenantId}:inventory:product:${productId}`)
  });

  eventBus.on('tenant.updated', (_payload) => {
    // TODO: cacheService.invalidate(`bizos:${tenantId}:tenant:config`)
  });

  log.info('All event handlers registered');
}
