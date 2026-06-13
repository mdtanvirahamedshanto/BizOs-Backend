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

export const createSaleItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  discountValue: z.number().int().nonnegative().optional().default(0),
});

export const createSaleSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID').optional().nullable(),
  saleDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  discountValue: z.number().int().nonnegative().optional().default(0),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(createSaleItemSchema).nonempty('At least one item must be sold'),
  payment: z
    .object({
      amountCents: z.number().int().nonnegative('Amount must be non-negative'),
      method: paymentMethodSchema,
      reference: z.string().max(200).optional().nullable(),
    })
    .optional(),
});

export const saleQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'COMPLETED', 'RETURNED', 'VOID']).optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID', 'OVERPAID']).optional(),
  startDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  endDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const returnSaleItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
});

export const returnSaleSchema = z.object({
  items: z.array(returnSaleItemSchema).optional(),
  refundAmountCents: z.number().int().nonnegative().optional().default(0),
  notes: z.string().max(1000).optional().nullable(),
});

export type CreateSaleDTO = z.infer<typeof createSaleSchema>;
export type SaleQueryDTO = z.infer<typeof saleQuerySchema>;
export type ReturnSaleDTO = z.infer<typeof returnSaleSchema>;
