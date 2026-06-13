import multer from 'multer';
import { ConflictError } from '@/utils/errors';

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

export function createUploadMiddleware(maxFileSizeBytes = DEFAULT_MAX_BYTES) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxFileSizeBytes, files: 1 },
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
