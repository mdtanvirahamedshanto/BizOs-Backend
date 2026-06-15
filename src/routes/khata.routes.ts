import { Router } from 'express';
import { KhataController } from '@/controllers/khata.controller';
import { KhataService } from '@/services/khata.service';
import { KhataRepository } from '@/repositories/khata.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import {
  khataQuerySchema,
  khataEntryQuerySchema,
  createCollectionSchema,
  createRepaymentSchema,
  khataAdjustmentSchema,
  ensureKhataAccountSchema,
} from '@/validators/khata.schema';

const router = Router();
const khataRepo = new KhataRepository(prisma);
const khataService = new KhataService(khataRepo);
const khataController = new KhataController(khataService);

router.use(authenticate);
router.use(tenantContext);

// Specific summary route first to avoid /accounts/:id parameter matching collisions
router.get('/due-summary', authorize('khata.read'), khataController.getDueSummary);

router.post('/accounts/ensure', authorize('khata.write'), validate(ensureKhataAccountSchema), khataController.ensureAccount);

router.get('/accounts', authorize('khata.read'), validate(khataQuerySchema, 'query'), khataController.listAccounts);
router.get('/accounts/:id', authorize('khata.read'), khataController.getAccount);
router.get('/accounts/:id/entries', authorize('khata.read'), validate(khataEntryQuerySchema, 'query'), khataController.listEntries);

router.post('/accounts/:id/collection', authorize('khata.write'), validate(createCollectionSchema), khataController.recordCollection);
router.post('/accounts/:id/repayment', authorize('khata.write'), validate(createRepaymentSchema), khataController.recordRepayment);
router.post('/accounts/:id/adjustments', authorize('khata.update'), validate(khataAdjustmentSchema), khataController.recordAdjustment);

export const khataRoutes = router;
