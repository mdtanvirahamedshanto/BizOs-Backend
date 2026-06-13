import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { env } from '@/env';
import { ConflictError } from '@/utils/errors';
import { createModuleLogger } from '@/config/logger';

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
  private client: S3Client | null = null;

  private getClient(): S3Client {
    if (!this.isConfigured()) {
      throw new ConflictError('File storage is not configured. Set STORAGE_* environment variables.');
    }

    if (!this.client) {
      this.client = new S3Client({
        region: env.STORAGE_REGION,
        endpoint: env.STORAGE_ENDPOINT,
        forcePathStyle: true,
        credentials: {
          accessKeyId: env.STORAGE_ACCESS_KEY!,
          secretAccessKey: env.STORAGE_SECRET_KEY!,
        },
      });
    }

    return this.client;
  }

  isConfigured(): boolean {
    return Boolean(
      env.STORAGE_ENDPOINT &&
        env.STORAGE_ACCESS_KEY &&
        env.STORAGE_SECRET_KEY &&
        env.STORAGE_BUCKET,
    );
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
    if (env.STORAGE_PUBLIC_BASE_URL) {
      return `${env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
    }

    const endpoint = env.STORAGE_ENDPOINT!.replace(/\/$/, '');
    return `${endpoint}/${env.STORAGE_BUCKET}/${key}`;
  }

  async upload(
    shopId: string,
    file: Express.Multer.File,
    folder: UploadFolder,
  ): Promise<UploadedFile> {
    this.validateMimeType(file.mimetype);

    const key = this.buildObjectKey(shopId, folder, file.originalname);
    const client = this.getClient();

    await client.send(
      new PutObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }),
    );

    log.info({ shopId, key, size: file.size, mimeType: file.mimetype }, 'File uploaded');

    return {
      key,
      url: this.getPublicUrl(key),
      bucket: env.STORAGE_BUCKET,
      mimeType: file.mimetype,
      size: file.size,
      originalName: file.originalname,
    };
  }

  async delete(shopId: string, key: string): Promise<void> {
    this.assertKeyBelongsToShop(shopId, key);
    const client = this.getClient();

    await client.send(
      new DeleteObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: key,
      }),
    );

    log.info({ shopId, key }, 'File deleted');
  }

  async getPresignedDownloadUrl(shopId: string, key: string, expiresIn = 3600): Promise<string> {
    this.assertKeyBelongsToShop(shopId, key);
    const client = this.getClient();

    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: env.STORAGE_BUCKET,
        Key: key,
      }),
      { expiresIn },
    );
  }
}

export const storageService = new StorageService();
