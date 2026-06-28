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

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

export const expenseCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  color: z.string().regex(hexColorRegex, 'Invalid hex color format (e.g. #FF5722)').optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
});

export const createExpenseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().max(1000).optional().nullable(),
  categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
  amountCents: z.number().int().positive('Amount must be positive'),
  paymentMethod: paymentMethodSchema.optional().default('CASH'),
  receiptUrl: z.string().url('Invalid receipt URL format').or(z.string().length(0)).optional().nullable(),
  expenseDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  isRecurring: z.boolean().optional().default(false),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const createRecurringExpenseSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
  title: z.string().min(1, 'Title is required').max(300),
  description: z.string().max(1000).optional().nullable(),
  amountCents: z.number().int().positive('Amount must be positive'),
  paymentMethod: paymentMethodSchema.optional().default('CASH'),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']),
  startDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date()),
  endDate: z.preprocess((val) => (val ? new Date(val as string) : val), z.date().optional().nullable()),
  isActive: z.boolean().optional().default(true),
});

export const updateRecurringExpenseSchema = createRecurringExpenseSchema.partial();

export const expenseQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  isRecurring: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()),
  startDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  endDate: z.preprocess((val) => (typeof val === 'string' ? new Date(val) : val), z.date().optional()),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const recurringExpenseQuerySchema = z.object({
  isActive: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  cursor: z.string().optional(),
});

export type ExpenseCategoryDTO = z.infer<typeof expenseCategorySchema>;
export type CreateExpenseDTO = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseDTO = z.infer<typeof updateExpenseSchema>;
export type CreateRecurringExpenseDTO = z.infer<typeof createRecurringExpenseSchema>;
export type UpdateRecurringExpenseDTO = z.infer<typeof updateRecurringExpenseSchema>;
export type ExpenseQueryDTO = z.infer<typeof expenseQuerySchema>;
export type RecurringExpenseQueryDTO = z.infer<typeof recurringExpenseQuerySchema>;
