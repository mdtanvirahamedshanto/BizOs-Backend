import { Router } from 'express';
import { TelegramController } from '@/controllers/telegram.controller';
import { TelegramService } from '@/services/telegram.service';
import { TelegramEntryService } from '@/services/telegramEntry.service';
import { TelegramRepository } from '@/repositories/telegram.repository';
import { CustomerRepository } from '@/repositories/customer.repository';
import { KhataRepository } from '@/repositories/khata.repository';
import { SalesRepository } from '@/repositories/sales.repository';
import { ProductRepository } from '@/repositories/product.repository';
import { ExpenseRepository } from '@/repositories/expense.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';

const router = Router();
const telegramRepo = new TelegramRepository(prisma);
const entryService = new TelegramEntryService(
  new CustomerRepository(prisma),
  new KhataRepository(prisma),
  new SalesRepository(prisma),
  new ProductRepository(prisma),
  new ExpenseRepository(prisma),
);
const telegramService = new TelegramService(telegramRepo, entryService);
const telegramController = new TelegramController(telegramService);

router.use(authenticate);
router.use(tenantContext);

router.get('/status', authorize('telegram.read'), telegramController.getIntegrationStatus);
router.post('/link', authorize('telegram.write'), telegramController.createLinkToken);
router.get('/link', authorize('telegram.read'), telegramController.getLinkStatus);
router.delete('/link', authorize('telegram.write'), telegramController.unlinkAccount);
router.get('/messages', authorize('telegram.read'), telegramController.listActivityLogs);
router.get('/stats', authorize('telegram.read'), telegramController.getActivityStats);
router.get('/commands', authorize('telegram.read'), telegramController.getBotCommands);
router.put('/preferences', authorize('telegram.write'), telegramController.updatePreferences);
router.post('/test', authorize('telegram.write'), telegramController.sendTestMessage);

export const telegramRoutes = router;
