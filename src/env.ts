import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Determine the current environment before loading .env file
const nodeEnv = process.env.NODE_ENV || 'development';

// Load environment-specific .env file (e.g., .env.development)
// Fallback to generic .env if specific file doesn't exist
dotenv.config({ path: path.resolve(process.cwd(), `.env.${nodeEnv}`) });
// Also load the default .env as a fallback for shared variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Environment variable schema validation.
 * Validates and types all environment variables at startup.
 * Application crashes immediately if required vars are missing.
 */
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/api/v1'),
  APP_NAME: z.string().default('BizOS'),
  APP_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:3001'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default(''),
  REDIS_DB: z.coerce.number().default(0),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900_000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // Request limits
  JSON_BODY_LIMIT: z.string().default('1mb'),

  // Workers
  WORKER_CONCURRENCY: z.coerce.number().min(1).max(50).default(5),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3001'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),

  // Uploads
  UPLOAD_MAX_FILE_SIZE_MB: z.coerce.number().min(1).max(50).default(5),



  // API Docs
  ENABLE_SWAGGER: z.coerce.boolean().optional(),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@bizos.app'),

  // SMS
  SMS_PROVIDER: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_API_SECRET: z.string().optional(),
  SMS_FROM_NUMBER: z.string().optional(),

  // Payment
  PAYMENT_PROVIDER: z.string().optional(),
  PAYMENT_SECRET_KEY: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().optional(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_LINK_TTL_SEC: z.coerce.number().default(900),

  // Platform super-admin (above-tenant access)
  // Comma-separated allowlist of emails permitted to use /api/v1/platform/*.
  // If empty, any user holding the '*' wildcard permission is allowed (dev-friendly).
  PLATFORM_ADMIN_EMAILS: z.string().default(''),

  // Database backups
  BACKUP_DIR: z.string().optional(), // defaults to <cwd>/backups
  PG_DUMP_PATH: z.string().default('pg_dump'), // override with absolute path on Windows if needed
  BACKUP_RETENTION_COUNT: z.coerce.number().min(1).max(365).default(30),
});

export type Env = z.infer<typeof envSchema> & {
  ENABLE_SWAGGER: boolean;
};

function assertProductionEnv(data: z.infer<typeof envSchema>): void {
  if (data.NODE_ENV !== 'production') {
    return;
  }

  const errors: string[] = [];

  if (data.JWT_ACCESS_SECRET.length < 32) {
    errors.push('JWT_ACCESS_SECRET must be at least 32 characters in production');
  }
  if (data.JWT_REFRESH_SECRET.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be at least 32 characters in production');
  }

  if (data.ENABLE_SWAGGER === true) {
    errors.push('ENABLE_SWAGGER must be false in production');
  }

  if (errors.length > 0) {
    console.error('❌ Production environment validation failed:');
    for (const message of errors) {
      console.error(`  - ${message}`);
    }
    process.exit(1);
  }
}

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(formatted, null, 2));
    process.exit(1);
  }

  const enableSwagger = result.data.ENABLE_SWAGGER ?? result.data.NODE_ENV !== 'production';
  const logLevel =
    result.data.LOG_LEVEL ?? (result.data.NODE_ENV === 'production' ? 'warn' : 'info');

  assertProductionEnv({ ...result.data, ENABLE_SWAGGER: enableSwagger });

  return {
    ...result.data,
    LOG_LEVEL: logLevel,
    ENABLE_SWAGGER: enableSwagger,
  };
}

/** Validated environment variables — safe to use throughout the application. */
export const env = validateEnv();
