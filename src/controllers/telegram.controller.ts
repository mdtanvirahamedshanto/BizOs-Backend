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

  getIntegrationStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const userId = req.user?.id!;
      const result = await this.telegramService.getIntegrationStatus(shopId, userId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listActivityLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const status = req.query.status as 'success' | 'failed' | undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;
      const result = await this.telegramService.listActivityLogs(shopId, { status, limit, offset });
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getActivityStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.telegramService.getActivityStats(shopId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getBotCommands = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = this.telegramService.getBotCommands();
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  updatePreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const userId = req.user?.id!;
      const result = await this.telegramService.updateNotificationPreferences(shopId, userId, req.body);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  sendTestMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const userId = req.user?.id!;
      const result = await this.telegramService.sendTestMessage(shopId, userId);

      if (!result.success) {
        res.status(502).json({ success: false, error: result.error });
        return;
      }

      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
