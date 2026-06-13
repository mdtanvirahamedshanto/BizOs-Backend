import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@/utils/errors';
import { generateToken } from '@/utils/crypto';
import { env } from '@/env';

// Cookie options for CSRF
export const csrfCookieOptions = {
  httpOnly: true, // Prevent client-side JS from reading cookie
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (aligns with refresh token expiration)
};

/**
 * Double-Submit Cookie CSRF Protection Middleware.
 * Compares the token in the 'X-CSRF-Token' header with the value in the '_csrf' cookie.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  const method = req.method;
  const skipMethods = ['GET', 'HEAD', 'OPTIONS'];

  // Skip CSRF validation for safe read-only methods
  if (skipMethods.includes(method)) {
    next();
    return;
  }

  // Stateless JWT clients (mobile, API integrations) do not use CSRF cookies
  if (req.headers.authorization?.startsWith('Bearer ')) {
    next();
    return;
  }

  const csrfCookie = req.cookies['_csrf'];
  const csrfHeader = req.headers['x-csrf-token'] as string;

  if (!csrfCookie || !csrfHeader) {
    next(new ForbiddenError('CSRF token verification failed: Missing token'));
    return;
  }

  if (csrfCookie !== csrfHeader) {
    next(new ForbiddenError('CSRF token verification failed: Token mismatch'));
    return;
  }

  next();
}

/**
 * Generates and sets a new CSRF token in a secure cookie.
 * Returns the token value for the client to store in memory and send in headers.
 */
export function setCsrfToken(res: Response): string {
  const token = generateToken(32);
  res.cookie('_csrf', token, csrfCookieOptions);
  return token;
}
