import { prisma } from '@/prisma/client';
import { Prisma } from '@prisma/client';
import { logger } from '@/config/logger';

export interface AuditLogPayload {
  shopId: string;
  userId?: string;
  action: string;
  entity?: string;
  entityId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export class AuditService {
  /**
   * Log an audit event to the database and the rotating Winston audit log file.
   */
  static async log(payload: AuditLogPayload): Promise<void> {
    try {
      // 1. Write to Winston rotating audit file
      logger.audit(payload.action, {
        shopId: payload.shopId,
        userId: payload.userId,
        entity: payload.entity,
        entityId: payload.entityId,
        ipAddress: payload.ipAddress,
        userAgent: payload.userAgent,
        metadata: payload.metadata,
        // Keep file logs compact but structured
        changes: payload.newValues ? { old: payload.oldValues, new: payload.newValues } : undefined,
      });

      // 2. Write to PostgreSQL database
      await prisma.auditLog.create({
        data: {
          shopId: payload.shopId,
          userId: payload.userId || null,
          action: payload.action,
          entity: payload.entity || null,
          entityId: payload.entityId || null,
          oldValues: payload.oldValues ? (payload.oldValues as any) : Prisma.JsonNull,
          newValues: payload.newValues ? (payload.newValues as any) : Prisma.JsonNull,
          ipAddress: payload.ipAddress || null,
          userAgent: payload.userAgent || null,
          metadata: payload.metadata ? (payload.metadata as any) : Prisma.JsonNull,
        },
      });
    } catch (err) {
      // Don't let audit logging failures crash the main application process
      logger.error({ err, payload }, 'Failed to write audit log');
    }
  }
}
