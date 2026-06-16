import { redis } from '@/config/redis';
import { env } from '@/env';
import { generateToken } from '@/utils/crypto';
import { success, failure, type ServiceResult } from '@/types/service';
import { NotFoundError, ConflictError } from '@/utils/errors';
import type { TelegramRepository } from '@/repositories/telegram.repository';
import type { TelegramEntryService } from '@/services/telegramEntry.service';
import { parseNaturalLanguageEntry, type ParsedEntry, getParserHelpText } from '@/bot/nlp/parser';
import { AuditService } from '@/services/audit.service';

export interface TelegramLinkContext {
  shopId: string;
  userId: string;
  linkId: string;
  shopName: string;
  userName: string;
}

export class TelegramService {
  constructor(
    private telegramRepo: TelegramRepository,
    private entryService: TelegramEntryService,
  ) {}

  private linkKey(token: string): string {
    return `telegram:link:${token}`;
  }

  async createLinkToken(shopId: string, userId: string): Promise<ServiceResult<{ token: string; deepLink: string; expiresIn: number }>> {
    const existing = await this.telegramRepo.findLinkByShopUser(shopId, userId);
    if (existing) {
      return failure('ALREADY_LINKED', 'Telegram account is already linked. Unlink first to generate a new token.');
    }

    const token = generateToken(16);
    const ttl = env.TELEGRAM_LINK_TTL_SEC;
    await redis.setex(this.linkKey(token), ttl, JSON.stringify({ shopId, userId }));

    await AuditService.log({
      shopId,
      userId,
      action: 'telegram.link_token_created',
      entity: 'telegram_links',
      metadata: { expiresIn: ttl },
    });

    const deepLink = env.TELEGRAM_BOT_USERNAME
      ? `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${token}`
      : `https://t.me/share/url?url=start ${token}`;

    return success({ token, deepLink, expiresIn: ttl });
  }

  async getLinkStatus(shopId: string, userId: string): Promise<ServiceResult<unknown>> {
    const link = await this.telegramRepo.findLinkByShopUser(shopId, userId);
    if (!link) {
      return success({ linked: false });
    }

    return success({
      linked: true,
      linkedAt: link.linkedAt,
      telegramUsername: link.telegramUsername,
    });
  }

  async unlinkAccount(shopId: string, userId: string): Promise<ServiceResult<void>> {
    const link = await this.telegramRepo.deactivateLink(shopId, userId);
    if (!link) {
      throw new NotFoundError('Telegram link');
    }

    await AuditService.log({
      shopId,
      userId,
      action: 'telegram.unlinked',
      entity: 'telegram_links',
      entityId: link.id,
    });

    return success(undefined);
  }

  async completeLink(
    token: string,
    telegramChatId: bigint,
    telegramUsername?: string | null,
  ): Promise<{ shopName: string; userName: string }> {
    const raw = await redis.get(this.linkKey(token));
    if (!raw) {
      throw new ConflictError('Link token is invalid or expired. Generate a new link from the BizOS app.');
    }

    const { shopId, userId } = JSON.parse(raw) as { shopId: string; userId: string };
    await redis.del(this.linkKey(token));

    const link = await this.telegramRepo.upsertLink({
      shopId,
      userId,
      telegramChatId,
      telegramUsername,
    });

    const context = await this.telegramRepo.findActiveLinkByChatId(link.telegramChatId);
    if (!context) {
      throw new NotFoundError('Telegram link');
    }

    await AuditService.log({
      shopId,
      userId,
      action: 'telegram.linked',
      entity: 'telegram_links',
      entityId: link.id,
      metadata: { telegramChatId: telegramChatId.toString(), telegramUsername },
    });

    return {
      shopName: context.shop.name,
      userName: context.user.name,
    };
  }

  async resolveContext(telegramChatId: bigint): Promise<TelegramLinkContext | null> {
    const link = await this.telegramRepo.findActiveLinkByChatId(telegramChatId);
    if (!link) {
      return null;
    }

    return {
      shopId: link.shopId,
      userId: link.userId,
      linkId: link.id,
      shopName: link.shop.name,
      userName: link.user.name,
    };
  }

