import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@/utils/errors';
import { logger } from '@/config/logger';
import { env } from '@/env';

/**
 * Global error handler middleware.
 * Catches all errors and returns a consistent JSON error response.
 *
 * Must be registered LAST in the middleware pipeline.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Handle known operational errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(
        { err, requestId: req.requestId, path: req.path },
        'Internal application error',
      );
    } else {
      logger.warn(
        { code: err.code, message: err.message, requestId: req.requestId, path: req.path },
        'Client error',
      );
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId: req.requestId,
      },
    });
    return;
  }

  // Handle unexpected errors
  logger.error(
    { err, requestId: req.requestId, path: req.path, method: req.method },
    'Unhandled error',
  );

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : err.message,
      requestId: req.requestId,
    },
  });
}
