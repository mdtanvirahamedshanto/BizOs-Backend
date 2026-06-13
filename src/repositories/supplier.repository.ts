import type { PrismaClient } from '@prisma/client';

export class SupplierRepository {
  constructor(private prisma: PrismaClient) {}

  async create(shopId: string, data: any) {
    return this.prisma.supplier.create({
      data: {
        ...data,
        shopId,
      },
    });
  }

  async findById(shopId: string, id: string) {
    return this.prisma.supplier.findFirst({
      where: { id, shopId, deletedAt: null },
    });
  }

  async findByPhone(shopId: string, phone: string) {
    return this.prisma.supplier.findFirst({
      where: { phone, shopId, deletedAt: null },
    });
  }

  async update(_shopId: string, id: string, data: any) {
    return this.prisma.supplier.update({
      where: { id },
      data,
    });
  }

  async softDelete(_shopId: string, id: string) {
    return this.prisma.supplier.update({
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
        { company: { contains: options.search, mode: 'insensitive' } },
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
      this.prisma.supplier.findMany(queryOptions),
      this.prisma.supplier.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  async getPurchaseDue(shopId: string, supplierId: string): Promise<number> {
    const aggregate = await this.prisma.purchase.aggregate({
      _sum: { dueCents: true },
      where: {
        shopId,
        supplierId,
        deletedAt: null,
      },
    });

    return aggregate._sum.dueCents || 0;
  }

  async getKhataAccount(shopId: string, supplierId: string) {
    return this.prisma.khataAccount.findFirst({
      where: {
        shopId,
        partyType: 'SUPPLIER',
        partyId: supplierId,
        isActive: true,
      },
    });
  }

  async findPurchasesAndCount(
    shopId: string,
    supplierId: string,
    options: {
      limit: number;
      cursor?: string;
    },
  ) {
    const whereClause: any = { shopId, supplierId, deletedAt: null };

    const queryOptions: any = {
      where: whereClause,
      take: options.limit,
      orderBy: { purchaseDate: 'desc' },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.purchase.findMany(queryOptions),
      this.prisma.purchase.count({ where: whereClause }),
    ]);

    return { data, total };
  }
}
