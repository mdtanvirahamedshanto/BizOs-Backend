import { z } from 'zod';

export const uploadFolderSchema = z.enum(['products', 'receipts', 'avatars', 'documents', 'attachments']);

export const uploadQuerySchema = z.object({
  folder: uploadFolderSchema.optional().default('documents'),
});

export type UploadQueryDTO = z.infer<typeof uploadQuerySchema>;

export const deleteUploadSchema = z.object({
  key: z.string().min(1, 'Storage key is required'),
});

export type DeleteUploadDTO = z.infer<typeof deleteUploadSchema>;

export const presignQuerySchema = z.object({
  key: z.string().min(1, 'Storage key is required'),
  expiresIn: z.coerce.number().int().min(60).max(86400).optional().default(3600),
});

export type PresignQueryDTO = z.infer<typeof presignQuerySchema>;
