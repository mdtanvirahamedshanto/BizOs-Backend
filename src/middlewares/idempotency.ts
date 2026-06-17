import type { Request, Response, NextFunction } from 'express';
import { redis } from '@/config/redis';
import { logger } from '@/config/logger';

/**
 * Idempotency middleware (Stripe-style), backed by Redis.
 *
 * Clients (especially the offline-first mobile app) send a stable
 * `X-Idempotency-Key` header on mutating requests. The same logical operation
 * carries the same key on every retry, so a request that timed out after the
 * server already committed it will NOT be processed twice — the cached response
 * is replayed instead. This is what prevents duplicate sales / cash entries /
 * stock adjustments when the network drops mid-request and the outbox retries.
 *
 * Behaviour:
 * - No key  -> pass through (idempotency is opt-in per request).
 * - First time for a key -> acquire a short-lived lock, run the handler, then
 *   cache the response body for successful (2xx) responses.
 * - Repeat with completed key -> replay the stored status + body.
 * - Repeat while still in-flight -> 409 (client should retry shortly).
 * - Non-2xx response -> the key is released so the client can retry cleanly.
 * - Redis unavailable -> fail OPEN (process the request normally). Availability
 *   is more important than the (rare) duplicate-on-double-fault edge case.
 *
 * Must run AFTER `authenticate` + `tenantContext` so the key is namespaced per
 * shop, and AFTER `validate` so malformed requests are never cached.
 */

const HEADER = 'x-idempotency-key';
/** How long a completed response is replayable. */
const RESULT_TTL_SECONDS = 24 * 60 * 60;
/** Lock lifetime while a request is in flight (auto-expires if the server dies). */
const LOCK_TTL_SECONDS = 120;

const IN_PROGRESS = '__in_progress__';

interface CachedResponse {
  status: 'completed';
  statusCode: number;
  body: unknown;
}

export function idempotency() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const rawKey = req.header(HEADER);
    if (!rawKey || typeof rawKey !== 'string') {
      next();
      return;
    }

    const key = rawKey.trim().slice(0, 200);
    if (!key) {
      next();
      return;
    }

    const shopId = req.shopId || req.tenantId || 'public';
    const redisKey = `idem:${shopId}:${key}`;

    let acquiredLock = false;
    try {
      // Atomically claim the key. NX => only set if it does not already exist.
      const acquired = await redis.set(redisKey, IN_PROGRESS, 'EX', LOCK_TTL_SECONDS, 'NX');

      if (acquired !== 'OK') {
        // Key already exists: either completed (replay) or still in flight (409).
        const existing = await redis.get(redisKey);
        if (existing && existing !== IN_PROGRESS) {
          try {
            const cached = JSON.parse(existing) as CachedResponse;
            res.setHeader('X-Idempotent-Replay', 'true');
            res.status(cached.statusCode).json(cached.body);
            return;
          } catch {
            // Corrupted cache entry — fall through and process normally.
          }
        }
        res.status(409).json({
          success: false,
          error: {
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'A request with this idempotency key is already being processed.',
            requestId: req.requestId,
          },
        });
        return;
      }

      acquiredLock = true;
    } catch (err) {
      // Redis problem -> fail open so the API stays available.
      logger.warn({ err, redisKey }, 'Idempotency check skipped (Redis unavailable)');
      next();
      return;
    }

    // We hold the lock. Intercept the response so we can cache successful results.
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const statusCode = res.statusCode;
      if (statusCode >= 200 && statusCode < 300) {
        const payload: CachedResponse = { status: 'completed', statusCode, body };
        redis
          .set(redisKey, JSON.stringify(payload), 'EX', RESULT_TTL_SECONDS)
          .catch((err) => logger.warn({ err, redisKey }, 'Failed to persist idempotent response'));
      } else if (acquiredLock) {
        // Release the lock so the client can retry a failed request.
        redis.del(redisKey).catch(() => undefined);
      }
      return originalJson(body);
    }) as Response['json'];

    next();
  };
}
