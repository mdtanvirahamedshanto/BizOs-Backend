import { z } from 'zod';
import { bdPhoneRegex } from './mfs.schema';

export const flexiloadAccountSchema = z.object({
  operator: z.enum(['GP', 'ROBI', 'AIRTEL', 'BL', 'TELETALK']),
  accountNumber: z.string().regex(bdPhoneRegex, 'Invalid Bangladeshi mobile number format'),
  balanceCents: z.number().int().nonnegative('Recharge balance cannot be negative').optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateFlexiloadAccountSchema = flexiloadAccountSchema.partial();

export const flexiloadTransactionSchema = z.object({
  accountId: z.string().uuid('Invalid Flexiload Account ID'),
  recipientPhone: z.string().regex(bdPhoneRegex, 'Invalid recipient mobile number format'),
  amountCents: z.number().int().positive('Recharge amount must be positive'),
  commissionCents: z.number().int().nonnegative('Recharge commission cannot be negative').optional().default(0),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED']).optional().default('COMPLETED'),
  connectionType: z.enum(['PREPAID', 'POSTPAID']).optional().default('PREPAID'),
});

export const flexiloadQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  operator: z.enum(['GP', 'ROBI', 'AIRTEL', 'BL', 'TELETALK']).optional(),
  connectionType: z.enum(['PREPAID', 'POSTPAID']).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED']).optional(),
  startDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  endDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type FlexiloadAccountDTO = z.infer<typeof flexiloadAccountSchema>;
export type UpdateFlexiloadAccountDTO = z.infer<typeof updateFlexiloadAccountSchema>;
export type FlexiloadTransactionDTO = z.infer<typeof flexiloadTransactionSchema>;
export type FlexiloadQueryDTO = z.infer<typeof flexiloadQuerySchema>;
