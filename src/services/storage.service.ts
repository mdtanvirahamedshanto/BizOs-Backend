import { randomUUID } from 'crypto';
import { env } from '@/env';
import { ConflictError } from '@/utils/errors';
import { createModuleLogger } from '@/config/logger';
import path from 'path';
import fs from 'fs/promises';

const log = createModuleLogger('storage');

export type UploadFolder = 'products' | 'receipts' | 'avatars' | 'documents' | 'attachments';

export interface UploadedFile {
  key: string;
  url: string;
  bucket: string;
  mimeType: string;
  size: number;
  originalName: string;
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

export class StorageService {
  isConfigured(): boolean {
    return true; // Always configured for local storage
  }

  validateMimeType(mimeType: string): void {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new ConflictError(`Unsupported file type: ${mimeType}`);
    }
  }

  buildObjectKey(shopId: string, folder: UploadFolder, originalName: string): string {
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${shopId}/${folder}/${randomUUID()}-${safeName}`;
  }

  assertKeyBelongsToShop(shopId: string, key: string): void {
    if (!key.startsWith(`${shopId}/`)) {
      throw new ConflictError('Access to this file is forbidden');
    }
  }

  getPublicUrl(key: string): string {
    const baseUrl = env.APP_URL.replace(/\/$/, '');
    return `${baseUrl}/uploads/${key}`;
  }

  async upload(
    shopId: string,
    file: Express.Multer.File,
    folder: UploadFolder,
  ): Promise<UploadedFile> {
    this.validateMimeType(file.mimetype);

    const key = this.buildObjectKey(shopId, folder, file.originalname);
    const fullPath = path.join(UPLOADS_DIR, key);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    // Write file to disk
    await fs.writeFile(fullPath, file.buffer);

    log.info({ shopId, key, size: file.size, mimeType: file.mimetype }, 'File uploaded locally');

    return {
      key,
      url: this.getPublicUrl(key),
      bucket: 'local-uploads', // Kept for backwards compatibility
      mimeType: file.mimetype,
      size: file.size,
      originalName: file.originalname,
    };
  }

  async delete(shopId: string, key: string): Promise<void> {
    this.assertKeyBelongsToShop(shopId, key);
    
    const fullPath = path.join(UPLOADS_DIR, key);
    
    try {
      await fs.unlink(fullPath);
      log.info({ shopId, key }, 'File deleted locally');
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      log.warn({ shopId, key }, 'File to delete was not found on disk');
    }
  }

  async getPresignedDownloadUrl(shopId: string, key: string, expiresIn = 3600): Promise<string> {
    this.assertKeyBelongsToShop(shopId, key);
    // For local storage, public URLs are always accessible
    return this.getPublicUrl(key);
  }
}

export const storageService = new StorageService();
