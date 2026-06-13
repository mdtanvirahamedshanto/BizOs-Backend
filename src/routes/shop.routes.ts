import { Router } from 'express';
import { ShopController } from '@/controllers/shop.controller';
import { ShopService } from '@/services/shop.service';
import { ShopRepository } from '@/repositories/shop.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import { updateShopSchema, updateShopSettingsSchema } from '@/validators/shop.schema';

const router = Router();
const shopRepo = new ShopRepository(prisma);
const shopService = new ShopService(shopRepo);
const shopController = new ShopController(shopService);

router.use(authenticate);
router.use(tenantContext);

router.get('/:id', authorize('shop.read'), shopController.getShop);
router.put('/:id', authorize('shop.update'), validate(updateShopSchema), shopController.updateShop);
router.put('/:id/settings', authorize('shop.update'), validate(updateShopSettingsSchema), shopController.updateSettings);
router.delete('/:id', authorize('shop.delete'), shopController.deleteShop);

export const shopRoutes = router;
