import type { Request, Response, NextFunction } from 'express';
import { TelegramService } from '@/services/telegram.service';
import { sendSuccess, sendNoContent } from '@/utils/response';

export class TelegramController {
  constructor(private telegramService: TelegramService) {}

  createLinkToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const userId = req.user?.id!;
      const result = await this.telegramService.createLinkToken(shopId, userId);

      if (!result.success) {
        res.status(409).json({ success: false, error: result.error });
        return;
      }

      sendSuccess(res, result.data, 201);
    } catch (err) {
      next(err);
    }
  };

  getLinkStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const userId = req.user?.id!;
      const result = await this.telegramService.getLinkStatus(shopId, userId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  unlinkAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const userId = req.user?.id!;
      await this.telegramService.unlinkAccount(shopId, userId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };
}
