import type { Request, Response, NextFunction } from 'express';
import type { MfsService } from '@/services/mfs.service';
import { sendSuccess, sendCreated } from '@/utils/response';

export class MfsController {
  constructor(private mfsService: MfsService) {}

  // ==========================================
  // MFS ACCOUNTS
  // ==========================================

  createAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const actorUserId = req.user?.id;
      const result = await this.mfsService.createAccount(shopId, req.body, actorUserId);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  updateAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const accountId = req.params.id as string;
      const actorUserId = req.user?.id;
      const result = await this.mfsService.updateAccount(shopId, accountId, req.body, actorUserId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const accountId = req.params.id as string;
      const result = await this.mfsService.getAccount(shopId, accountId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const provider = req.query.provider as any;
      const result = await this.mfsService.listAccounts(shopId, provider);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // MFS TRANSACTIONS
  // ==========================================

  createTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const actorUserId = req.user!.id;
      const result = await this.mfsService.createTransaction(shopId, actorUserId, req.body);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const transactionId = req.params.id as string;
      const result = await this.mfsService.getTransaction(shopId, transactionId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.mfsService.listTransactions(shopId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
