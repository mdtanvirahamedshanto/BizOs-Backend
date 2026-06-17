import type { Request, Response, NextFunction } from 'express';
import { env } from '@/env';
import { ForbiddenError, UnauthorizedError } from '@/utils/errors';

/**
 * Platform super-admin guard (above-tenant).
 *
 * Unlike the shop RBAC (`authorize`), this gates the cross-tenant platform
 * control plane (`/api/v1/platform/*`): system health, platform-wide usage
 * stats, and database backups. It MUST run after `authenticate` and instead of
 * `tenantContext` (these endpoints intentionally span all shops).
 *
 * Access rule:
 *  - If `PLATFORM_ADMIN_EMAILS` is configured, the user's email must be in it.
 *  - If it is empty (e.g. local/dev), any user holding the `*` wildcard
 *    permission (shop Owner/SuperAdmin) is allowed so the panel works out of
 *    the box. Configure the allowlist in production to lock this down.
 */
export function isPlatformAdmin(
  email: string | undefined,
  permissions: string[] | undefined,
): boolean {
  const allowlist = (env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (allowlist.length > 0) {
    return !!email && allowlist.includes(email.toLowerCase());
  }

  return Array.isArray(permissions) && permissions.includes('*');
}

export function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction): void {
  const user = req.user;
  if (!user) {
    next(new UnauthorizedError('Authentication required'));
    return;
  }

  if (!isPlatformAdmin(user.email, user.permissions)) {
    next(new ForbiddenError('Platform administrator access required'));
    return;
  }

  next();
}
