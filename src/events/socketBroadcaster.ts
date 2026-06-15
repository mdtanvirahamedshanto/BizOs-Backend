import type { Server as SocketIOServer } from 'socket.io';
import { eventBus } from '@/events/eventBus';
import { RealtimeService } from '@/services/realtime.service';
import { createModuleLogger } from '@/config/logger';

const log = createModuleLogger('socket-broadcaster');

/**
 * Wire domain events to real-time broadcasts (in-process + Redis pub/sub).
 */
export function registerSocketBroadcaster(_io: SocketIOServer): void {
  RealtimeService.startSubscriber();

  eventBus.on('sale.created', (payload) => {
    void RealtimeService.refreshDashboard(payload.shopId, 'sale', payload.saleId);
  });

  eventBus.on('sale.completed', (payload) => {
    void RealtimeService.refreshDashboard(payload.shopId, 'sale', payload.saleId);
  });

  eventBus.on('payment.recorded', (payload) => {
    void RealtimeService.refreshDashboard(payload.shopId, 'payment', payload.paymentId);
  });

  eventBus.on('expense.created', (payload) => {
    void RealtimeService.refreshDashboard(payload.shopId, 'expense', payload.expenseId);
  });

  eventBus.on('khata.entryAdded', (payload) => {
    void RealtimeService.refreshDashboard(payload.shopId, 'khata', payload.khataAccountId);
  });

  eventBus.on('inventory.lowStock', (payload) => {
    void RealtimeService.refreshDashboard(payload.shopId, 'inventory', payload.productId);
  });

  eventBus.on('product.updated', (payload) => {
    void RealtimeService.refreshDashboard(payload.shopId, 'inventory', payload.productId);
  });

  eventBus.on('notification.requested', (payload) => {
    void RealtimeService.pushNotification(payload.shopId, payload.userId, {
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      timestamp: new Date().toISOString(),
    });
  });

  eventBus.on('report.completed', (payload) => {
    void RealtimeService.pushNotification(payload.shopId, payload.userId, {
      type: 'report.completed',
      title: 'Report ready',
      body: `Your ${payload.reportType} report has been generated.`,
      data: payload.data,
      timestamp: new Date().toISOString(),
    });
    void RealtimeService.refreshDashboard(payload.shopId, 'report', payload.reportType);
  });

  log.info('Socket broadcaster registered');
}
