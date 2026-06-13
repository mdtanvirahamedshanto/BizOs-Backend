import type { Server as SocketIOServer } from 'socket.io';
import { SOCKET_NAMESPACES, tenantRoom, userRoom } from '@/config/socket';
import { socketAuthMiddleware } from '@/sockets/socketAuth';
import { createModuleLogger } from '@/config/logger';

const log = createModuleLogger('socket');

/**
 * Register Socket.IO namespaces with JWT auth and tenant-scoped rooms.
 */
export function registerSocketNamespaces(io: SocketIOServer): void {
  const notifications = io.of(SOCKET_NAMESPACES.NOTIFICATIONS);
  notifications.use(socketAuthMiddleware);
  notifications.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(tenantRoom(user.shopId));
    socket.join(userRoom(user.shopId, user.id));
    log.debug({ userId: user.id, shopId: user.shopId }, 'Notifications socket connected');
  });

  const dashboard = io.of(SOCKET_NAMESPACES.DASHBOARD);
  dashboard.use(socketAuthMiddleware);
  dashboard.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(tenantRoom(user.shopId));
    log.debug({ userId: user.id, shopId: user.shopId }, 'Dashboard socket connected');
  });
}
