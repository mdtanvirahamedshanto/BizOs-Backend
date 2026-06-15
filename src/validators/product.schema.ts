import { z } from 'zod';

// Category Validation
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(200),
  description: z.string().max(1000).optional().nullable(),
  parentId: z.string().uuid('Invalid parent category ID').optional().nullable(),
  sortOrder: z.coerce.number().int().optional().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

export const categoryQuerySchema = z.object({
  search: z.string().optional(),
  parentId: z.string().uuid().optional().nullable().or(z.literal('null')),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// Product Validation
export const createProductSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
  name: z.string().min(1, 'Product name is required').max(300),
  sku: z.string().min(1, 'SKU is required').max(100),
  barcode: z.string().max(100).optional().nullable(),
  description: z.string().optional().nullable(),
  brand: z.string().max(200).optional().nullable(),
  sellPriceCents: z.number().int().positive('Sell price must be positive'),
  costPriceCents: z.number().int().nonnegative('Cost price must be non-negative').optional().default(0),
  taxRate: z.number().min(0).max(1).optional().default(0),
  unit: z.string().max(20).optional().default('pcs'),
  stockQuantity: z.number().int().nonnegative().optional().default(0),
  lowStockThreshold: z.number().int().nonnegative().optional().default(10),
  images: z.array(z.string().url('Invalid image URL')).optional().default([]),
  isActive: z.boolean().optional().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional().nullable(),
  brand: z.string().optional(),
  barcode: z.string().optional(),
  isActive: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()),
  lowStock: z.preprocess((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  }, z.boolean().optional()),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type CreateCategoryDTO = z.infer<typeof createCategorySchema>;
export type UpdateCategoryDTO = z.infer<typeof updateCategorySchema>;
export type CategoryQueryDTO = z.infer<typeof categoryQuerySchema>;

export type CreateProductDTO = z.infer<typeof createProductSchema>;
export type UpdateProductDTO = z.infer<typeof updateProductSchema>;
export type ProductQueryDTO = z.infer<typeof productQuerySchema>;

export const stockMovementQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

export const stockAdjustmentSchema = z.object({
  type: z.enum(['IN', 'OUT', 'ADJUSTMENT', 'DAMAGE']),
  quantity: z.number().int().positive('Quantity must be positive'),
  notes: z.string().max(1000).optional().nullable(),
});

export type StockMovementQueryDTO = z.infer<typeof stockMovementQuerySchema>;
export type StockAdjustmentDTO = z.infer<typeof stockAdjustmentSchema>;
