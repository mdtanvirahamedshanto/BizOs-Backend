import { Router } from 'express';
import { PlatformController } from '@/controllers/platform.controller';
import { PlatformService } from '@/services/platform.service';
import { authenticate } from '@/middlewares/authenticate';
import { requirePlatformAdmin } from '@/middlewares/requirePlatformAdmin';

const router = Router();
const platformService = new PlatformService();
const platformController = new PlatformController(platformService);

// Cross-tenant control plane: authenticate then require platform-admin.
// Intentionally NO tenantContext — these endpoints span all shops.
router.use(authenticate);
router.use(requirePlatformAdmin);

router.get('/health', platformController.getHealth);
router.get('/stats', platformController.getStats);

router.get('/backups', platformController.listBackups);
router.post('/backups', platformController.createBackup);
router.get('/backups/:name/download', platformController.downloadBackup);
router.delete('/backups/:name', platformController.deleteBackup);

// ── Admin Dashboard Routes ──────────────────────────────────────────────────
router.get('/overview', platformController.getAdminOverview);
router.get('/tenants', platformController.listTenants);
router.post('/tenants/:id/status', platformController.updateTenantStatus);
router.get('/tickets', platformController.getTickets);
router.post('/tickets/:id/resolve', platformController.resolveTicket);
router.get('/flags', platformController.getFlags);
router.post('/flags/:key', platformController.toggleFlag);
router.get('/monitoring', platformController.getMonitoringStats);
router.get('/plans', platformController.getPlans);
router.put('/plans/:id', platformController.updatePlan);

export const platformRoutes = router;
