import Redis from 'ioredis';
import { env } from '@/env';
import { logger } from './logger';

/**
 * Redis client singleton.
 * Used for caching, session storage, rate limiting, and Socket.IO adapter.
 */
export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  db: env.REDIS_DB,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: true,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 5000);
    logger.warn({ attempt: times, delay }, 'Redis connection retry');
    return delay;
  },
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
  return new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    db: env.REDIS_DB,
    maxRetriesPerRequest: null,
  });
}

export default redis;
