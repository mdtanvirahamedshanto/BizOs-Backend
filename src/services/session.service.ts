import { redis } from '@/config/redis';

export interface RefreshSessionData {
  userId: string;
  shopId: string;
}

/**
 * Redis-backed session storage for refresh tokens.
 * Complements PostgreSQL refresh token records for fast lookup and revocation.
 */
export class SessionService {
  private static refreshKey(refreshToken: string): string {
    return `session:refresh:${refreshToken}`;
  }

  private static userSessionsKey(userId: string): string {
    return `session:user:${userId}`;
  }

  private static blacklistKey(refreshToken: string): string {
    return `session:blacklist:${refreshToken}`;
  }

  static async storeRefreshSession(
    userId: string,
    shopId: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<void> {
    const ttlSeconds = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    const payload: RefreshSessionData = { userId, shopId };

    await redis.setex(this.refreshKey(refreshToken), ttlSeconds, JSON.stringify(payload));
    await redis.sadd(this.userSessionsKey(userId), refreshToken);
    await redis.expire(this.userSessionsKey(userId), ttlSeconds);
  }

  static async getRefreshSession(refreshToken: string): Promise<RefreshSessionData | null> {
    const raw = await redis.get(this.refreshKey(refreshToken));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as RefreshSessionData;
  }

  static async revokeRefreshSession(refreshToken: string, userId?: string): Promise<void> {
    await redis.del(this.refreshKey(refreshToken));

    if (userId) {
      await redis.srem(this.userSessionsKey(userId), refreshToken);
    }
  }

  static async revokeAllUserSessions(userId: string): Promise<void> {
    const tokens = await redis.smembers(this.userSessionsKey(userId));
    if (tokens.length === 0) {
      return;
    }

    const pipeline = redis.pipeline();
    for (const token of tokens) {
      pipeline.del(this.refreshKey(token));
    }
    pipeline.del(this.userSessionsKey(userId));
    await pipeline.exec();
  }

  static async isRefreshTokenBlacklisted(refreshToken: string): Promise<boolean> {
    const result = await redis.get(this.blacklistKey(refreshToken));
    return result !== null;
  }

  static async blacklistRefreshToken(refreshToken: string, ttlSeconds: number): Promise<void> {
    await redis.setex(this.blacklistKey(refreshToken), ttlSeconds, '1');
  }
}
