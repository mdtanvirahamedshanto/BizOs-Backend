import { z } from 'zod';
import { addressSchema } from './customer.schema';

export const createSupplierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  company: z.string().max(200).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  address: addressSchema.optional().nullable(),
  paymentTerms: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const supplierQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type CreateSupplierDTO = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierDTO = z.infer<typeof updateSupplierSchema>;
export type SupplierQueryDTO = z.infer<typeof supplierQuerySchema>;
