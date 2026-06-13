import type { PrismaClient } from '@prisma/client';
import { ConflictError } from '@/utils/errors';

export class CashbookRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Static transaction helper to record a Cashbook Entry.
   * Locks the tenant/shop row to guarantee serialized execution and correct running balances.
   */
  static async recordEntry(
    tx: any,
    shopId: string,
    data: {
      type: 'IN' | 'OUT';
      amountCents: number;
      description: string;
      referenceType?: string | null;
      referenceId?: string | null;
      paymentId?: string | null;
      recordedBy: string;
      entryDate?: Date;
    }
  ) {
    // 1. Lock the shop row for update to prevent concurrent race conditions on running balance
    await tx.$executeRaw`SELECT id FROM shops WHERE id = ${shopId}::uuid FOR UPDATE`;

    // 2. Get the latest entry to compute the running balance
    const lastEntry = await tx.cashbookEntry.findFirst({
      where: { shopId },
      orderBy: [
        { entryDate: 'desc' },
        { createdAt: 'desc' }
      ],
    });

    const currentBalance = lastEntry ? lastEntry.runningBalanceCents : 0;
    const newBalance = data.type === 'IN' 
      ? currentBalance + data.amountCents 
      : currentBalance - data.amountCents;

    // 3. Create the CashbookEntry
    return tx.cashbookEntry.create({
      data: {
        shopId,
        type: data.type,
        amountCents: data.amountCents,
        runningBalanceCents: newBalance,
        description: data.description,
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        paymentId: data.paymentId,
        recordedBy: data.recordedBy,
        entryDate: data.entryDate || new Date(),
      },
    });
  }

  async getCurrentBalance(shopId: string): Promise<number> {
    const lastEntry = await this.prisma.cashbookEntry.findFirst({
      where: { shopId },
      orderBy: [
        { entryDate: 'desc' },
        { createdAt: 'desc' }
      ],
    });
    return lastEntry ? lastEntry.runningBalanceCents : 0;
  }

  async findAndCountEntries(
    shopId: string,
    options: {
      type?: 'IN' | 'OUT';
      startDate?: Date;
      endDate?: Date;
      limit: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ) {
    const whereClause: any = { shopId };

    if (options.type) {
      whereClause.type = options.type;
    }

    if (options.startDate || options.endDate) {
      whereClause.entryDate = {};
      if (options.startDate) {
        whereClause.entryDate.gte = options.startDate;
      }
      if (options.endDate) {
        whereClause.entryDate.lte = options.endDate;
      }
    }

    const queryOptions: any = {
      where: whereClause,
      take: options.limit,
      orderBy: { [options.sortBy || 'entryDate']: options.sortOrder || 'desc' },
      include: {
        recorder: { select: { id: true, name: true } },
      },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.cashbookEntry.findMany(queryOptions),
      this.prisma.cashbookEntry.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  async getClosingPreview(
    shopId: string,
    dateOnly: Date // YYYY-MM-DD
  ) {
    // Determine the exact boundaries of the day
    const startOfDay = new Date(dateOnly);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date(dateOnly);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // 1. Get the last entry balance BEFORE the start of the day. This represents the opening balance.
    const lastEntryBeforeToday = await this.prisma.cashbookEntry.findFirst({
      where: {
        shopId,
        entryDate: { lt: startOfDay },
      },
      orderBy: [
        { entryDate: 'desc' },
        { createdAt: 'desc' }
      ],
    });

    const openingBalanceCents = lastEntryBeforeToday ? lastEntryBeforeToday.runningBalanceCents : 0;

    // 2. Sum Cash In (IN) today
    const cashInAgg = await this.prisma.cashbookEntry.aggregate({
      _sum: { amountCents: true },
      where: {
        shopId,
        type: 'IN',
        entryDate: { gte: startOfDay, lte: endOfDay },
      },
    });

    // 3. Sum Cash Out (OUT) today
    const cashOutAgg = await this.prisma.cashbookEntry.aggregate({
      _sum: { amountCents: true },
      where: {
        shopId,
        type: 'OUT',
        entryDate: { gte: startOfDay, lte: endOfDay },
      },
    });

    const cashInCents = cashInAgg._sum.amountCents || 0;
    const cashOutCents = cashOutAgg._sum.amountCents || 0;
    const expectedBalanceCents = openingBalanceCents + cashInCents - cashOutCents;

    return {
      closingDate: startOfDay,
      openingBalanceCents,
      cashInCents,
      cashOutCents,
      expectedBalanceCents,
    };
  }

  async recordClosing(
    shopId: string,
    userId: string,
    data: {
      closingDate: Date;
      actualBalanceCents: number;
      notes: string | null;
    }
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Format to Date only
      const closingDate = new Date(data.closingDate);
      closingDate.setUTCHours(0, 0, 0, 0);

      // Check if a closing already exists for this date
      const existing = await tx.dailyClosing.findFirst({
        where: { shopId, closingDate },
      });

      if (existing) {
        throw new ConflictError(`Daily closing has already been submitted for ${closingDate.toISOString().split('T')[0]}`);
      }

      // Re-run preview computation inside the transaction
      // Get last entry balance BEFORE the start of the day
      const startOfDay = new Date(closingDate);
      startOfDay.setUTCHours(0, 0, 0, 0);

      const endOfDay = new Date(closingDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const lastEntryBeforeToday = await tx.cashbookEntry.findFirst({
        where: {
          shopId,
          entryDate: { lt: startOfDay },
        },
        orderBy: [
          { entryDate: 'desc' },
          { createdAt: 'desc' }
        ],
      });

      const openingBalanceCents = lastEntryBeforeToday ? lastEntryBeforeToday.runningBalanceCents : 0;

      // Sum IN/OUT
      const cashInAgg = await tx.cashbookEntry.aggregate({
        _sum: { amountCents: true },
        where: {
          shopId,
          type: 'IN',
          entryDate: { gte: startOfDay, lte: endOfDay },
        },
      });

      const cashOutAgg = await tx.cashbookEntry.aggregate({
        _sum: { amountCents: true },
        where: {
          shopId,
          type: 'OUT',
          entryDate: { gte: startOfDay, lte: endOfDay },
        },
      });

      const cashInCents = cashInAgg._sum.amountCents || 0;
      const cashOutCents = cashOutAgg._sum.amountCents || 0;
      const expectedBalanceCents = openingBalanceCents + cashInCents - cashOutCents;
      const differenceCents = data.actualBalanceCents - expectedBalanceCents;

      // Create DailyClosing
      return tx.dailyClosing.create({
        data: {
          shopId,
          closingDate,
          openingBalanceCents,
          cashInCents,
          cashOutCents,
          expectedBalanceCents,
          actualBalanceCents: data.actualBalanceCents,
          differenceCents,
          notes: data.notes,
          closedBy: userId,
        },
        include: {
          recorder: { select: { id: true, name: true } },
        },
      });
    });
  }

  async findAndCountClosings(
    shopId: string,
    options: {
      limit: number;
      cursor?: string;
    }
  ) {
    const whereClause = { shopId };
    const queryOptions: any = {
      where: whereClause,
      take: options.limit,
      orderBy: { closingDate: 'desc' },
      include: {
        recorder: { select: { id: true, name: true } },
      },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.dailyClosing.findMany(queryOptions),
      this.prisma.dailyClosing.count({ where: whereClause }),
    ]);

    return { data, total };
  }
}
