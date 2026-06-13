import type { CorsOptions } from 'cors';
import { env } from '../env';

/**
 * CORS configuration.
 * Origins are loaded from environment variables.
 */
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());

    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-Tenant-ID',
    'X-Idempotency-Key',
  ],
  exposedHeaders: ['X-Request-ID', 'X-Total-Count'],
  maxAge: 86400, // 24 hours preflight cache
};
