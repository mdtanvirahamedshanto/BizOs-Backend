import type { Telegraf, Context } from 'telegraf';
import type { TelegramService } from '@/services/telegram.service';
import { getParserHelpText } from '@/bot/nlp/parser';
import { ConflictError } from '@/utils/errors';

export function registerBotCommands(bot: Telegraf<Context>, telegramService: TelegramService): void {
  bot.start(async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return;
    }

    const token = ctx.payload?.trim();
    if (token) {
      try {
        const linked = await telegramService.completeLink(
          token,
          BigInt(chatId),
          ctx.from?.username,
        );
        await ctx.reply(
          `Linked successfully!\nShop: ${linked.shopName}\nUser: ${linked.userName}\n\nYou can now send entries like:\nরহিম বাকি 500\nবিক্রি 1200\nখরচ 50`,
        );
      } catch (error) {
        const message =
          error instanceof ConflictError || error instanceof Error
            ? error.message
            : 'Failed to link account';
        await ctx.reply(message);
      }
      return;
    }

    const existing = await telegramService.resolveContext(BigInt(chatId));
    if (existing) {
      await ctx.reply(
        `Already linked to ${existing.shopName} as ${existing.userName}.\n\nSend /help for entry examples or /unlink to disconnect.`,
      );
      return;
    }

    await ctx.reply(
      'Welcome to BizOS Bot.\n\nGenerate a link token from the BizOS app, then send:\n/start YOUR_TOKEN',
    );
  });

  bot.command('help', async (ctx) => {
    await ctx.reply(
      [
        'BizOS Telegram Commands:',
        '/start TOKEN — link your shop account',
        '/status — show linked account',
        '/unlink — disconnect Telegram',
        '/help — show this message',
        '',
        getParserHelpText(),
      ].join('\n'),
    );
  });

  bot.command('status', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return;
    }

    const context = await telegramService.resolveContext(BigInt(chatId));
    if (!context) {
      await ctx.reply('Not linked. Use /start TOKEN to connect your BizOS account.');
      return;
    }

    await ctx.reply(`Linked shop: ${context.shopName}\nLinked user: ${context.userName}`);
  });

  bot.command('unlink', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return;
    }

    const unlinked = await telegramService.unlinkByChatId(BigInt(chatId));
    if (!unlinked) {
      await ctx.reply('No active Telegram link found.');
      return;
    }

    await ctx.reply('Telegram account unlinked from BizOS.');
  });
}

export function registerTextHandler(bot: Telegraf<Context>, telegramService: TelegramService): void {
  bot.on('text', async (ctx) => {
    const chatId = ctx.chat?.id;
    const text = ctx.message.text?.trim();
    if (!chatId || !text || text.startsWith('/')) {
      return;
    }

    const context = await telegramService.resolveContext(BigInt(chatId));
    if (!context) {
      await ctx.reply('Account not linked. Use /start TOKEN from the BizOS app.');
      return;
    }

    try {
      const response = await telegramService.processNaturalLanguage(
        context,
        text,
        BigInt(chatId),
        ctx.message.message_id,
      );
      await ctx.reply(`✅ ${response}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save entry';
      await ctx.reply(`❌ ${message}`);
    }
  });
}
