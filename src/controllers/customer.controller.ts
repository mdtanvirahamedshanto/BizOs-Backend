import type { Request, Response, NextFunction } from 'express';
import { CustomerService } from '@/services/customer.service';
import { sendSuccess, sendCreated, sendNoContent } from '@/utils/response';

export class CustomerController {
  constructor(private customerService: CustomerService) {}

  createCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const actorUserId = req.user?.id;
      const result = await this.customerService.createCustomer(shopId, req.body, actorUserId);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const customerId = req.params.id as string;
      const result = await this.customerService.getCustomer(shopId, customerId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  updateCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const customerId = req.params.id as string;
      const actorUserId = req.user?.id;
      const result = await this.customerService.updateCustomer(shopId, customerId, req.body, actorUserId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  deleteCustomer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const customerId = req.params.id as string;
      const actorUserId = req.user?.id;
      await this.customerService.deleteCustomer(shopId, customerId, actorUserId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  listCustomers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.customerService.listCustomers(shopId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
