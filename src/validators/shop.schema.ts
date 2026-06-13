import { z } from 'zod';
import { ShopStatus, ShopPlan } from '@prisma/client';

export const shopSettingsSchema = z.object({
  currency: z.string().length(3).default('BDT'),
  timezone: z.string().min(1).default('Asia/Dhaka'),
  businessType: z.enum(['RETAIL', 'WHOLESALE', 'RESTAURANT', 'SERVICE', 'OTHERS']).default('RETAIL'),
  receiptHeader: z.string().max(500).optional(),
  receiptFooter: z.string().max(500).optional(),
  taxId: z.string().max(100).optional(),
});

export const updateShopSchema = z.object({
  name: z.string().min(2, 'Shop name must be at least 2 characters').max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  logo: z.string().url('Invalid logo URL').optional(),
  status: z.nativeEnum(ShopStatus).optional(),
  plan: z.nativeEnum(ShopPlan).optional(),
});

export const updateShopSettingsSchema = z.object({
  settings: shopSettingsSchema,
});

export type UpdateShopDTO = z.infer<typeof updateShopSchema>;
export type UpdateShopSettingsDTO = z.infer<typeof updateShopSettingsSchema>;
