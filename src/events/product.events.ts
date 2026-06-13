import { eventBus } from '@/events/eventBus';
import type { ProductUpdatedEvent } from '@/events/eventTypes';

export const productEvents = {
  updated(payload: ProductUpdatedEvent): void {
    eventBus.emit('product.updated', payload);
  },
};
