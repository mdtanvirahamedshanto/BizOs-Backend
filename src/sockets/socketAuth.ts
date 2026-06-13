import jwt from 'jsonwebtoken';
import type { Socket } from 'socket.io';
import { env } from '@/env';

export interface SocketUser {
  id: string;
  shopId: string;
  email: string;
  permissions: string[];
}

declare module 'socket.io' {
  interface SocketData {
    user: SocketUser;
  }
}

/**
 * Socket.IO authentication middleware.
 * Accepts JWT via handshake auth token or Authorization header.
 */
export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
): void {
  try {
    const headerToken = socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
    const token = (socket.handshake.auth?.token as string | undefined) || headerToken;

    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as {
      sub: string;
      shopId?: string;
      tenantId?: string;
      email: string;
      permissions: string[];
    };

    const shopId = decoded.shopId || decoded.tenantId;
    if (!shopId) {
      next(new Error('Invalid token payload'));
      return;
    }

    socket.data.user = {
      id: decoded.sub,
      shopId,
      email: decoded.email,
      permissions: decoded.permissions,
    };

    next();
  } catch {
    next(new Error('Invalid or expired access token'));
  }
}
