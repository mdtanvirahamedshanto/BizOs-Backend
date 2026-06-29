import multer from 'multer';
import { ConflictError } from '@/utils/errors';
import { env } from '@/env';
import fileType from 'file-type';
import type { Request, Response, NextFunction } from 'express';

const maxFileSizeBytes = env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024;

export function createUploadMiddleware(maxFileSizeBytesOverride = maxFileSizeBytes) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSizeBytesOverride, files: 1 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
      if (!allowed.includes(file.mimetype)) {
        cb(new ConflictError(`Unsupported file type from client: ${file.mimetype}`));
        return;
      }
      cb(null, true);
    },
  });

  return [
    upload.single('file'), // assumes field name is 'file'
    async (req: Request, _res: Response, next: NextFunction) => {
      if (!req.file) {
        return next();
      }
      // Magic number check
      const type = await fileType.fromBuffer(req.file.buffer);
      if (!type) {
        return next(new ConflictError('Could not determine file type'));
      }
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
      if (!allowed.includes(type.mime)) {
        return next(new ConflictError(`Invalid file content detected: ${type.mime}`));
      }
      next();
    }
  ];
}

export const uploadMiddleware = createUploadMiddleware();
