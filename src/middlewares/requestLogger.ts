import type { Request, Response, NextFunction } from 'express';
import { logger } from '@/config/logger';

/**
 * Sanitizes sensitive fields from request body/query objects.
 */
function sanitize(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const sensitiveKeys = [
    'password',
    'confirmPassword',
    'currentPassword',
    'newPassword',
    'token',
    'refreshToken',
    'otp',
  ];

  const sanitized = { ...obj };
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }
  return sanitized;
}

/**
 * Middleware that logs HTTP requests, including method, url, status, duration, and IP,
 * while ensuring sensitive data (passwords, tokens) is redacted.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  // Handle logging once the response completes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl, ip, headers } = req;
    const statusCode = res.statusCode;
    const userAgent = headers['user-agent'] || 'unknown';
    const requestId = req.requestId; // Assuming requestId middleware has run

    const meta: Record<string, any> = {
      method,
      url: originalUrl,
      status: statusCode,
      duration: `${duration}ms`,
      ip,
      userAgent,
      requestId,
    };

    // Include sanitized request body/query if present
    if (req.body && Object.keys(req.body).length > 0) {
      meta.body = sanitize(req.body);
    }
    if (req.query && Object.keys(req.query).length > 0) {
      meta.query = sanitize(req.query);
    }

    // Determine log level based on status code
    if (statusCode >= 500) {
      logger.error(meta, `Request failed with server error: ${method} ${originalUrl}`);
    } else if (statusCode >= 400) {
      logger.warn(meta, `Request failed with client error: ${method} ${originalUrl}`);
    } else {
      logger.info(meta, `Request succeeded: ${method} ${originalUrl}`);
    }
  });

  next();
}
