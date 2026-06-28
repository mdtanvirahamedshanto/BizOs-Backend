import type { Request, Response, NextFunction } from 'express';
import { storageService } from '@/services/storage.service';
import { AuditService } from '@/services/audit.service';

import { sendSuccess, sendCreated, sendNoContent } from '@/utils/response';
import type { DeleteUploadDTO, PresignQueryDTO, UploadQueryDTO } from '@/validators/upload.schema';
import { ConflictError } from '@/utils/errors';

export class UploadController {
  uploadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const userId = req.user?.id;
      const folder = (req.query as unknown as UploadQueryDTO).folder || 'documents';

      if (!req.file) {
        throw new ConflictError('No file uploaded. Use multipart field name "file".');
      }

      const uploaded = await storageService.upload(shopId, req.file, folder);

      await AuditService.log({
        shopId,
        userId,
        action: 'file.uploaded',
        entity: 'uploads',
        metadata: {
          key: uploaded.key,
          url: uploaded.url,
          mimeType: uploaded.mimeType,
          size: uploaded.size,
          folder,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });

      sendCreated(res, uploaded);
    } catch (err) {
      next(err);
    }
  };

  deleteFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const userId = req.user?.id;
      const { key } = req.body as DeleteUploadDTO;

      await storageService.delete(shopId, key);

      await AuditService.log({
        shopId,
        userId,
        action: 'file.deleted',
        entity: 'uploads',
        metadata: { key },
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || undefined,
      });

      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  getPresignedUrl = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const { key, expiresIn } = req.query as unknown as PresignQueryDTO;
      const url = await storageService.getPresignedDownloadUrl(shopId, key, expiresIn);
      sendSuccess(res, { key, url, expiresIn });
    } catch (err) {
      next(err);
    }
  };

  getStorageStatus = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, {
        configured: storageService.isConfigured(),
        bucket: 'local-uploads',
      });
    } catch (err) {
      next(err);
    }
  };
}
