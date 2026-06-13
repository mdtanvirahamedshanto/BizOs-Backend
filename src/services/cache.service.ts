import { redis } from '@/config/redis';
import { createModuleLogger } from '@/config/logger';

const log = createModuleLogger('cache');

/**
 * Redis cache-aside service.
 * Key format: bizos:{shopId}:{module}:{entity}:{id}
 */
export class CacheService {
  static buildKey(shopId: string, module: string, entity: string, id?: string): string {
    return id
      ? `bizos:${shopId}:${module}:${entity}:${id}`
      : `bizos:${shopId}:${module}:${entity}`;
  }

  static async get<T>(key: string): Promise<T | null> {
    const raw = await redis.get(key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      log.warn({ key }, 'Failed to parse cached value');
      await redis.del(key);
      return null;
    }
  }

  static async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  static async del(key: string): Promise<void> {
    await redis.del(key);
  }

  /**
   * Delete keys matching a pattern using SCAN (safe for production — avoids blocking KEYS).
   */
  static async invalidatePattern(pattern: string): Promise<number> {
    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        deleted += await redis.del(...keys);
      }
    } while (cursor !== '0');

    return deleted;
  }

  static async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    loader: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await loader();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}
