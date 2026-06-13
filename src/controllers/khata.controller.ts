import type { Request, Response, NextFunction } from 'express';
import { KhataService } from '@/services/khata.service';
import { sendSuccess } from '@/utils/response';

export class KhataController {
  constructor(private khataService: KhataService) {}

  listAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.khataService.listAccounts(shopId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const accountId = req.params.id as string;
      const result = await this.khataService.getAccount(shopId, accountId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listEntries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const accountId = req.params.id as string;
      const result = await this.khataService.listEntries(shopId, accountId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  recordCollection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const accountId = req.params.id as string;
      const userId = req.user?.id!;
      const result = await this.khataService.recordCollection(shopId, accountId, userId, req.body);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  recordRepayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const accountId = req.params.id as string;
      const userId = req.user?.id!;
      const result = await this.khataService.recordRepayment(shopId, accountId, userId, req.body);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  recordAdjustment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const accountId = req.params.id as string;
      const userId = req.user?.id!;
      const result = await this.khataService.recordAdjustment(shopId, accountId, userId, req.body);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getDueSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.khataService.getDueSummary(shopId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
