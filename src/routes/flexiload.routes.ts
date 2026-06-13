import { Router } from 'express';
import { FlexiloadController } from '@/controllers/flexiload.controller';
import { FlexiloadService } from '@/services/flexiload.service';
import { FlexiloadRepository } from '@/repositories/flexiload.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import {
  flexiloadAccountSchema,
  updateFlexiloadAccountSchema,
  flexiloadTransactionSchema,
  flexiloadQuerySchema,
} from '@/validators/flexiload.schema';

const router = Router();
const flexiloadRepo = new FlexiloadRepository(prisma);
const flexiloadService = new FlexiloadService(flexiloadRepo);
const flexiloadController = new FlexiloadController(flexiloadService);

router.use(authenticate);
router.use(tenantContext);

// ==========================================
// FLEXILOAD ACCOUNTS
// ==========================================
router.post(
  '/accounts',
  authorize('flexiload.write'),
  validate(flexiloadAccountSchema),
  flexiloadController.createAccount
);
router.get(
  '/accounts',
  authorize('flexiload.read'),
  flexiloadController.listAccounts
);
router.get(
  '/accounts/:id',
  authorize('flexiload.read'),
  flexiloadController.getAccount
);
router.put(
  '/accounts/:id',
  authorize('flexiload.update'),
  validate(updateFlexiloadAccountSchema),
  flexiloadController.updateAccount
);

// ==========================================
// FLEXILOAD TRANSACTIONS
// ==========================================
router.post(
  '/recharge',
  authorize('flexiload.write'),
  validate(flexiloadTransactionSchema),
  flexiloadController.createTransaction
);
router.get(
  '/recharges',
  authorize('flexiload.read'),
  validate(flexiloadQuerySchema, 'query'),
  flexiloadController.listTransactions
);
router.get(
  '/recharges/:id',
  authorize('flexiload.read'),
  flexiloadController.getTransaction
);

export const flexiloadRoutes = router;
