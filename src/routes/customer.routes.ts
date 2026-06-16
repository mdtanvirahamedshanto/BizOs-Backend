import { Router } from 'express';
import { CustomerController } from '@/controllers/customer.controller';
import { CustomerService } from '@/services/customer.service';
import { CustomerRepository } from '@/repositories/customer.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import { createCustomerSchema, updateCustomerSchema, customerQuerySchema } from '@/validators/customer.schema';

const router = Router();
const customerRepo = new CustomerRepository(prisma);
const customerService = new CustomerService(customerRepo);
const customerController = new CustomerController(customerService);

router.use(authenticate);
router.use(tenantContext);

router.post('/', authorize('customers.create'), validate(createCustomerSchema), customerController.createCustomer);
router.get('/', authorize('customers.read'), validate(customerQuerySchema, 'query'), customerController.listCustomers);
router.get('/:id/statement', authorize('customers.read'), customerController.generateCustomerStatementPdf);
router.get('/:id', authorize('customers.read'), customerController.getCustomer);
router.put('/:id', authorize('customers.update'), validate(updateCustomerSchema), customerController.updateCustomer);
router.delete('/:id', authorize('customers.delete'), customerController.deleteCustomer);

export const customerRoutes = router;
