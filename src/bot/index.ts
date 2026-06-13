import { Telegraf } from 'telegraf';
import { env } from '@/env';
import { logger } from '@/config/logger';
import { prisma } from '@/prisma/client';
import { redis } from '@/config/redis';
import { TelegramRepository } from '@/repositories/telegram.repository';
import { CustomerRepository } from '@/repositories/customer.repository';
import { KhataRepository } from '@/repositories/khata.repository';
import { SalesRepository } from '@/repositories/sales.repository';
import { ProductRepository } from '@/repositories/product.repository';
import { ExpenseRepository } from '@/repositories/expense.repository';
import { TelegramEntryService } from '@/services/telegramEntry.service';
import { TelegramService } from '@/services/telegram.service';
import { registerEventHandlers } from '@/events/eventHandlers';
import { registerBotCommands, registerTextHandler } from '@/bot/commands';

async function bootstrap(): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.error('TELEGRAM_BOT_TOKEN is not configured. Bot process exiting.');
    process.exit(1);
  }

  await prisma.$connect();
  registerEventHandlers();

  const telegramRepo = new TelegramRepository(prisma);
  const entryService = new TelegramEntryService(
    new CustomerRepository(prisma),
    new KhataRepository(prisma),
    new SalesRepository(prisma),
    new ProductRepository(prisma),
    new ExpenseRepository(prisma),
  );
  const telegramService = new TelegramService(telegramRepo, entryService);

  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);
  registerBotCommands(bot, telegramService);
  registerTextHandler(bot, telegramService);

  bot.catch((error, ctx) => {
    logger.error({ err: error, updateType: ctx.updateType }, 'Telegram bot error');
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Stopping Telegram bot...`);
    bot.stop(signal);
    await prisma.$disconnect();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await bot.launch();
  logger.info('BizOS Telegram bot started');
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start Telegram bot');
  process.exit(1);
});
