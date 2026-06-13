import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createRedisConnection } from './redis';
import { env } from '../env';
import { logger } from './logger';

/**
 * Socket.IO server setup.
 * Uses Redis adapter for horizontal scaling (multi-instance support).
 *
 * Namespace design:
 *   /notifications — Real-time notification delivery
 *   /dashboard     — Live dashboard metric updates
 *   /collaboration — Multi-user collaboration events
 */
export function createSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
    transports: ['websocket', 'polling'],
  });

  // Attach Redis adapter for horizontal scaling
  const pubClient = createRedisConnection();
  const subClient = createRedisConnection();

  io.adapter(createAdapter(pubClient, subClient));

  logger.info('Socket.IO server created with Redis adapter');

  return io;
}

/**
 * Socket.IO namespaces to be registered.
 */
export const SOCKET_NAMESPACES = {
  NOTIFICATIONS: '/notifications',
  DASHBOARD: '/dashboard',
  COLLABORATION: '/collaboration',
} as const;

/**
 * Generate tenant-scoped room name.
 * All socket events are scoped to tenant rooms for data isolation.
 */
export function tenantRoom(tenantId: string): string {
  return `tenant:${tenantId}`;
}

/**
 * Generate user-scoped room name for direct notifications.
 */
export function userRoom(tenantId: string, userId: string): string {
  return `tenant:${tenantId}:user:${userId}`;
}
