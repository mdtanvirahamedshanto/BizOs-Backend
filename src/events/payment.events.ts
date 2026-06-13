import { eventBus } from '@/events/eventBus';
import type { PaymentRecordedEvent } from '@/events/eventTypes';

export const paymentEvents = {
  recorded(payload: PaymentRecordedEvent): void {
    eventBus.emit('payment.recorded', payload);
  },
};
