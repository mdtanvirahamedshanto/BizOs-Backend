import { Request, Response, NextFunction } from 'express';
import { BillingService } from '../services/billing.service';
import { sendSuccess } from '../utils/response';

export class BillingController {
  private billingService = new BillingService();

  getCurrentSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.user!.shopId;
      const data = await this.billingService.getCurrentSubscription(shopId);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  subscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.user!.shopId;
      const { planId, billingCycle } = req.body;
      const data = await this.billingService.subscribe(shopId, planId, billingCycle);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  cancelSubscription = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.user!.shopId;
      const data = await this.billingService.cancelSubscription(shopId);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };

  manualSubscribe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.user!.shopId;
      const { planId, billingCycle, paymentMethod, transactionId, senderAccount } = req.body;
      const data = await this.billingService.manualSubscribe({
        shopId,
        planId,
        billingCycle,
        paymentMethod,
        transactionId,
        senderAccount
      });
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  };
}
