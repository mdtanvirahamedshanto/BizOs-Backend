import { Router } from 'express';
import { ReportsController } from '@/controllers/reports.controller';
import { ReportsService } from '@/services/reports.service';
import { ReportsRepository } from '@/repositories/reports.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import { reportQuerySchema, dashboardQuerySchema, generateReportSchema } from '@/validators/reports.schema';

const router = Router();
const reportsRepo = new ReportsRepository(prisma);
const reportsService = new ReportsService(reportsRepo);
const reportsController = new ReportsController(reportsService);

router.use(authenticate);
router.use(tenantContext);

router.get(
  '/daily-sales',
  authorize('reports.read'),
  validate(reportQuerySchema, 'query'),
  reportsController.getDailySales,
);
router.get(
  '/monthly-sales',
  authorize('reports.read'),
  validate(reportQuerySchema, 'query'),
  reportsController.getMonthlySales,
);
router.get(
  '/profit',
  authorize('reports.read'),
  validate(reportQuerySchema, 'query'),
  reportsController.getProfitReport,
);
router.get('/inventory', authorize('reports.read'), reportsController.getInventoryReport);
router.get('/dues', authorize('reports.read'), reportsController.getDueReport);
router.get(
  '/dashboard',
  authorize('reports.read'),
  validate(dashboardQuerySchema, 'query'),
  reportsController.getDashboardMetrics,
);
router.post(
  '/generate',
  authorize('reports.read'),
  validate(generateReportSchema),
  reportsController.generateReport,
);

export const reportsRoutes = router;
