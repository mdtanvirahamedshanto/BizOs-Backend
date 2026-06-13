import { eventBus } from '@/events/eventBus';
import type {
  ReportRequestedEvent,
  ReportCompletedEvent,
} from '@/events/eventTypes';

export const reportEvents = {
  requested(payload: ReportRequestedEvent): void {
    eventBus.emit('report.requested', payload);
  },

  completed(payload: ReportCompletedEvent): void {
    eventBus.emit('report.completed', payload);
  },
};
