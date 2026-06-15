import type { PrismaClient } from '@prisma/client';

export class TelegramRepository {
  constructor(private prisma: PrismaClient) {}

  async findActiveLinkByChatId(telegramChatId: bigint) {
    return this.prisma.telegramLink.findFirst({
      where: { telegramChatId, isActive: true },
      include: {
        user: { select: { id: true, name: true, email: true } },
        shop: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async findLinkByShopUser(shopId: string, userId: string) {
    return this.prisma.telegramLink.findFirst({
      where: { shopId, userId, isActive: true },
    });
  }

  async upsertLink(data: {
    shopId: string;
    userId: string;
    telegramChatId: bigint;
    telegramUsername?: string | null;
  }) {
    const existingByChat = await this.prisma.telegramLink.findUnique({
      where: { telegramChatId: data.telegramChatId },
    });

    if (existingByChat && existingByChat.shopId !== data.shopId) {
      await this.prisma.telegramLink.update({
        where: { id: existingByChat.id },
        data: { isActive: false, unlinkedAt: new Date() },
      });
    }

    return this.prisma.telegramLink.upsert({
      where: {
        shopId_userId: {
          shopId: data.shopId,
          userId: data.userId,
        },
      },
      update: {
        telegramChatId: data.telegramChatId,
        telegramUsername: data.telegramUsername ?? null,
        isActive: true,
        linkedAt: new Date(),
        unlinkedAt: null,
      },
      create: {
        shopId: data.shopId,
        userId: data.userId,
        telegramChatId: data.telegramChatId,
        telegramUsername: data.telegramUsername ?? null,
        isActive: true,
      },
    });
  }

  async deactivateLink(shopId: string, userId: string) {
    const link = await this.prisma.telegramLink.findFirst({
      where: { shopId, userId, isActive: true },
    });

    if (!link) {
      return null;
    }

    return this.prisma.telegramLink.update({
      where: { id: link.id },
      data: { isActive: false, unlinkedAt: new Date() },
    });
  }

  async deactivateLinkByChatId(telegramChatId: bigint) {
    const link = await this.prisma.telegramLink.findFirst({
      where: { telegramChatId, isActive: true },
    });

    if (!link) {
      return null;
    }

    return this.prisma.telegramLink.update({
      where: { id: link.id },
      data: { isActive: false, unlinkedAt: new Date() },
    });
  }

  async logMessage(data: {
    shopId: string;
    telegramLinkId: string;
    chatId: bigint;
    messageText: string;
    telegramMessageId?: bigint;
    status: 'PENDING' | 'SENT' | 'FAILED';
    error?: string | null;
  }) {
    return this.prisma.telegramMessage.create({
      data: {
        shopId: data.shopId,
        telegramLinkId: data.telegramLinkId,
        chatId: data.chatId,
        messageText: data.messageText,
        telegramMessageId: data.telegramMessageId,
        status: data.status,
        error: data.error ?? null,
        sentAt: data.status === 'SENT' ? new Date() : null,
      },
    });
  }

  async listMessages(
    shopId: string,
    params: { limit?: number; offset?: number; status?: 'PENDING' | 'SENT' | 'FAILED' },
  ) {
    return this.prisma.telegramMessage.findMany({
      where: {
        shopId,
        ...(params.status ? { status: params.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
      include: {
        telegramLink: {
          select: { telegramUsername: true, telegramChatId: true },
        },
      },
    });
  }

  async countMessages(shopId: string, status?: 'PENDING' | 'SENT' | 'FAILED') {
    return this.prisma.telegramMessage.count({
      where: {
        shopId,
        ...(status ? { status } : {}),
      },
    });
  }

  async countActiveLinks(shopId: string) {
    return this.prisma.telegramLink.count({
      where: { shopId, isActive: true },
    });
  }

  async getMessagesSince(shopId: string, since: Date) {
    return this.prisma.telegramMessage.findMany({
      where: { shopId, createdAt: { gte: since } },
      select: { status: true, createdAt: true, messageText: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getNotificationPrefs(telegramLinkId: string) {
    return this.prisma.telegramNotificationPref.findMany({
      where: { telegramLinkId },
    });
  }

  async upsertNotificationPref(telegramLinkId: string, eventType: string, isEnabled: boolean) {
    return this.prisma.telegramNotificationPref.upsert({
      where: {
        telegramLinkId_eventType: {
          telegramLinkId,
          eventType,
        },
      },
      update: { isEnabled },
      create: { telegramLinkId, eventType, isEnabled },
    });
  }
}
