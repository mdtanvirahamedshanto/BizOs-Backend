import { z } from 'zod';

/**
 * Environment variable schema validation.
 * Validates and types all environment variables at startup.
 * Application crashes immediately if required vars are missing.
 */
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/api/v1'),
  APP_NAME: z.string().default('BizOS'),
  APP_URL: z.string().url().default('http://localhost:3000'),

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

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3001'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // File Storage
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_BUCKET: z.string().default('bizos-uploads'),
  STORAGE_REGION: z.string().default('us-east-1'),

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
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.format();
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(formatted, null, 2));
    process.exit(1);
  }

  return result.data;
}

/** Validated environment variables — safe to use throughout the application. */
export const env = validateEnv();
