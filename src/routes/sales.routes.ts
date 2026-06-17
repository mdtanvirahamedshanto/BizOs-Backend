import { Router } from 'express';
import { SalesController } from '@/controllers/sales.controller';
import { SalesService } from '@/services/sales.service';
import { SalesRepository } from '@/repositories/sales.repository';
import { ProductRepository } from '@/repositories/product.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import { idempotency } from '@/middlewares/idempotency';
import { createSaleSchema, saleQuerySchema, returnSaleSchema } from '@/validators/sales.schema';

const router = Router();
const salesRepo = new SalesRepository(prisma);
const productRepo = new ProductRepository(prisma);
const salesService = new SalesService(salesRepo, productRepo);
const salesController = new SalesController(salesService);

router.use(authenticate);
router.use(tenantContext);

router.post('/', authorize('sales.create'), validate(createSaleSchema), idempotency(), salesController.createSale);
router.get('/', authorize('sales.read'), validate(saleQuerySchema, 'query'), salesController.listSales);
router.get('/:id/invoice', authorize('sales.read'), salesController.generateInvoicePdf);
router.post('/:id/return', authorize('sales.return'), validate(returnSaleSchema), salesController.processReturn);
router.get('/:id', authorize('sales.read'), salesController.getSale);

export const salesRoutes = router;
