import { randomUUID } from 'crypto';
import { env } from '@/env';
import { ConflictError } from '@/utils/errors';
import { createModuleLogger } from '@/config/logger';
import { v2 as cloudinary } from 'cloudinary';

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

export class StorageService {
  private configured = false;

  constructor() {
    if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
      });
      this.configured = true;
    }
  }

  isConfigured(): boolean {
    return this.configured;
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

  async upload(
    shopId: string,
    file: Express.Multer.File,
    folder: UploadFolder,
  ): Promise<UploadedFile> {
    if (!this.isConfigured()) {
      throw new ConflictError('Cloudinary is not configured in this environment.');
    }

    this.validateMimeType(file.mimetype);
    const key = this.buildObjectKey(shopId, folder, file.originalname);

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: key,
          resource_type: 'auto',
        },
        (error, result) => {
          if (error || !result) {
            log.error({ err: error }, 'Cloudinary upload failed');
            return reject(new Error('Cloudinary upload failed'));
          }

          log.info({ shopId, key, size: file.size, mimeType: file.mimetype }, 'File uploaded to Cloudinary');

          resolve({
            key: result.public_id,
            url: result.secure_url,
            bucket: 'cloudinary',
            mimeType: file.mimetype,
            size: file.size,
            originalName: file.originalname,
          });
        }
      );

      uploadStream.end(file.buffer);
    });
  }

  async delete(shopId: string, key: string): Promise<void> {
    if (!this.isConfigured()) return;
    this.assertKeyBelongsToShop(shopId, key);
    
    try {
      await cloudinary.uploader.destroy(key);
      log.info({ shopId, key }, 'File deleted from Cloudinary');
    } catch (error) {
      log.error({ err: error, shopId, key }, 'Failed to delete file from Cloudinary');
    }
  }

  async getPresignedDownloadUrl(shopId: string, key: string, _expiresIn = 3600): Promise<string> {
    this.assertKeyBelongsToShop(shopId, key);
    // Cloudinary URLs are public by default when returning secure_url.
    // If you need signed URLs, cloudinary.url(key, { sign_url: true }) can be used.
    // We'll just return the public URL for now.
    return cloudinary.url(key, { secure: true });
  }
}

export const storageService = new StorageService();
