import { redis, createRedisConnection } from '@/config/redis';
import { getSocketServer } from '@/config/socketInstance';
import { SOCKET_NAMESPACES, tenantRoom, userRoom } from '@/config/socket';
import { createModuleLogger } from '@/config/logger';

const log = createModuleLogger('realtime');
const REALTIME_CHANNEL = 'bizos:realtime';

type RealtimeMessage =
  | {
      type: 'notification:new';
      shopId: string;
      userId: string;
      payload: Record<string, unknown>;
    }
  | {
      type: 'dashboard:refresh';
      shopId: string;
      payload: Record<string, unknown>;
    };

let subscriberStarted = false;

export class RealtimeService {
  private static subscriber = createRedisConnection();

  static async publish(message: RealtimeMessage): Promise<void> {
    await redis.publish(REALTIME_CHANNEL, JSON.stringify(message));
  }

  static startSubscriber(): void {
    if (subscriberStarted) {
      return;
    }

    subscriberStarted = true;
    this.subscriber.subscribe(REALTIME_CHANNEL);

    this.subscriber.on('message', (_channel, raw) => {
      const io = getSocketServer();
      if (!io) {
        return;
      }

      try {
        const message = JSON.parse(raw) as RealtimeMessage;

        if (message.type === 'notification:new') {
          const target =
            message.userId === 'broadcast'
              ? tenantRoom(message.shopId)
              : userRoom(message.shopId, message.userId);

          io.of(SOCKET_NAMESPACES.NOTIFICATIONS)
            .to(target)
            .emit('notification:new', message.payload);
        }

        if (message.type === 'dashboard:refresh') {
          io.of(SOCKET_NAMESPACES.DASHBOARD)
            .to(tenantRoom(message.shopId))
            .emit('dashboard:refresh', message.payload);
        }
      } catch (err) {
        log.error({ err, raw }, 'Failed to process realtime message');
      }
    });

    log.info('Realtime Redis subscriber started');
  }

  static async pushNotification(
    shopId: string,
    userId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.publish({
      type: 'notification:new',
      shopId,
      userId,
      payload,
    });
  }

  static async refreshDashboard(
    shopId: string,
    source: string,
    entityId?: string,
  ): Promise<void> {
    await this.publish({
      type: 'dashboard:refresh',
      shopId,
      payload: {
        source,
        entityId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
