import { env } from '@/env';

/**
 * Production-oriented defaults and guardrails.
 */
export const productionConfig = {
  jsonBodyLimit: env.JSON_BODY_LIMIT,
  rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
  rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  enableSwagger: env.ENABLE_SWAGGER,
  logLevel: env.LOG_LEVEL,
  prismaLogLevels: env.NODE_ENV === 'production' ? (['error'] as const) : (['query', 'error', 'warn'] as const),
  redisMaxMemoryPolicy: 'allkeys-lru',
  uploadMaxFileSizeBytes: env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024,
  bullDefaultConcurrency: env.WORKER_CONCURRENCY,
} as const;
