import { eventBus } from '@/events/eventBus';
import type { NotificationRequestedEvent } from '@/events/eventTypes';

export const notificationEvents = {
  requested(payload: NotificationRequestedEvent): void {
    eventBus.emit('notification.requested', payload);
  },
};
