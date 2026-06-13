import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '@/utils/errors';

/**
 * Tenant context middleware.
 * Extracts tenantId from the authenticated user's JWT claims
 * and makes it available as req.tenantId for downstream use.
 *
 * This middleware MUST run after the authenticate middleware.
 *
 * Tenant isolation strategy:
 * - tenantId is derived from the JWT token (trusted source)
 * - All repository queries scope by this tenantId
 * - No user input can override the tenantId
 */
export function tenantContext(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.tenantId) {
    next(new UnauthorizedError('Tenant context not available. Authentication required.'));
    return;
  }

  req.tenantId = req.user.tenantId;
  next();
}
