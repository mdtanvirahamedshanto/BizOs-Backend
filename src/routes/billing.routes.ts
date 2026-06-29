import { Router } from 'express';
import { BillingController } from '../controllers/billing.controller';
import { authenticate } from '../middlewares';

const router = Router();
const billingController = new BillingController();

router.use(authenticate);

router.get('/current', billingController.getCurrentSubscription);
router.post('/subscribe', billingController.subscribe);
router.post('/manual-subscribe', billingController.manualSubscribe);
router.post('/cancel', billingController.cancelSubscription);

export const billingRoutes = router;
