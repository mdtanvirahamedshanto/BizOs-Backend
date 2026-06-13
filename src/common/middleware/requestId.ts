import type { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';

/**
 * Request ID middleware.
 * Attaches a unique correlation ID to every request for tracing.
 * Uses client-provided X-Request-ID if present, otherwise generates one.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || nanoid(21);
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}
