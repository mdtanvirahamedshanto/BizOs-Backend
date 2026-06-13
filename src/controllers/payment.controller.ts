import type { Request, Response, NextFunction } from 'express';
import { PaymentService } from '@/services/payment.service';
import { sendSuccess, sendCreated } from '@/utils/response';

export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  createPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const userId = req.user?.id!;
      const result = await this.paymentService.createPayment(shopId, userId, req.body);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const paymentId = req.params.id as string;
      const result = await this.paymentService.getPayment(shopId, paymentId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.paymentService.listPayments(shopId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  refundPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const paymentId = req.params.id as string;
      const userId = req.user?.id!;
      const result = await this.paymentService.refundPayment(shopId, paymentId, userId, req.body);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
