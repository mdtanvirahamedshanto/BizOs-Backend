import Redis from 'ioredis';
import { env } from '@/env';
import { logger } from './logger';

/**
 * Redis client singleton.
 * Used for caching, session storage, rate limiting, and Socket.IO adapter.
 */
const redisOptions = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 5000);
    logger.warn({ attempt: times, delay }, 'Redis connection retry');
    return delay;
  },
};

export const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      ...redisOptions,
      // For Upstash 'rediss://' URLs we usually don't need additional config,
      // but family: 0 ensures we resolve IPv4/IPv6 automatically
      family: 0
    })
  : new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      db: env.REDIS_DB,
      ...redisOptions,
    });

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

/**
 * Create a duplicate Redis connection.
 * Required for Socket.IO adapter (needs separate pub/sub connections)
 * and for BullMQ (needs separate connections per worker).
 */
export function createRedisConnection(): Redis {
  return env.REDIS_URL
    ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, family: 0 })
    : new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        db: env.REDIS_DB,
        maxRetriesPerRequest: null,
      });
}

export default redis;
