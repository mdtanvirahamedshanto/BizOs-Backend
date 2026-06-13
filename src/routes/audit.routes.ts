import { Router } from 'express';
import { AuditController } from '@/controllers/audit.controller';
import { AuditQueryService } from '@/services/auditQuery.service';
import { AuditRepository } from '@/repositories/audit.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import { auditQuerySchema } from '@/validators/audit.schema';

const router = Router();
const auditRepo = new AuditRepository(prisma);
const auditQueryService = new AuditQueryService(auditRepo);
const auditController = new AuditController(auditQueryService);

router.use(authenticate);
router.use(tenantContext);

router.get('/actions', authorize('audit.read'), auditController.listActions);
router.get('/', authorize('audit.read'), validate(auditQuerySchema, 'query'), auditController.listLogs);
router.get('/:id', authorize('audit.read'), auditController.getLog);

export const auditRoutes = router;
