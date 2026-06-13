import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../env';
import { UnauthorizedError } from '../errors';

interface JwtPayload {
  sub: string;       // userId
  tenantId: string;
  email: string;
  permissions: string[];
  iat: number;
  exp: number;
}

/**
 * Authentication middleware.
 * Verifies JWT access token from Authorization header.
 * Populates req.user with decoded token payload.
 *
 * Header format: Authorization: Bearer <token>
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;

    req.user = {
      id: decoded.sub,
      tenantId: decoded.tenantId,
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
