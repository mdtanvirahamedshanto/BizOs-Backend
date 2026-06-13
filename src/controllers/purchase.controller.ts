import type { Request, Response, NextFunction } from 'express';
import { PurchaseService } from '@/services/purchase.service';
import { sendSuccess, sendCreated } from '@/utils/response';

export class PurchaseController {
  constructor(private purchaseService: PurchaseService) {}

  createPurchase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const userId = req.user?.id!;
      const result = await this.purchaseService.createPurchase(shopId, userId, req.body);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getPurchase = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const purchaseId = req.params.id as string;
      const result = await this.purchaseService.getPurchase(shopId, purchaseId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listPurchases = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.purchaseService.listPurchases(shopId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  updatePurchaseStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const purchaseId = req.params.id as string;
      const userId = req.user?.id!;
      const result = await this.purchaseService.updatePurchaseStatus(shopId, purchaseId, userId, req.body);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  processReturn = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const purchaseId = req.params.id as string;
      const userId = req.user?.id!;
      const result = await this.purchaseService.processReturn(shopId, purchaseId, userId, req.body);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
