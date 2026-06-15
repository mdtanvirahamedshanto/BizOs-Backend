import { z } from 'zod';

const paymentMethodSchema = z.enum([
  'CASH',
  'BKASH',
  'NAGAD',
  'ROCKET',
  'BANK',
  'CARD',
  'CHECK',
  'OTHER',
]);

export const khataQuerySchema = z.object({
  partyType: z.enum(['CUSTOMER', 'SUPPLIER']).optional(),
  isActive: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const khataEntryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export const createCollectionSchema = z.object({
  amountCents: z.number().int().positive('Collection amount must be positive'),
  method: paymentMethodSchema,
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const createRepaymentSchema = z.object({
  amountCents: z.number().int().positive('Repayment amount must be positive'),
  method: paymentMethodSchema,
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const khataAdjustmentSchema = z.object({
  type: z.enum(['CREDIT', 'DEBIT', 'ADJUSTMENT']),
  amountCents: z.number().int().positive('Adjustment amount must be positive'),
  description: z.string().min(1, 'Description is required').max(500),
});

export const ensureKhataAccountSchema = z.object({
  partyType: z.enum(['CUSTOMER', 'SUPPLIER']),
  partyId: z.string().uuid('Invalid party ID'),
});

export type KhataQueryDTO = z.infer<typeof khataQuerySchema>;
export type KhataEntryQueryDTO = z.infer<typeof khataEntryQuerySchema>;
export type CreateCollectionDTO = z.infer<typeof createCollectionSchema>;
export type CreateRepaymentDTO = z.infer<typeof createRepaymentSchema>;
export type KhataAdjustmentDTO = z.infer<typeof khataAdjustmentSchema>;
export type EnsureKhataAccountDTO = z.infer<typeof ensureKhataAccountSchema>;
