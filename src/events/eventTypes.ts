/**
 * Domain event type definitions.
 * Central registry of all events emitted across the BizOS system.
 *
 * Each event type has a strongly-typed payload interface.
 * Event names follow the format: "module.action" (e.g., "sale.created")
 */

// ─── Auth Events ─────────────────────────────────

export interface UserRegisteredEvent {
  shopId: string;
  userId: string;
  email: string;
}

export interface UserLoginEvent {
  shopId: string;
  userId: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserLogoutEvent {
  shopId: string;
  userId: string;
}

// ─── Shop Events ───────────────────────────────

export interface ShopCreatedEvent {
  shopId: string;
  name: string;
  slug: string;
  plan: string;
}

export interface ShopUpdatedEvent {
  shopId: string;
  changes: Record<string, unknown>;
}

// ─── Inventory Events ────────────────────────────

export interface ProductCreatedEvent {
  shopId: string;
  productId: string;
  name: string;
  sku: string;
}

export interface ProductUpdatedEvent {
  shopId: string;
  productId: string;
  changes: Record<string, unknown>;
}

export interface LowStockEvent {
  shopId: string;
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  threshold: number;
}

// ─── Sales Events ────────────────────────────────

export interface SaleCreatedEvent {
  shopId: string;
  saleId: string;
  invoiceNumber: string;
  customerId?: string;
  totalCents: number;
}

export interface SaleCompletedEvent {
  shopId: string;
  saleId: string;
  invoiceNumber: string;
  totalCents: number;
}

// ─── Purchase Events ──────────────────────────────

export interface PurchaseCreatedEvent {
  shopId: string;
  purchaseId: string;
  referenceNumber: string;
  supplierId?: string;
  totalCents: number;
}

// ─── Khata Events ────────────────────────────────

export interface KhataEntryAddedEvent {
  shopId: string;
  khataAccountId: string;
  entryId: string;
  amountCents: number;
  type: string;
}

// ─── Notification Events ─────────────────────────

export interface NotificationRequestedEvent {
  shopId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  channel: string;
  data?: Record<string, unknown>;
}

// ─── Report Events ───────────────────────────────

export interface ReportRequestedEvent {
  shopId: string;
  userId: string;
  reportType: string;
  parameters: Record<string, unknown>;
}

export interface ReportCompletedEvent {
  shopId: string;
  userId: string;
  reportType: string;
  data?: Record<string, unknown>;
}

export interface PaymentRecordedEvent {
  shopId: string;
  paymentId: string;
  type: string;
  amountCents: number;
}

export interface ExpenseCreatedEvent {
  shopId: string;
  expenseId: string;
  amountCents: number;
  title: string;
}

// ─── Event Map ───────────────────────────────────
// Maps event names to their payload types for type-safe event handling.

export interface DomainEventMap {
  // Auth
  'user.registered': UserRegisteredEvent;
  'user.login': UserLoginEvent;
  'user.logout': UserLogoutEvent;

  // Shop
  'shop.created': ShopCreatedEvent;
  'shop.updated': ShopUpdatedEvent;

  // Inventory
  'product.created': ProductCreatedEvent;
  'product.updated': ProductUpdatedEvent;
  'inventory.lowStock': LowStockEvent;

  // Sales
  'sale.created': SaleCreatedEvent;
  'sale.completed': SaleCompletedEvent;

  // Purchases
  'purchase.created': PurchaseCreatedEvent;

  // Khata
  'khata.entryAdded': KhataEntryAddedEvent;

  // Finance
  'payment.recorded': PaymentRecordedEvent;
  'expense.created': ExpenseCreatedEvent;

  // Notification
  'notification.requested': NotificationRequestedEvent;

  // Reporting
  'report.requested': ReportRequestedEvent;
  'report.completed': ReportCompletedEvent;
}

/** All valid event names */
export type DomainEventName = keyof DomainEventMap;
