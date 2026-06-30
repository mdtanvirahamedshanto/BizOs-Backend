import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

export class ReportsRepository {
  constructor(private prisma: PrismaClient) {}

  private salesDateFilter(startDate?: Date, endDate?: Date) {
    if (!startDate && !endDate) {
      return undefined;
    }

    const filter: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      filter.gte = startDate;
    }
    if (endDate) {
      filter.lte = endDate;
    }
    return filter;
  }

  async getSalesData(shopId: string, startDate?: Date, endDate?: Date) {
    const saleDate = this.salesDateFilter(startDate, endDate);

    return this.prisma.sale.findMany({
      where: {
        shopId,
        deletedAt: null,
        status: 'COMPLETED',
        ...(saleDate && { saleDate }),
      },
      select: {
        id: true,
        invoiceNumber: true,
        saleDate: true,
        subtotalCents: true,
        discountCents: true,
        taxCents: true,
        totalCents: true,
        paidCents: true,
        dueCents: true,
      },
      orderBy: { saleDate: 'asc' },
    });
  }

  async getSalesAggregates(shopId: string, startDate?: Date, endDate?: Date) {
    const saleDate = this.salesDateFilter(startDate, endDate);

    const result = await this.prisma.sale.aggregate({
      where: {
        shopId,
        deletedAt: null,
        status: 'COMPLETED',
        ...(saleDate && { saleDate }),
      },
      _sum: {
        totalCents: true,
        taxCents: true,
        discountCents: true,
      },
      _count: { id: true },
    });

    return {
      revenueCents: result._sum.totalCents ?? 0,
      taxCents: result._sum.taxCents ?? 0,
      discountCents: result._sum.discountCents ?? 0,
      saleCount: result._count.id,
    };
  }

  async getCOGSCents(shopId: string, startDate?: Date, endDate?: Date): Promise<number> {
    const conditions: Prisma.Sql[] = [
      Prisma.sql`s.shop_id = ${shopId}::uuid`,
      Prisma.sql`s.deleted_at IS NULL`,
      Prisma.sql`s.status = 'COMPLETED'::"SaleStatus"`,
    ];

    if (startDate) {
      conditions.push(Prisma.sql`s.sale_date >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(Prisma.sql`s.sale_date <= ${endDate}`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');

    const result = await this.prisma.$queryRaw<[{ sum: bigint | null }]>`
      SELECT COALESCE(SUM(si.quantity * p.cost_price_cents), 0) AS sum
      FROM sale_items si
      INNER JOIN sales s ON s.id = si.sale_id
      INNER JOIN products p ON p.id = si.product_id
      WHERE ${whereClause}
    `;

    return Number(result[0]?.sum ?? 0);
  }

  async getExpenseTotalCents(shopId: string, startDate?: Date, endDate?: Date): Promise<number> {
    const expenseDate = this.salesDateFilter(startDate, endDate);

    const result = await this.prisma.expense.aggregate({
      where: {
        shopId,
        deletedAt: null,
        ...(expenseDate && { expenseDate }),
      },
      _sum: { amountCents: true },
    });

    return result._sum.amountCents ?? 0;
  }

  async getPurchaseTotalCents(shopId: string, startDate?: Date, endDate?: Date): Promise<number> {
    const purchaseDate = this.salesDateFilter(startDate, endDate);

    const result = await this.prisma.purchase.aggregate({
      where: {
        shopId,
        deletedAt: null,
        status: { in: ['ORDERED', 'RECEIVED'] },
        ...(purchaseDate && { purchaseDate: purchaseDate as any }), // date filter uses purchaseDate
      },
      _sum: { totalCents: true },
    });

    return result._sum.totalCents ?? 0;
  }

  /** @deprecated Prefer getCOGSCents for aggregate COGS — loads all line items into memory. */
  async getCOGSData(shopId: string, startDate?: Date, endDate?: Date) {
    const saleDate = this.salesDateFilter(startDate, endDate);

    return this.prisma.saleItem.findMany({
      where: {
        sale: {
          shopId,
          deletedAt: null,
          status: 'COMPLETED',
          ...(saleDate && { saleDate }),
        },
      },
      select: {
        quantity: true,
        product: {
          select: { costPriceCents: true },
        },
      },
    });
  }

  async getExpensesData(shopId: string, startDate?: Date, endDate?: Date) {
    const expenseDate = this.salesDateFilter(startDate, endDate);

    return this.prisma.expense.findMany({
      where: {
        shopId,
        deletedAt: null,
        ...(expenseDate && { expenseDate }),
      },
      select: {
        id: true,
        title: true,
        amountCents: true,
        expenseDate: true,
        categoryId: true,
        category: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { expenseDate: 'asc' },
    });
  }

  async getPurchasesData(shopId: string, startDate?: Date, endDate?: Date) {
    const purchaseDate = this.salesDateFilter(startDate, endDate);

    return this.prisma.purchase.findMany({
      where: {
        shopId,
        deletedAt: null,
        status: { in: ['ORDERED', 'RECEIVED'] },
        ...(purchaseDate && { purchaseDate: purchaseDate as any }),
      },
      select: {
        id: true,
        referenceNumber: true,
        totalCents: true,
        purchaseDate: true,
      },
      orderBy: { purchaseDate: 'asc' },
    });
  }

  async getInventoryValuation(shopId: string) {
    return this.prisma.product.findMany({
      where: {
        shopId,
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQuantity: true,
        lowStockThreshold: true,
        costPriceCents: true,
        sellPriceCents: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getDuesData(shopId: string) {
    const [customerAccounts, supplierAccounts] = await Promise.all([
      this.prisma.khataAccount.findMany({
        where: {
          shopId,
          partyType: 'CUSTOMER',
          balanceCents: { gt: 0 },
          isActive: true,
        },
        include: {
          customer: {
            select: { id: true, name: true, phone: true },
          },
        },
        orderBy: { balanceCents: 'desc' },
      }),
      this.prisma.khataAccount.findMany({
        where: {
          shopId,
          partyType: 'SUPPLIER',
          balanceCents: { lt: 0 },
          isActive: true,
        },
        include: {
          supplier: {
            select: { id: true, name: true, phone: true, company: true },
          },
        },
        orderBy: { balanceCents: 'asc' },
      }),
    ]);

    return { customerAccounts, supplierAccounts };
  }

  async getRecentSales(shopId: string, limit: number) {
    return this.prisma.sale.findMany({
      where: {
        shopId,
        deletedAt: null,
        status: 'COMPLETED',
      },
      select: {
        id: true,
        invoiceNumber: true,
        totalCents: true,
        paidCents: true,
        dueCents: true,
        paymentStatus: true,
        saleDate: true,
        customer: {
          select: { id: true, name: true },
        },
      },
      orderBy: { saleDate: 'desc' },
      take: limit,
    });
  }

  async getRecentPayments(shopId: string, limit: number) {
    return this.prisma.payment.findMany({
      where: { shopId },
      select: {
        id: true,
        type: true,
        method: true,
        amountCents: true,
        payableType: true,
        paidAt: true,
        recorder: {
          select: { id: true, name: true },
        },
      },
      orderBy: { paidAt: 'desc' },
      take: limit,
    });
  }

  async getRecentExpenses(shopId: string, limit: number) {
    return this.prisma.expense.findMany({
      where: {
        shopId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        amountCents: true,
        expenseDate: true,
        category: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: { expenseDate: 'desc' },
      take: limit,
    });
  }

  async getCashbookBalance(shopId: string): Promise<number> {
    const lastEntry = await this.prisma.cashbookEntry.findFirst({
      where: { shopId },
      orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
    });
    return lastEntry?.runningBalanceCents ?? 0;
  }

  async getMfsBalance(shopId: string): Promise<number> {
    const result = await this.prisma.mfsAccount.aggregate({
      _sum: { balanceCents: true },
      where: { shopId, isActive: true },
    });
    return result._sum.balanceCents ?? 0;
  }

  async getFlexiloadBalance(shopId: string): Promise<number> {
    const result = await this.prisma.flexiloadAccount.aggregate({
      _sum: { balanceCents: true },
      where: { shopId, isActive: true },
    });
    return result._sum.balanceCents ?? 0;
  }
}
