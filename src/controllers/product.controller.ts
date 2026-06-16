import type { Request, Response, NextFunction } from 'express';
import type { ProductService } from '@/services/product.service';
import { sendSuccess, sendCreated, sendNoContent } from '@/utils/response';

export class ProductController {
  constructor(private productService: ProductService) {}

  // ==========================================
  // Category Endpoints
  // ==========================================

  createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const actorUserId = req.user?.id;
      const result = await this.productService.createCategory(shopId, req.body, actorUserId);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const categoryId = req.params.id as string;
      const result = await this.productService.getCategory(shopId, categoryId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  updateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const categoryId = req.params.id as string;
      const actorUserId = req.user?.id;
      const result = await this.productService.updateCategory(shopId, categoryId, req.body, actorUserId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  deleteCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const categoryId = req.params.id as string;
      const actorUserId = req.user?.id;
      await this.productService.deleteCategory(shopId, categoryId, actorUserId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  listCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.productService.listCategories(shopId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getCategoryTree = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.productService.getCategoryTree(shopId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // Product Endpoints
  // ==========================================

  createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const actorUserId = req.user?.id;
      const result = await this.productService.createProduct(shopId, req.body, actorUserId);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const productId = req.params.id as string;
      const result = await this.productService.getProduct(shopId, productId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const productId = req.params.id as string;
      const actorUserId = req.user?.id;
      const result = await this.productService.updateProduct(shopId, productId, req.body, actorUserId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const productId = req.params.id as string;
      const actorUserId = req.user?.id;
      await this.productService.deleteProduct(shopId, productId, actorUserId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  listProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.productService.listProducts(shopId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getBrands = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.productService.getBrands(shopId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getUnits = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.productService.getUnits(shopId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listStockMovements = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const productId = req.params.id as string;
      const result = await this.productService.listStockMovements(shopId, productId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  adjustStock = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const productId = req.params.id as string;
      const actorUserId = req.user?.id;
      const result = await this.productService.adjustStock(shopId, productId, req.body, actorUserId);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
