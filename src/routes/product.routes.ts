import { Router } from 'express';
import { ProductController } from '@/controllers/product.controller';
import { ProductService } from '@/services/product.service';
import { ProductRepository } from '@/repositories/product.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryQuerySchema,
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
} from '@/validators/product.schema';

const productRepo = new ProductRepository(prisma);
const productService = new ProductService(productRepo);
const productController = new ProductController(productService);

// ==========================================
// Category Routes
// ==========================================
const categoryRouter = Router();
categoryRouter.use(authenticate);
categoryRouter.use(tenantContext);

categoryRouter.post('/', authorize('products.create'), validate(createCategorySchema), productController.createCategory);
categoryRouter.get('/', authorize('products.read'), validate(categoryQuerySchema, 'query'), productController.listCategories);
categoryRouter.get('/tree', authorize('products.read'), productController.getCategoryTree);
categoryRouter.get('/:id', authorize('products.read'), productController.getCategory);
categoryRouter.put('/:id', authorize('products.update'), validate(updateCategorySchema), productController.updateCategory);
categoryRouter.delete('/:id', authorize('products.delete'), productController.deleteCategory);

// ==========================================
// Product Routes
// ==========================================
const productRouter = Router();
productRouter.use(authenticate);
productRouter.use(tenantContext);

productRouter.post('/', authorize('products.create'), validate(createProductSchema), productController.createProduct);
productRouter.get('/', authorize('products.read'), validate(productQuerySchema, 'query'), productController.listProducts);
productRouter.get('/brands', authorize('products.read'), productController.getBrands);
productRouter.get('/units', authorize('products.read'), productController.getUnits);
productRouter.get('/:id', authorize('products.read'), productController.getProduct);
productRouter.put('/:id', authorize('products.update'), validate(updateProductSchema), productController.updateProduct);
productRouter.delete('/:id', authorize('products.delete'), productController.deleteProduct);

export const categoryRoutes = categoryRouter;
export const productRoutes = productRouter;
