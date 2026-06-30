import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, ConflictError, NotFoundError, ValidationError, DatabaseError } from '@/utils/errors';
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
  let activeError = err;

  // Map Prisma Database Errors to operational AppErrors
  if (activeError instanceof Prisma.PrismaClientKnownRequestError) {
    switch (activeError.code) {
      case 'P2002': {
        const targets = (activeError.meta?.target as string[]) || [];
        const targetField = targets.join(', ') || 'field';
        activeError = new ConflictError(`A record with this ${targetField} already exists`);
        break;
      }
      case 'P2025': {
        activeError = new NotFoundError('Requested record was not found');
        break;
      }
      case 'P2003': {
        activeError = new DatabaseError('Database reference constraint violation (foreign key failure)');
        break;
      }
      default: {
        activeError = new DatabaseError(`Database error: ${activeError.message} (${activeError.code})`);
        break;
      }
    }
  } else if (activeError instanceof Prisma.PrismaClientValidationError) {
    activeError = new ValidationError('Database validation failed (invalid data types or values)');
  } else if (
    activeError instanceof Prisma.PrismaClientInitializationError ||
    activeError instanceof Prisma.PrismaClientRustPanicError
  ) {
    logger.error(
      { err: activeError, requestId: req.requestId, path: req.path },
      'Prisma critical connection or runtime panic error',
    );
    // Keep as 500 internal error
  }

  // Handle known operational errors (including mapped database errors)
  if (activeError instanceof AppError) {
    if (activeError.statusCode >= 500) {
      logger.error(
        { err: activeError, requestId: req.requestId, path: req.path },
        'Internal application error',
      );
    } else {
      logger.warn(
        { code: activeError.code, message: activeError.message, requestId: req.requestId, path: req.path },
        'Client error',
      );
    }

    res.status(activeError.statusCode).json({
      success: false,
      error: {
        code: activeError.code,
        message: activeError.message,
        details: activeError.details,
        requestId: req.requestId,
      },
    });
    return;
  }

  // Handle unexpected errors
  logger.error(
    { 
      errMessage: activeError.message, 
      errStack: activeError.stack, 
      requestId: req.requestId, 
      path: req.path, 
      method: req.method 
    },
    'Unhandled error',
  );

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message:
        env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : activeError.message,
      requestId: req.requestId,
    },
  });
}
