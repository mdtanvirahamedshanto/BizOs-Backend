import type { PrismaClient } from '@prisma/client';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { CashbookRepository } from './cashbook.repository';

export class FlexiloadRepository {
  constructor(private prisma: PrismaClient) {}

  // ==========================================
  // FLEXILOAD ACCOUNTS CRUD
  // ==========================================

  async createAccount(
    shopId: string,
    data: {
      operator: 'GP' | 'ROBI' | 'AIRTEL' | 'BL' | 'TELETALK';
      accountNumber: string;
      balanceCents?: number;
      isActive?: boolean;
    }
  ) {
    const existing = await this.prisma.flexiloadAccount.findFirst({
      where: { shopId, operator: data.operator, accountNumber: data.accountNumber },
    });

    if (existing) {
      throw new ConflictError(
        `A Flexiload account for ${data.operator} with number "${data.accountNumber}" already exists in this shop`
      );
    }

    return this.prisma.flexiloadAccount.create({
      data: {
        ...data,
        shopId,
      },
    });
  }

  async updateAccount(
    shopId: string,
    id: string,
    data: {
      accountNumber?: string;
      balanceCents?: number;
      isActive?: boolean;
    }
  ) {
    const account = await this.findAccountById(shopId, id);
    if (!account) {
      throw new NotFoundError('Flexiload Account');
    }

    if (data.accountNumber && data.accountNumber !== account.accountNumber) {
      const existing = await this.prisma.flexiloadAccount.findFirst({
        where: { shopId, operator: account.operator, accountNumber: data.accountNumber },
      });
      if (existing) {
        throw new ConflictError(
          `A Flexiload account for ${account.operator} with number "${data.accountNumber}" already exists in this shop`
        );
      }
    }

    return this.prisma.flexiloadAccount.update({
      where: { id },
      data,
    });
  }

  async findAccountById(shopId: string, id: string) {
    return this.prisma.flexiloadAccount.findFirst({
      where: { id, shopId },
    });
  }

  async listAccounts(shopId: string, operator?: 'GP' | 'ROBI' | 'AIRTEL' | 'BL' | 'TELETALK') {
    return this.prisma.flexiloadAccount.findMany({
      where: {
        shopId,
        operator: operator || undefined,
      },
      orderBy: { operator: 'asc' },
    });
  }

  // ==========================================
  // FLEXILOAD TRANSACTIONS
  // ==========================================

  async createTransaction(
    shopId: string,
    userId: string,
    data: {
      accountId: string;
      recipientPhone: string;
      amountCents: number;
      commissionCents?: number;
      status?: 'PENDING' | 'COMPLETED' | 'FAILED';
      connectionType?: 'PREPAID' | 'POSTPAID';
    }
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch and Lock Flexiload Account
      const account = await tx.flexiloadAccount.findFirst({
        where: { id: data.accountId, shopId, isActive: true },
      });

      if (!account) {
        throw new NotFoundError('Active Flexiload Account');
      }

      const txStatus = data.status || 'COMPLETED';
      let newBalance = account.balanceCents;

      // 2. Check and deduct recharge balance if COMPLETED
      if (txStatus === 'COMPLETED') {
        if (account.balanceCents < data.amountCents) {
          throw new ConflictError(
            `Insufficient SIM recharge balance. Available: ${account.balanceCents} cents. Requested: ${data.amountCents} cents.`
          );
        }
        newBalance = account.balanceCents - data.amountCents;
      }

      // 3. Update SIM balance
      await tx.flexiloadAccount.update({
        where: { id: account.id },
        data: { balanceCents: newBalance },
      });

      // 4. Record FlexiloadTransaction
      const flexiloadTx = await tx.flexiloadTransaction.create({
        data: {
          shopId,
          accountId: account.id,
          recipientPhone: data.recipientPhone,
          amountCents: data.amountCents,
          commissionCents: data.commissionCents || 0,
          status: txStatus,
          connectionType: data.connectionType || 'PREPAID',
          recordedBy: userId,
        },
        include: {
          flexiloadAccount: { select: { operator: true, accountNumber: true } },
          recorder: { select: { name: true } },
        },
      });

      // 5. Create Cashbook inflow entry if status is COMPLETED
      if (txStatus === 'COMPLETED') {
        await CashbookRepository.recordEntry(tx, shopId, {
          type: 'IN',
          amountCents: data.amountCents,
          description: `Flexiload Recharge: ${account.operator} to ${data.recipientPhone} (Tx: ${flexiloadTx.id})`,
          referenceType: 'flexiload',
          referenceId: flexiloadTx.id,
          recordedBy: userId,
        });
      }

      return flexiloadTx;
    });
  }

  async findTransactionById(shopId: string, id: string) {
    return this.prisma.flexiloadTransaction.findFirst({
      where: { id, shopId },
      include: {
        flexiloadAccount: true,
        recorder: { select: { id: true, name: true } },
      },
    });
  }

  async findAndCountTransactions(
    shopId: string,
    options: {
      accountId?: string;
      operator?: 'GP' | 'ROBI' | 'AIRTEL' | 'BL' | 'TELETALK';
      connectionType?: 'PREPAID' | 'POSTPAID';
      status?: 'PENDING' | 'COMPLETED' | 'FAILED';
      startDate?: Date;
      endDate?: Date;
      limit: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ) {
    const whereClause: any = { shopId };

    if (options.accountId) {
      whereClause.accountId = options.accountId;
    }

    if (options.operator) {
      whereClause.flexiloadAccount = { operator: options.operator };
    }

    if (options.connectionType) {
      whereClause.connectionType = options.connectionType;
    }

    if (options.status) {
      whereClause.status = options.status;
    }

    if (options.startDate || options.endDate) {
      whereClause.createdAt = {};
      if (options.startDate) {
        whereClause.createdAt.gte = options.startDate;
      }
      if (options.endDate) {
        whereClause.createdAt.lte = options.endDate;
      }
    }

    const queryOptions: any = {
      where: whereClause,
      take: options.limit,
      orderBy: { [options.sortBy || 'createdAt']: options.sortOrder || 'desc' },
      include: {
        flexiloadAccount: { select: { id: true, operator: true, accountNumber: true } },
        recorder: { select: { id: true, name: true } },
      },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.flexiloadTransaction.findMany(queryOptions),
      this.prisma.flexiloadTransaction.count({ where: whereClause }),
    ]);

    return { data, total };
  }
}
