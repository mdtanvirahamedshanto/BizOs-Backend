import { z } from 'zod';

export const telegramLinkTokenSchema = z.object({}).optional();

export type TelegramLinkTokenInput = z.infer<typeof telegramLinkTokenSchema>;
