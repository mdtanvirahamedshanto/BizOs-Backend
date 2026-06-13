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

export const createPurchaseItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  unitCostCents: z.number().int().nonnegative('Unit cost must be non-negative'),
});

export const createPurchaseSchema = z.object({
  supplierId: z.string().uuid('Invalid supplier ID').optional().nullable(),
  purchaseDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  expectedDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  status: z.enum(['DRAFT', 'ORDERED', 'RECEIVED']).optional().default('RECEIVED'),
  taxCents: z.number().int().nonnegative().optional().default(0),
  discountCents: z.number().int().nonnegative().optional().default(0),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(createPurchaseItemSchema).nonempty('At least one item must be purchased'),
  payment: z
    .object({
      amountCents: z.number().int().nonnegative('Amount must be non-negative'),
      method: paymentMethodSchema,
      reference: z.string().max(200).optional().nullable(),
    })
    .optional(),
});

export const updatePurchaseSchema = z.object({
  status: z.enum(['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED']).optional(),
  expectedDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  receivedDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  notes: z.string().max(1000).optional().nullable(),
});

export const purchaseQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'ORDERED', 'RECEIVED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID', 'OVERPAID']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const returnPurchaseItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
});

export const returnPurchaseSchema = z.object({
  items: z.array(returnPurchaseItemSchema).optional(),
  refundAmountCents: z.number().int().nonnegative().optional().default(0),
  notes: z.string().max(1000).optional().nullable(),
});

export type CreatePurchaseDTO = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseDTO = z.infer<typeof updatePurchaseSchema>;
export type PurchaseQueryDTO = z.infer<typeof purchaseQuerySchema>;
export type ReturnPurchaseDTO = z.infer<typeof returnPurchaseSchema>;
