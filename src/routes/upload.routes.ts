import { Router } from 'express';
import { UploadController } from '@/controllers/upload.controller';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import { uploadMiddleware } from '@/middlewares/upload';
import {
  uploadQuerySchema,
  deleteUploadSchema,
  presignQuerySchema,
} from '@/validators/upload.schema';

const router = Router();
const uploadController = new UploadController();

router.use(authenticate);
router.use(tenantContext);

router.get('/status', authorize('uploads.read'), uploadController.getStorageStatus);
router.get('/presign', authorize('uploads.read'), validate(presignQuerySchema, 'query'), uploadController.getPresignedUrl);
router.post(
  '/',
  authorize('uploads.write'),
  validate(uploadQuerySchema, 'query'),
  ...uploadMiddleware,
  uploadController.uploadFile,
);
router.delete('/', authorize('uploads.write'), validate(deleteUploadSchema), uploadController.deleteFile);

export const uploadRoutes = router;
