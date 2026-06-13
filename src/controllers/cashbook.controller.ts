import type { Request, Response, NextFunction } from 'express';
import { CashbookService } from '@/services/cashbook.service';
import { sendSuccess, sendCreated } from '@/utils/response';

export class CashbookController {
  constructor(private cashbookService: CashbookService) {}

  recordCashIn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const actorUserId = req.user?.id!;
      const result = await this.cashbookService.recordCashIn(shopId, actorUserId, req.body);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  recordCashOut = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const actorUserId = req.user?.id!;
      const result = await this.cashbookService.recordCashOut(shopId, actorUserId, req.body);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getCurrentBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.cashbookService.getCurrentBalance(shopId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listEntries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.cashbookService.listEntries(shopId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getClosingPreview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const dateStr = req.query.date as string;
      const result = await this.cashbookService.getClosingPreview(shopId, dateStr);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  recordClosing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const actorUserId = req.user?.id!;
      const dateStr = req.query.date as string;
      const result = await this.cashbookService.recordClosing(shopId, actorUserId, req.body, dateStr);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listClosings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.cashbookService.listClosings(shopId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
