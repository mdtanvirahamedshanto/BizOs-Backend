import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors';

/**
 * Authorization middleware factory.
 * Creates a middleware that checks if the authenticated user has
 * the required permission(s) based on the RBAC model.
 *
 * Permission format: "module:resource:action"
 * Wildcard support: "finance:*:*" matches any finance permission
 *
 * Usage:
 *   router.get('/products', authenticate, authorize('inventory:product:read'), controller.list);
 *   router.delete('/products/:id', authenticate, authorize('inventory:product:delete'), controller.delete);
 */
export function authorize(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    const userPermissions = req.user.permissions;

    const hasPermission = requiredPermissions.every((required) =>
      userPermissions.some((granted) => matchPermission(granted, required)),
    );

    if (!hasPermission) {
      next(
        new ForbiddenError(
          `Missing required permission(s): ${requiredPermissions.join(', ')}`,
        ),
      );
      return;
    }

    next();
  };
}

/**
 * Check if a granted permission matches a required permission.
 * Supports wildcard (*) at each segment level.
 *
 * Examples:
 *   matchPermission('*:*:*', 'inventory:product:read')  → true (super admin)
 *   matchPermission('inventory:*:*', 'inventory:product:read') → true
 *   matchPermission('inventory:product:read', 'inventory:product:read') → true
 *   matchPermission('inventory:product:read', 'inventory:product:delete') → false
 */
function matchPermission(granted: string, required: string): boolean {
  const grantedParts = granted.split(':');
  const requiredParts = required.split(':');

  for (let i = 0; i < requiredParts.length; i++) {
    const grantedPart = grantedParts[i];
    const requiredPart = requiredParts[i];

    if (grantedPart === undefined) return false;
    if (grantedPart === '*') continue;
    if (grantedPart !== requiredPart) return false;
  }

  return true;
}
