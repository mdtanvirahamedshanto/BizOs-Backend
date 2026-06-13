import { Router } from 'express';
import { SupplierController } from '@/controllers/supplier.controller';
import { SupplierService } from '@/services/supplier.service';
import { SupplierRepository } from '@/repositories/supplier.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import { createSupplierSchema, updateSupplierSchema, supplierQuerySchema } from '@/validators/supplier.schema';

const router = Router();
const supplierRepo = new SupplierRepository(prisma);
const supplierService = new SupplierService(supplierRepo);
const supplierController = new SupplierController(supplierService);

router.use(authenticate);
router.use(tenantContext);

router.post('/', authorize('suppliers.create'), validate(createSupplierSchema), supplierController.createSupplier);
router.get('/', authorize('suppliers.read'), validate(supplierQuerySchema, 'query'), supplierController.listSuppliers);
router.get('/:id', authorize('suppliers.read'), supplierController.getSupplier);
router.put('/:id', authorize('suppliers.update'), validate(updateSupplierSchema), supplierController.updateSupplier);
router.delete('/:id', authorize('suppliers.delete'), supplierController.deleteSupplier);

router.get('/:id/due-tracking', authorize('suppliers.read'), supplierController.getDueTracking);
router.get('/:id/purchases', authorize('suppliers.read'), supplierController.getPurchaseHistory);

export const supplierRoutes = router;
