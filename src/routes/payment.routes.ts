import { Router } from 'express';
import { PaymentController } from '@/controllers/payment.controller';
import { PaymentService } from '@/services/payment.service';
import { PaymentRepository } from '@/repositories/payment.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import { createPaymentSchema, paymentQuerySchema, refundPaymentSchema } from '@/validators/payment.schema';

const router = Router();
const paymentRepo = new PaymentRepository(prisma);
const paymentService = new PaymentService(paymentRepo);
const paymentController = new PaymentController(paymentService);

router.use(authenticate);
router.use(tenantContext);

router.post('/', authorize('payments.create'), validate(createPaymentSchema), paymentController.createPayment);
router.get('/', authorize('payments.read'), validate(paymentQuerySchema, 'query'), paymentController.listPayments);
router.get('/:id', authorize('payments.read'), paymentController.getPayment);
router.post('/:id/refund', authorize('payments.delete'), validate(refundPaymentSchema), paymentController.refundPayment);

export const paymentRoutes = router;
