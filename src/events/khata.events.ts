import { eventBus } from '@/events/eventBus';
import type { KhataEntryAddedEvent } from '@/events/eventTypes';

export const khataEvents = {
  entryAdded(payload: KhataEntryAddedEvent): void {
    eventBus.emit('khata.entryAdded', payload);
  },
};
