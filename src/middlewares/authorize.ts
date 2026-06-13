import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '@/utils/errors';

/**
 * Authorization middleware factory.
 * Creates a middleware that checks if the authenticated user has
 * the required permission(s) based on the RBAC model.
 *
 * Permission format: "resource.action" (e.g., "products.create")
 * Wildcard support:
 *   "*" matches any permission (SuperAdmin / Owner)
 *   "products.*" matches any action on products
 *
 * Usage:
 *   router.post('/products', authenticate, authorize('products.create'), controller.create);
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
 * Check if a granted permission matches a required permission using dot-separation.
 *
 * Examples:
 *   matchPermission('*', 'products.create')          → true (SuperAdmin / Owner)
 *   matchPermission('products.*', 'products.create')  → true
 *   matchPermission('products.create', 'products.create') → true
 *   matchPermission('products.create', 'products.delete') → false
 */
function matchPermission(granted: string, required: string): boolean {
  if (granted === '*') return true;
  if (granted === required) return true;

  const [grantedResource, grantedAction] = granted.split('.');
  const [requiredResource, requiredAction] = required.split('.');

  if (!grantedResource || !requiredResource) return false;

  const resourceMatch = grantedResource === '*' || grantedResource === requiredResource;
  const actionMatch = grantedAction === '*' || grantedAction === requiredAction;

  return resourceMatch && actionMatch;
}
