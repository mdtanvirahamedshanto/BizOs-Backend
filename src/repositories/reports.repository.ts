import type { PrismaClient } from '@prisma/client';

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
