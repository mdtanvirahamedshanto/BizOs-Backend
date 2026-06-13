import { Router } from 'express';
import { CashbookController } from '@/controllers/cashbook.controller';
import { CashbookService } from '@/services/cashbook.service';
import { CashbookRepository } from '@/repositories/cashbook.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import {
  manualCashEntrySchema,
  dailyClosingSchema,
  cashbookQuerySchema,
} from '@/validators/cashbook.schema';

const router = Router();
const cashbookRepo = new CashbookRepository(prisma);
const cashbookService = new CashbookService(cashbookRepo);
const cashbookController = new CashbookController(cashbookService);

router.use(authenticate);
router.use(tenantContext);

router.post(
  '/cash-in',
  authorize('cashbook.write'),
  validate(manualCashEntrySchema),
  cashbookController.recordCashIn
);

router.post(
  '/cash-out',
  authorize('cashbook.write'),
  validate(manualCashEntrySchema),
  cashbookController.recordCashOut
);

router.get(
  '/balance',
  authorize('cashbook.read'),
  cashbookController.getCurrentBalance
);

router.get(
  '/entries',
  authorize('cashbook.read'),
  validate(cashbookQuerySchema, 'query'),
  cashbookController.listEntries
);

router.get(
  '/closing-preview',
  authorize('cashbook.read'),
  cashbookController.getClosingPreview
);

router.post(
  '/closing',
  authorize('cashbook.update'),
  validate(dailyClosingSchema),
  cashbookController.recordClosing
);

router.get(
  '/closings',
  authorize('cashbook.read'),
  cashbookController.listClosings
);

export const cashbookRoutes = router;
