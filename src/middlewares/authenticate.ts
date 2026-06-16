import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/env';
import { UnauthorizedError } from '@/utils/errors';

/**
 * Authentication middleware.
 * Verifies JWT access token from Authorization header.
 * Populates req.user with decoded token payload.
 *
 * Header format: Authorization: Bearer <token>
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new UnauthorizedError('Missing or invalid authorization token');
    }

    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as any;
    const shopId = decoded.shopId || decoded.tenantId;

    req.user = {
      id: decoded.sub,
      tenantId: shopId,
      shopId: shopId,
      email: decoded.email,
      permissions: decoded.permissions,
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Access token expired'));
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid access token'));
      return;
    }
    next(new UnauthorizedError('Authentication failed'));
  }
}
