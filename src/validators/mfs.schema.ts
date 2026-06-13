import { z } from 'zod';

export const bdPhoneRegex = /^(?:\+?88)?01[3-9]\d{8}$/;

export const mfsAccountSchema = z.object({
  provider: z.enum(['BKASH', 'NAGAD', 'ROCKET', 'UPAY']),
  accountNumber: z.string().regex(bdPhoneRegex, 'Invalid Bangladeshi mobile number format'),
  accountType: z.enum(['AGENT', 'MERCHANT', 'PERSONAL']).optional().default('AGENT'),
  balanceCents: z.number().int().nonnegative('Balance cannot be negative').optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateMfsAccountSchema = mfsAccountSchema.partial();

export const mfsTransactionSchema = z.object({
  mfsAccountId: z.string().uuid('Invalid MFS Account ID'),
  type: z.enum(['CASH_IN', 'CASH_OUT', 'SEND_MONEY', 'MERCHANT_PAY', 'BILL_PAY', 'ADJUSTMENT']),
  customerPhone: z.string().regex(bdPhoneRegex, 'Invalid customer mobile number format'),
  amountCents: z.number().int().positive('Transaction amount must be positive'),
  feeCents: z.number().int().nonnegative('Customer fee cannot be negative').optional().default(0),
  commissionCents: z.number().int().nonnegative('Agent commission cannot be negative').optional().default(0),
  txid: z.string().max(100).optional().nullable(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED']).optional().default('COMPLETED'),
  notes: z.string().max(500).optional().nullable(),
});

export const mfsQuerySchema = z.object({
  mfsAccountId: z.string().uuid().optional(),
  provider: z.enum(['BKASH', 'NAGAD', 'ROCKET', 'UPAY']).optional(),
  type: z.enum(['CASH_IN', 'CASH_OUT', 'SEND_MONEY', 'MERCHANT_PAY', 'BILL_PAY', 'ADJUSTMENT']).optional(),
  startDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  endDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type MfsAccountDTO = z.infer<typeof mfsAccountSchema>;
export type UpdateMfsAccountDTO = z.infer<typeof updateMfsAccountSchema>;
export type MfsTransactionDTO = z.infer<typeof mfsTransactionSchema>;
export type MfsQueryDTO = z.infer<typeof mfsQuerySchema>;
