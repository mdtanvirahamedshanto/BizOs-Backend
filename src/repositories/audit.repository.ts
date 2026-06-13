import type { PrismaClient } from '@prisma/client';

export class AuditRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(shopId: string, id: string) {
    return this.prisma.auditLog.findFirst({
      where: { id, shopId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findAndCount(
    shopId: string,
    options: {
      action?: string;
      entity?: string;
      entityId?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      limit: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const whereClause: Record<string, unknown> = { shopId };

    if (options.action) {
      whereClause.action = { contains: options.action, mode: 'insensitive' };
    }

    if (options.entity) {
      whereClause.entity = options.entity;
    }

    if (options.entityId) {
      whereClause.entityId = options.entityId;
    }

    if (options.userId) {
      whereClause.userId = options.userId;
    }

    if (options.startDate || options.endDate) {
      whereClause.createdAt = {};
      if (options.startDate) {
        (whereClause.createdAt as Record<string, Date>).gte = options.startDate;
      }
      if (options.endDate) {
        (whereClause.createdAt as Record<string, Date>).lte = options.endDate;
      }
    }

    const queryOptions: Record<string, unknown> = {
      where: whereClause,
      take: options.limit,
      orderBy: { [options.sortBy || 'createdAt']: options.sortOrder || 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany(queryOptions as any),
      this.prisma.auditLog.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  async listDistinctActions(shopId: string): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { shopId },
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    return rows.map((row) => row.action);
  }
}
