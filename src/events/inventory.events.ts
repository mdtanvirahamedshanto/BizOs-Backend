import { eventBus } from '@/events/eventBus';
import type { LowStockEvent } from '@/events/eventTypes';

export const inventoryEvents = {
  lowStock(payload: LowStockEvent): void {
    eventBus.emit('inventory.lowStock', payload);
  },
};
