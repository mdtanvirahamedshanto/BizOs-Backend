import { z } from 'zod';

export const manualCashEntrySchema = z.object({
  amountCents: z.number().int().positive('Amount must be a positive integer'),
  description: z.string().min(1, 'Description is required').max(500),
  reference: z.string().max(200).optional().nullable(),
});

export const dailyClosingSchema = z.object({
  actualBalanceCents: z.number().int().nonnegative('Actual balance cannot be negative'),
  notes: z.string().max(1000).optional().nullable(),
});

export const cashbookQuerySchema = z.object({
  type: z.enum(['IN', 'OUT']).optional(),
  startDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  endDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type ManualCashEntryDTO = z.infer<typeof manualCashEntrySchema>;
export type DailyClosingDTO = z.infer<typeof dailyClosingSchema>;
export type CashbookQueryDTO = z.infer<typeof cashbookQuerySchema>;
