import { Router } from 'express';

// Import domain routes
import { authRoutes } from './auth.routes';
import { shopRoutes } from './shop.routes';
import { customerRoutes } from './customer.routes';
import { supplierRoutes } from './supplier.routes';
import { productRoutes, categoryRoutes } from './product.routes';
import { salesRoutes } from './sales.routes';

const router = Router();

// Mount domain routes
router.use('/auth', authRoutes);
router.use('/shops', shopRoutes);
router.use('/customers', customerRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/sales', salesRoutes);

// Example route for now
router.get('/status', (_req, res) => {
  res.json({ status: 'API is operational' });
});

export default router;
