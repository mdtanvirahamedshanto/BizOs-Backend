import { eventBus } from '@/events/eventBus';
import type {
  SaleCreatedEvent,
  SaleCompletedEvent,
} from '@/events/eventTypes';

export const salesEvents = {
  created(payload: SaleCreatedEvent): void {
    eventBus.emit('sale.created', payload);
  },

  completed(payload: SaleCompletedEvent): void {
    eventBus.emit('sale.completed', payload);
  },
};
