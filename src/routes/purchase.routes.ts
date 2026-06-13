import { Router } from 'express';
import { PurchaseController } from '@/controllers/purchase.controller';
import { PurchaseService } from '@/services/purchase.service';
import { PurchaseRepository } from '@/repositories/purchase.repository';
import { ProductRepository } from '@/repositories/product.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import {
  createPurchaseSchema,
  updatePurchaseSchema,
  purchaseQuerySchema,
  returnPurchaseSchema,
} from '@/validators/purchase.schema';

const router = Router();
const purchaseRepo = new PurchaseRepository(prisma);
const productRepo = new ProductRepository(prisma);
const purchaseService = new PurchaseService(purchaseRepo, productRepo);
const purchaseController = new PurchaseController(purchaseService);

router.use(authenticate);
router.use(tenantContext);

router.post('/', authorize('purchases.create'), validate(createPurchaseSchema), purchaseController.createPurchase);
router.get('/', authorize('purchases.read'), validate(purchaseQuerySchema, 'query'), purchaseController.listPurchases);
router.get('/:id', authorize('purchases.read'), purchaseController.getPurchase);
router.put('/:id/status', authorize('purchases.update'), validate(updatePurchaseSchema), purchaseController.updatePurchaseStatus);
router.post('/:id/return', authorize('purchases.return'), validate(returnPurchaseSchema), purchaseController.processReturn);

export const purchaseRoutes = router;
