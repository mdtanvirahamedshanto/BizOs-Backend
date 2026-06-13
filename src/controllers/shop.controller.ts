import type { Request, Response, NextFunction } from 'express';
import { ShopService } from '@/services/shop.service';
import { sendSuccess, sendNoContent } from '@/utils/response';
import { ForbiddenError } from '@/utils/errors';

export class ShopController {
  constructor(private shopService: ShopService) {}

  private validateShopAccess(req: Request, shopId: string): void {
    const isSuperAdmin = req.user?.permissions.includes('*');
    if (!isSuperAdmin && req.shopId !== shopId) {
      throw new ForbiddenError('Access to this shop is forbidden');
    }
  }

  getShop = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.id as string;
      this.validateShopAccess(req, shopId);

      const result = await this.shopService.getShop(shopId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  updateShop = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.id as string;
      this.validateShopAccess(req, shopId);

      const result = await this.shopService.updateShop(shopId, req.body);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.id as string;
      this.validateShopAccess(req, shopId);

      const result = await this.shopService.updateSettings(shopId, req.body);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  deleteShop = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.id as string;
      this.validateShopAccess(req, shopId);

      await this.shopService.deleteShop(shopId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };
}
