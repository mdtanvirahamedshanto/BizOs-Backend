import { EventEmitter } from 'events';
import type { DomainEventMap, DomainEventName } from './eventTypes';
import { logger } from '@/config/logger';

/**
 * Typed in-process event bus.
 * Used for synchronous side effects within the same process:
 * - Audit logging
 * - Cache invalidation
 * - WebSocket broadcasting
 *
 * For async, durable operations (email, PDF generation), use BullMQ queues instead.
 */
class EventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50); // Prevent memory leak warnings
  }

  /**
   * Emit a typed domain event.
   * All registered handlers are called synchronously.
   * Handler errors are caught and logged — they never break the emitting flow.
   */
  emit<K extends DomainEventName>(event: K, payload: DomainEventMap[K]): void {
    try {
      this.emitter.emit(event, payload);
      logger.debug(
        { event, payload: payload as unknown as Record<string, unknown> },
        'Domain event emitted',
      );
    } catch (err) {
      logger.error(
        { event, payload: payload as unknown as Record<string, unknown>, error: err },
        'Failed to emit domain event',
      );
    }
  }

  /**
   * Register a handler for a domain event.
   * Handlers are wrapped in try-catch to prevent one handler's failure
   * from affecting others or the main business flow.
   */
  on<E extends DomainEventName>(
    event: E,
    handler: (payload: DomainEventMap[E]) => void | Promise<void>,
  ): void {
    this.emitter.on(event, async (payload: DomainEventMap[E]) => {
      try {
        await handler(payload);
      } catch (error) {
        logger.error(
          { err: error, event, shopId: (payload as unknown as Record<string, unknown>).shopId },
          'Event handler error (non-fatal)',
        );
      }
    });
  }

  /**
   * Remove all listeners for a specific event, or all events.
   */
  removeAllListeners(event?: DomainEventName): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }

  /**
   * Get the number of listeners for an event.
   */
  listenerCount(event: DomainEventName): number {
    return this.emitter.listenerCount(event);
  }
}

/** Singleton event bus instance */
export const eventBus = new EventBus();
