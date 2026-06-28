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

export const createPaymentSchema = z.object({
  payableType: z.enum(['sale', 'purchase', 'khata']),
  payableId: z.string().uuid('Invalid payable ID'),
  amountCents: z.number().int().positive('Payment amount must be greater than zero'),
  method: paymentMethodSchema,
  reference: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const paymentQuerySchema = z.object({
  payableType: z.enum(['sale', 'purchase', 'khata']).optional(),
  payableId: z.string().uuid('Invalid payable ID').optional(),
  type: z.enum(['RECEIVED', 'MADE']).optional(),
  method: paymentMethodSchema.optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const refundPaymentSchema = z.object({
  notes: z.string().max(1000).optional().nullable(),
});

export type CreatePaymentDTO = z.infer<typeof createPaymentSchema>;
export type PaymentQueryDTO = z.infer<typeof paymentQuerySchema>;
export type RefundPaymentDTO = z.infer<typeof refundPaymentSchema>;
