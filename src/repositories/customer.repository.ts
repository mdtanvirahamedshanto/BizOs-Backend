import type { PrismaClient } from '@prisma/client';

export class CustomerRepository {
  constructor(private prisma: PrismaClient) {}

  async create(shopId: string, data: any) {
    return this.prisma.customer.create({
      data: {
        ...data,
        shopId,
      },
    });
  }

  async findById(shopId: string, id: string) {
    return this.prisma.customer.findFirst({
      where: { id, shopId, deletedAt: null },
    });
  }

  async findByPhone(shopId: string, phone: string) {
    return this.prisma.customer.findFirst({
      where: { phone, shopId, deletedAt: null },
    });
  }

  async update(_shopId: string, id: string, data: any) {
    return this.prisma.customer.update({
      where: { id },
      data,
    });
  }

  async softDelete(_shopId: string, id: string) {
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findAndCount(
    shopId: string,
    options: {
      search?: string;
      limit: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const whereClause: any = { shopId, deletedAt: null };

    if (options.search) {
      whereClause.OR = [
        { name: { contains: options.search, mode: 'insensitive' } },
        { phone: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const queryOptions: any = {
      where: whereClause,
      take: options.limit,
      orderBy: { [options.sortBy || 'createdAt']: options.sortOrder || 'desc' },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany(queryOptions),
      this.prisma.customer.count({ where: whereClause }),
    ]);

    return { data, total };
  }
}
