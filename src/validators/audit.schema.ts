import { z } from 'zod';

const isoDatePreprocess = z.preprocess(
  (val) => (typeof val === 'string' ? new Date(val) : val),
  z.date().optional(),
);

export const auditQuerySchema = z.object({
  action: z.string().max(100).optional(),
  entity: z.string().max(50).optional(),
  entityId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  startDate: isoDatePreprocess,
  endDate: isoDatePreprocess,
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  sortBy: z.enum(['createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export type AuditQueryDTO = z.infer<typeof auditQuerySchema>;
