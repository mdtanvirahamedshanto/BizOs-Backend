/**
 * Domain event type definitions.
 * Central registry of all events emitted across the BizOS system.
 *
 * Each event type has a strongly-typed payload interface.
 * Event names follow the format: "module.action" (e.g., "order.created")
 */

// ─── Auth Events ─────────────────────────────────

export interface UserRegisteredEvent {
  tenantId: string;
  userId: string;
  email: string;
}

export interface UserLoginEvent {
  tenantId: string;
  userId: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserLogoutEvent {
  tenantId: string;
  userId: string;
}

// ─── Tenant Events ───────────────────────────────

export interface TenantCreatedEvent {
  tenantId: string;
  name: string;
  slug: string;
  plan: string;
}

export interface TenantUpdatedEvent {
  tenantId: string;
  changes: Record<string, unknown>;
}

// ─── Inventory Events ────────────────────────────

export interface ProductCreatedEvent {
  tenantId: string;
  productId: string;
  name: string;
  sku: string;
}

export interface ProductUpdatedEvent {
  tenantId: string;
  productId: string;
  changes: Record<string, unknown>;
}

export interface LowStockEvent {
  tenantId: string;
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  threshold: number;
}

// ─── Sales Events ────────────────────────────────

export interface OrderCreatedEvent {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  customerId?: string;
  totalCents: number;
  currency: string;
}

export interface OrderCompletedEvent {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  totalCents: number;
}

export interface OrderCancelledEvent {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  reason?: string;
}

// ─── Finance Events ──────────────────────────────

export interface PaymentReceivedEvent {
  tenantId: string;
  paymentId: string;
  orderId?: string;
  amountCents: number;
  currency: string;
  method: string;
}

export interface InvoiceGeneratedEvent {
  tenantId: string;
  invoiceId: string;
  invoiceNumber: string;
  orderId?: string;
  totalCents: number;
}

// ─── HR Events ───────────────────────────────────

export interface EmployeeOnboardedEvent {
  tenantId: string;
  employeeId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

export interface PayrollProcessedEvent {
  tenantId: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  netPayCents: number;
}

// ─── CRM Events ──────────────────────────────────

export interface DealStageChangedEvent {
  tenantId: string;
  dealId: string;
  title: string;
  previousStage: string;
  newStage: string;
  valueCents?: number;
}

// ─── Notification Events ─────────────────────────

export interface NotificationRequestedEvent {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  channel: string;
  data?: Record<string, unknown>;
}

// ─── Report Events ───────────────────────────────

export interface ReportRequestedEvent {
  tenantId: string;
  userId: string;
  reportType: string;
  parameters: Record<string, unknown>;
}

// ─── Event Map ───────────────────────────────────
// Maps event names to their payload types for type-safe event handling.

export interface DomainEventMap {
  // Auth
  'user.registered': UserRegisteredEvent;
  'user.login': UserLoginEvent;
  'user.logout': UserLogoutEvent;

  // Tenant
  'tenant.created': TenantCreatedEvent;
  'tenant.updated': TenantUpdatedEvent;

  // Inventory
  'product.created': ProductCreatedEvent;
  'product.updated': ProductUpdatedEvent;
  'inventory.lowStock': LowStockEvent;

  // Sales
  'order.created': OrderCreatedEvent;
  'order.completed': OrderCompletedEvent;
  'order.cancelled': OrderCancelledEvent;

  // Finance
  'payment.received': PaymentReceivedEvent;
  'invoice.generated': InvoiceGeneratedEvent;

  // HR
  'employee.onboarded': EmployeeOnboardedEvent;
  'payroll.processed': PayrollProcessedEvent;

  // CRM
  'deal.stageChanged': DealStageChangedEvent;

  // Notification
  'notification.requested': NotificationRequestedEvent;

  // Reporting
  'report.requested': ReportRequestedEvent;
}

/** All valid event names */
export type DomainEventName = keyof DomainEventMap;
