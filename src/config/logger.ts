import pino from 'pino';
import { env } from '../env';

/**
 * Structured logger using Pino.
 * Uses pretty printing in development, JSON in production.
 *
 * Usage:
 *   logger.info({ userId, action }, 'User performed action');
 *   logger.error({ err, orderId }, 'Failed to process order');
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    service: env.APP_NAME,
    env: env.NODE_ENV,
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  // Redact sensitive fields from logs
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash'],
    censor: '[REDACTED]',
  },
});

/**
 * Create a child logger scoped to a specific module.
 * Adds module context to every log line.
 *
 * Usage:
 *   const log = createModuleLogger('auth');
 *   log.info('Login attempt');
 *   // Output: { module: "auth", msg: "Login attempt", ... }
 */
export function createModuleLogger(module: string) {
  return logger.child({ module });
}

export default logger;
