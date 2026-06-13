import type { Response } from 'express';
import type { ServiceResult } from '../types/service';

/**
 * Standard API response builder.
 * Ensures all API responses follow the envelope format:
 * { success: boolean, data?: T, error?: {...}, meta?: {...} }
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>,
): void {
  res.status(statusCode).json({
    success: true,
    data,
    ...(meta && { meta }),
  });
}

/**
 * Send a service result as an API response.
 * Automatically determines the status code from the result.
 */
export function sendServiceResult<T>(
  res: Response,
  result: ServiceResult<T>,
  successStatusCode = 200,
): void {
  if (result.success) {
    res.status(successStatusCode).json({
      success: true,
      data: result.data,
      ...(result.meta && { meta: result.meta }),
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.error,
    });
  }
}

/**
 * Send a 201 Created response.
 */
export function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, 201);
}

/**
 * Send a 204 No Content response.
 */
export function sendNoContent(res: Response): void {
  res.status(204).send();
}
