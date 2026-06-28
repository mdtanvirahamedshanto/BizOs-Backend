import { createModuleLogger } from '@/config/logger';

const log = createModuleLogger('realtime');

export class RealtimeService {
  static async publish(_message: any): Promise<void> {
    // No-op
  }

  static startSubscriber(): void {
    // No-op (Socket notification feature removed)
    log.info('Realtime service (Socket notifications) has been disabled');
  }

  static async pushNotification(
    _shopId: string,
    _userId: string,
    _payload: Record<string, unknown>,
  ): Promise<void> {
    // No-op
  }

  static async refreshDashboard(
    _shopId: string,
    _source: string,
    _entityId?: string,
  ): Promise<void> {
    // No-op
  }
}
