/**
 * Central queue name registry.
 * All BullMQ queue names are defined here to prevent typos
 * and enable compile-time checks.
 */
export const QUEUE_NAMES = {
  // Notification queues (by channel)
  NOTIFICATION_EMAIL: 'notification.email',
  NOTIFICATION_SMS: 'notification.sms',
  NOTIFICATION_PUSH: 'notification.push',

  // Business module queues
  REPORTING_GENERATE: 'reporting.generate',
  SALES_INVOICE: 'sales.invoice',
  INVENTORY_STOCK_ALERT: 'inventory.stockAlert',
  HR_PAYROLL: 'hr.payroll',

  // System queues
  AUDIT_LOG: 'audit.log',
  TENANT_ONBOARDING: 'tenant.onboarding',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