  async processNaturalLanguage(
    context: TelegramLinkContext,
    text: string,
    chatId: bigint,
    telegramMessageId?: number,
  ): Promise<string> {
    const parsed = parseNaturalLanguageEntry(text);
    if (!parsed) {
      throw new ConflictError('Could not understand the message. Send /help for examples.');
    }

    try {
      const result = await this.entryService.processEntry(context.shopId, context.userId, parsed);

      await this.telegramRepo.logMessage({
        shopId: context.shopId,
        telegramLinkId: context.linkId,
        chatId,
        messageText: text,
        telegramMessageId: telegramMessageId ? BigInt(telegramMessageId) : undefined,
        status: 'SENT',
      });

      await AuditService.log({
        shopId: context.shopId,
        userId: context.userId,
        action: `telegram.entry.${result.type}`,
        entity: result.type,
        metadata: { raw: text, ...result.data },
      });

      return result.message;
    } catch (error) {
      await this.telegramRepo.logMessage({
        shopId: context.shopId,
        telegramLinkId: context.linkId,
        chatId,
        messageText: text,
        telegramMessageId: telegramMessageId ? BigInt(telegramMessageId) : undefined,
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async unlinkByChatId(telegramChatId: bigint): Promise<boolean> {
    const link = await this.telegramRepo.deactivateLinkByChatId(telegramChatId);
    return link !== null;
  }

  parseEntry(text: string): ParsedEntry | null {
    return parseNaturalLanguageEntry(text);
  }

  async getIntegrationStatus(shopId: string, userId: string): Promise<ServiceResult<unknown>> {
    const link = await this.telegramRepo.findLinkByShopUser(shopId, userId);
    const prefs = link ? await this.telegramRepo.getNotificationPrefs(link.id) : [];

    const prefMap = Object.fromEntries(prefs.map((p) => [p.eventType, p.isEnabled]));

    return success({
      account: link
        ? {
            connected: true,
            username: link.telegramUsername ?? undefined,
            userId: link.telegramChatId.toString(),
            linkedAt: link.linkedAt,
          }
        : { connected: false },
      bot: {
        connected: Boolean(env.TELEGRAM_BOT_TOKEN),
        botUsername: env.TELEGRAM_BOT_USERNAME,
        botName: 'BizOS Assistant',
        settings: {
          sendDailyReport: prefMap['report.daily'] ?? true,
          sendLowStockAlert: prefMap['inventory.low_stock'] ?? true,
          sendDueNotification: prefMap['khata.overdue'] ?? false,
        },
      },
    });
  }

  async listActivityLogs(
    shopId: string,
    params: { limit?: number; offset?: number; status?: 'success' | 'failed' },
  ): Promise<ServiceResult<unknown>> {
    const statusMap = { success: 'SENT' as const, failed: 'FAILED' as const };
    const rows = await this.telegramRepo.listMessages(shopId, {
      limit: params.limit,
      offset: params.offset,
      status: params.status ? statusMap[params.status] : undefined,
    });

    return success(
      rows.map((row) => ({
        id: row.id,
        chatId: row.chatId.toString(),
        userTelegram: row.telegramLink.telegramUsername
          ? `@${row.telegramLink.telegramUsername}`
          : row.chatId.toString(),
        incomingText: row.messageText,
        outgoingText: row.status === 'SENT' ? 'Processed successfully' : row.error ?? 'Failed',
        status: row.status === 'SENT' ? 'success' : 'failed',
        timestamp: (row.sentAt ?? row.createdAt).toISOString(),
      })),
    );
  }

  async getActivityStats(shopId: string): Promise<ServiceResult<unknown>> {
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);

    const [total, sent, failed, activeUsers, recent] = await Promise.all([
      this.telegramRepo.countMessages(shopId),
      this.telegramRepo.countMessages(shopId, 'SENT'),
      this.telegramRepo.countMessages(shopId, 'FAILED'),
      this.telegramRepo.countActiveLinks(shopId),
      this.telegramRepo.getMessagesSince(shopId, since),
    ]);

    const dayBuckets = new Map<string, { sent: number; received: number }>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dayBuckets.set(key, { sent: 0, received: 0 });
    }

    for (const msg of recent) {
      const key = msg.createdAt.toISOString().slice(0, 10);
      const bucket = dayBuckets.get(key);
      if (!bucket) continue;
      bucket.received += 1;
      if (msg.status === 'SENT') bucket.sent += 1;
    }

    const commandCounts = new Map<string, number>();
    for (const msg of recent) {
      const text = msg.messageText.trim();
      const cmd = (text.startsWith('/') ? text.split(/\s+/)[0] : 'nlp') || 'nlp';
      commandCounts.set(cmd, (commandCounts.get(cmd) ?? 0) + 1);
    }

    return success({
      totalCommandsProcessed: total,
      activeUsersCount: activeUsers,
      commandsUsage: [...commandCounts.entries()]
        .map(([command, count]) => ({ command, count }))
        .sort((a, b) => b.count - a.count),
      trafficChart: [...dayBuckets.entries()].map(([iso, counts]) => ({
        date: iso,
        sent: counts.sent,
        received: counts.received,
      })),
      successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
      failedCount: failed,
    });
  }

  getBotCommands(): ServiceResult<unknown> {
    return success([
      {
        key: 'start',
        command: '/start',
        description: 'Link your BizOS shop account using a one-time token',
        replyTemplate:
          'Welcome to BizOS Bot.\n\nGenerate a link token from the BizOS app, then send:\n/start YOUR_TOKEN',
        usageCount: 0,
        enabled: true,
      },
      {
        key: 'help',
        command: '/help',
        description: 'Show available commands and NLP entry examples',
        replyTemplate: getParserHelpText(),
        usageCount: 0,
        enabled: true,
      },
      {
        key: 'status',
        command: '/status',
        description: 'Show the linked shop and user for this chat',
        replyTemplate: 'Linked shop: {shopName}\nLinked user: {userName}',
        usageCount: 0,
        enabled: true,
      },
      {
        key: 'unlink',
        command: '/unlink',
        description: 'Disconnect Telegram from BizOS',
        replyTemplate: 'Telegram account unlinked from BizOS.',
        usageCount: 0,
        enabled: true,
      },
    ]);
  }

  async updateNotificationPreferences(
    shopId: string,
    userId: string,
    settings: {
      sendDailyReport?: boolean;
      sendLowStockAlert?: boolean;
      sendDueNotification?: boolean;
    },
  ): Promise<ServiceResult<unknown>> {
    const link = await this.telegramRepo.findLinkByShopUser(shopId, userId);
    if (!link) {
      throw new NotFoundError('Telegram link');
    }

    const mapping: Array<[keyof typeof settings, string]> = [
      ['sendDailyReport', 'report.daily'],
      ['sendLowStockAlert', 'inventory.low_stock'],
      ['sendDueNotification', 'khata.overdue'],
    ];

    for (const [key, eventType] of mapping) {
      if (settings[key] !== undefined) {
        await this.telegramRepo.upsertNotificationPref(link.id, eventType, settings[key]!);
      }
    }

    return this.getIntegrationStatus(shopId, userId);
  }

  async sendTestMessage(shopId: string, userId: string): Promise<ServiceResult<boolean>> {
    if (!env.TELEGRAM_BOT_TOKEN) {
      return failure('BOT_NOT_CONFIGURED', 'Telegram bot is not configured on the server.');
    }

    const link = await this.telegramRepo.findLinkByShopUser(shopId, userId);
    if (!link) {
      throw new NotFoundError('Telegram link');
    }

    const text =
      '✅ BizOS test message delivered successfully. Your Telegram connection is active.';

    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: link.telegramChatId.toString(),
          text,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      await this.telegramRepo.logMessage({
        shopId,
        telegramLinkId: link.id,
        chatId: link.telegramChatId,
        messageText: '[test ping]',
        status: 'FAILED',
        error: body,
      });
      return failure('SEND_FAILED', 'Failed to send test message via Telegram.');
    }

    await this.telegramRepo.logMessage({
      shopId,
      telegramLinkId: link.id,
      chatId: link.telegramChatId,
      messageText: '[test ping]',
      status: 'SENT',
    });

    return success(true);
  }
}
