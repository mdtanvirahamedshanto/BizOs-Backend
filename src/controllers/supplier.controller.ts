import type { Request, Response, NextFunction } from 'express';
import type { SupplierService } from '@/services/supplier.service';
import { sendSuccess, sendCreated, sendNoContent } from '@/utils/response';

export class SupplierController {
  constructor(private supplierService: SupplierService) {}

  createSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const actorUserId = req.user?.id;
      const result = await this.supplierService.createSupplier(shopId, req.body, actorUserId);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const supplierId = req.params.id as string;
      const result = await this.supplierService.getSupplier(shopId, supplierId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  updateSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const supplierId = req.params.id as string;
      const actorUserId = req.user?.id;
      const result = await this.supplierService.updateSupplier(shopId, supplierId, req.body, actorUserId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  deleteSupplier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const supplierId = req.params.id as string;
      const actorUserId = req.user?.id;
      await this.supplierService.deleteSupplier(shopId, supplierId, actorUserId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  listSuppliers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.supplierService.listSuppliers(shopId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getDueTracking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const supplierId = req.params.id as string;
      const result = await this.supplierService.getDueTracking(shopId, supplierId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getPurchaseHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const supplierId = req.params.id as string;
      const result = await this.supplierService.getPurchaseHistory(shopId, supplierId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getSupplierLedger = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const supplierId = req.params.id as string;
      const result = await this.supplierService.getSupplierLedger(shopId, supplierId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getSupplierPayments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const supplierId = req.params.id as string;
      const result = await this.supplierService.getSupplierPayments(shopId, supplierId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
