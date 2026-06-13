import { Router } from 'express';

// Import domain routes
// import { authRoutes } from './auth.routes';
// import { shopRoutes } from './shop.routes';

const router = Router();

// Mount domain routes
// router.use('/auth', authRoutes);
// router.use('/shops', shopRoutes);

// Example route for now
router.get('/status', (_req, res) => {
  res.json({ status: 'API is operational' });
});

export default router;
