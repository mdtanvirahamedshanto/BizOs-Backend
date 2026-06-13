import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../../config/redis';
import { env } from '../../env';

/**
 * Global rate limiter using Redis sliding window.
 * Rate limit is per IP address by default.
 */
export const rateLimiter = rateLimit({
  store: new RedisStore({
    // Use ioredis sendCommand for rate-limit-redis compatibility
    sendCommand: (...args: string[]) =>
      redis.call(args[0]!, ...args.slice(1)) as never,
  }),
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,  // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,   // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  keyGenerator: (req) => {
    // Scope rate limiting by tenant + IP for authenticated requests
    return req.user?.tenantId
      ? `${req.user.tenantId}:${req.ip}`
      : req.ip || 'unknown';
  },
});

/**
 * Create a stricter rate limiter for sensitive endpoints.
 * Usage: router.post('/login', strictRateLimiter(5, 15 * 60 * 1000), controller.login);
 */
export function strictRateLimiter(maxRequests: number, windowMs: number) {
  return rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) =>
        redis.call(args[0]!, ...args.slice(1)) as never,
    }),
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many attempts, please try again later',
      },
    },
  });
}
