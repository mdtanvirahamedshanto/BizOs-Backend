import { z } from 'zod';

export const addressSchema = z.object({
  street: z.string().optional(),
  area: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
});

export const attachmentSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  url: z.string().url('Invalid attachment URL'),
  sizeBytes: z.number().int().positive().optional(),
  mimeType: z.string().optional(),
  uploadedAt: z.string().datetime().optional().default(() => new Date().toISOString()),
});

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  address: addressSchema.optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  notes: z.string().max(2000).optional().nullable(),
  attachments: z.array(attachmentSchema).optional().default([]),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type CreateCustomerDTO = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerDTO = z.infer<typeof updateCustomerSchema>;
export type CustomerQueryDTO = z.infer<typeof customerQuerySchema>;
