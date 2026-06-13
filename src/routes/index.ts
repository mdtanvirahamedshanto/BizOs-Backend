import { Router } from 'express';

// Import domain routes
import { authRoutes } from './auth.routes';

const router = Router();

// Mount domain routes
router.use('/auth', authRoutes);

// Example route for now
router.get('/status', (_req, res) => {
  res.json({ status: 'API is operational' });
});

export default router;
