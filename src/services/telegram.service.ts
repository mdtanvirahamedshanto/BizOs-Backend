import { redis } from '@/config/redis';
import { env } from '@/env';
import { generateToken } from '@/utils/crypto';
import { success, failure, type ServiceResult } from '@/types/service';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { TelegramRepository } from '@/repositories/telegram.repository';
import { TelegramEntryService } from '@/services/telegramEntry.service';
import { parseNaturalLanguageEntry, type ParsedEntry } from '@/bot/nlp/parser';

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
}
