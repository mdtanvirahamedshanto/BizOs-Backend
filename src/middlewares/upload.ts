import multer from 'multer';
import { ConflictError } from '@/utils/errors';
import { env } from '@/env';

const maxFileSizeBytes = env.UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024;

export function createUploadMiddleware(maxFileSizeBytesOverride = maxFileSizeBytes) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSizeBytesOverride, files: 1 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
      if (!allowed.includes(file.mimetype)) {
        cb(new ConflictError(`Unsupported file type: ${file.mimetype}`));
        return;
      }
      cb(null, true);
    },
  });
}

export const uploadMiddleware = createUploadMiddleware();
