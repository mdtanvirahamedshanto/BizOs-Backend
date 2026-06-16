import { z } from 'zod';

export const inviteUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(20).optional().nullable(),
  roleId: z.string().uuid('Invalid role ID'),
});

export const updateUserRoleSchema = inviteUserSchema.partial();
