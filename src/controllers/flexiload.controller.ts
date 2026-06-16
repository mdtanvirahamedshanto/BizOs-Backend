import type { Request, Response, NextFunction } from 'express';
import type { FlexiloadService } from '@/services/flexiload.service';
import { sendSuccess, sendCreated } from '@/utils/response';

export class FlexiloadController {
  constructor(private flexiloadService: FlexiloadService) {}

  // ==========================================
  // FLEXILOAD ACCOUNTS
  // ==========================================

  createAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const actorUserId = req.user?.id;
      const result = await this.flexiloadService.createAccount(shopId, req.body, actorUserId);
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
      const result = await this.flexiloadService.updateAccount(shopId, accountId, req.body, actorUserId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getAccount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const accountId = req.params.id as string;
      const result = await this.flexiloadService.getAccount(shopId, accountId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listAccounts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const operator = req.query.operator as any;
      const result = await this.flexiloadService.listAccounts(shopId, operator);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // FLEXILOAD TRANSACTIONS
  // ==========================================

  createTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const actorUserId = req.user!.id;
      const result = await this.flexiloadService.createTransaction(shopId, actorUserId, req.body);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const transactionId = req.params.id as string;
      const result = await this.flexiloadService.getTransaction(shopId, transactionId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.flexiloadService.listTransactions(shopId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
