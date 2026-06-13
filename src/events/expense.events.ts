import { eventBus } from '@/events/eventBus';
import type { ExpenseCreatedEvent } from '@/events/eventTypes';

export const expenseEvents = {
  created(payload: ExpenseCreatedEvent): void {
    eventBus.emit('expense.created', payload);
  },
};
