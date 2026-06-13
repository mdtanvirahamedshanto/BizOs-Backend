import type { Context, MiddlewareFn } from 'telegraf';
import type { TelegramService, TelegramLinkContext } from '@/services/telegram.service';

declare module 'telegraf' {
  interface Context {
    telegramContext?: TelegramLinkContext;
  }
}

export function createAuthMiddleware(telegramService: TelegramService): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      return;
    }

    const context = await telegramService.resolveContext(BigInt(chatId));
    if (!context) {
      await ctx.reply(
        'Your Telegram account is not linked to BizOS.\n\nGenerate a link from the web app, then send:\n/start YOUR_TOKEN',
      );
      return;
    }

    ctx.telegramContext = context;
    await next();
  };
}
