import { Router } from 'express';

// Import domain routes
import { authRoutes } from './auth.routes';
import { shopRoutes } from './shop.routes';
import { customerRoutes } from './customer.routes';
import { supplierRoutes } from './supplier.routes';
import { productRoutes, categoryRoutes } from './product.routes';
import { salesRoutes } from './sales.routes';
import { paymentRoutes } from './payment.routes';
import { purchaseRoutes } from './purchase.routes';

const router = Router();

// Mount domain routes
router.use('/auth', authRoutes);
router.use('/shops', shopRoutes);
router.use('/customers', customerRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/sales', salesRoutes);
router.use('/payments', paymentRoutes);
router.use('/purchases', purchaseRoutes);

// Example route for now
router.get('/status', (_req, res) => {
  res.json({ status: 'API is operational' });
});

export default router;
