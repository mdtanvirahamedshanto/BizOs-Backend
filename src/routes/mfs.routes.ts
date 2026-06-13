import { Router } from 'express';
import { MfsController } from '@/controllers/mfs.controller';
import { MfsService } from '@/services/mfs.service';
import { MfsRepository } from '@/repositories/mfs.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import {
  mfsAccountSchema,
  updateMfsAccountSchema,
  mfsTransactionSchema,
  mfsQuerySchema,
} from '@/validators/mfs.schema';

const router = Router();
const mfsRepo = new MfsRepository(prisma);
const mfsService = new MfsService(mfsRepo);
const mfsController = new MfsController(mfsService);

router.use(authenticate);
router.use(tenantContext);

// ==========================================
// MFS ACCOUNTS
// ==========================================
router.post(
  '/accounts',
  authorize('mfs.write'),
  validate(mfsAccountSchema),
  mfsController.createAccount
);
router.get(
  '/accounts',
  authorize('mfs.read'),
  mfsController.listAccounts
);
router.get(
  '/accounts/:id',
  authorize('mfs.read'),
  mfsController.getAccount
);
router.put(
  '/accounts/:id',
  authorize('mfs.update'),
  validate(updateMfsAccountSchema),
  mfsController.updateAccount
);

// ==========================================
// MFS TRANSACTIONS
// ==========================================
router.post(
  '/transactions',
  authorize('mfs.write'),
  validate(mfsTransactionSchema),
  mfsController.createTransaction
);
router.get(
  '/transactions',
  authorize('mfs.read'),
  validate(mfsQuerySchema, 'query'),
  mfsController.listTransactions
);
router.get(
  '/transactions/:id',
  authorize('mfs.read'),
  mfsController.getTransaction
);

export const mfsRoutes = router;
