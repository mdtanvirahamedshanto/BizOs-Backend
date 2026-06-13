import type { PrismaClient } from '@prisma/client';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { CashbookRepository } from './cashbook.repository';

export class MfsRepository {
  constructor(private prisma: PrismaClient) {}

  // ==========================================
  // MFS ACCOUNTS CRUD
  // ==========================================

  async createAccount(
    shopId: string,
    data: {
      provider: 'BKASH' | 'NAGAD' | 'ROCKET' | 'UPAY';
      accountNumber: string;
      accountType?: 'AGENT' | 'MERCHANT' | 'PERSONAL';
      balanceCents?: number;
      isActive?: boolean;
    }
  ) {
    const existing = await this.prisma.mfsAccount.findFirst({
      where: { shopId, provider: data.provider, accountNumber: data.accountNumber },
    });

    if (existing) {
      throw new ConflictError(
        `An MFS account for ${data.provider} with number "${data.accountNumber}" already exists in this shop`
      );
    }

    return this.prisma.mfsAccount.create({
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
      accountType?: 'AGENT' | 'MERCHANT' | 'PERSONAL';
      balanceCents?: number;
      isActive?: boolean;
    }
  ) {
    const account = await this.findAccountById(shopId, id);
    if (!account) {
      throw new NotFoundError('MFS Account');
    }

    if (data.accountNumber && data.accountNumber !== account.accountNumber) {
      const existing = await this.prisma.mfsAccount.findFirst({
        where: { shopId, provider: account.provider, accountNumber: data.accountNumber },
      });
      if (existing) {
        throw new ConflictError(
          `An MFS account for ${account.provider} with number "${data.accountNumber}" already exists in this shop`
        );
      }
    }

    return this.prisma.mfsAccount.update({
      where: { id },
      data,
    });
  }

  async findAccountById(shopId: string, id: string) {
    return this.prisma.mfsAccount.findFirst({
      where: { id, shopId },
    });
  }

  async listAccounts(shopId: string, provider?: 'BKASH' | 'NAGAD' | 'ROCKET' | 'UPAY') {
    return this.prisma.mfsAccount.findMany({
      where: {
        shopId,
        provider: provider || undefined,
      },
      orderBy: { provider: 'asc' },
    });
  }

  // ==========================================
  // MFS TRANSACTIONS
  // ==========================================

  async createTransaction(
    shopId: string,
    userId: string,
    data: {
      mfsAccountId: string;
      type: 'CASH_IN' | 'CASH_OUT' | 'SEND_MONEY' | 'MERCHANT_PAY' | 'BILL_PAY' | 'ADJUSTMENT';
      customerPhone: string;
      amountCents: number;
      feeCents?: number;
      commissionCents?: number;
      txid?: string | null;
      status?: 'PENDING' | 'COMPLETED' | 'FAILED';
      notes?: string | null;
    }
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch and Lock MFS Account
      const account = await tx.mfsAccount.findFirst({
        where: { id: data.mfsAccountId, shopId, isActive: true },
      });

      if (!account) {
        throw new NotFoundError('Active MFS Account');
      }

      // Check for duplicate TxID if provided to prevent double-posting
      if (data.txid) {
        const dupTx = await tx.mfsTransaction.findFirst({
          where: { shopId, txid: data.txid, status: 'COMPLETED' },
        });
        if (dupTx) {
          throw new ConflictError(`Transaction with TxID "${data.txid}" has already been processed`);
        }
      }

      const txStatus = data.status || 'COMPLETED';
      let newBalance = account.balanceCents;

      // 2. Adjust digital MFS wallet balances if transaction is COMPLETED
      if (txStatus === 'COMPLETED') {
        if (data.type === 'CASH_IN' || data.type === 'SEND_MONEY' || data.type === 'MERCHANT_PAY' || data.type === 'BILL_PAY') {
          // Digital balance leaves the wallet
          if (account.balanceCents < data.amountCents) {
            throw new ConflictError(
              `Insufficient digital MFS wallet balance. Available: ${account.balanceCents} cents. Requested: ${data.amountCents} cents.`
            );
          }
          newBalance = account.balanceCents - data.amountCents;
        } else if (data.type === 'CASH_OUT') {
          // Digital balance enters the wallet (customer pays MFS, shop pays physical cash)
          newBalance = account.balanceCents + data.amountCents;
        } else if (data.type === 'ADJUSTMENT') {
          // Adjustment can be negative or positive, here we assume data.amountCents is the final change
          newBalance = account.balanceCents + data.amountCents;
        }
      }

      // 3. Update MFS Account balance
      await tx.mfsAccount.update({
        where: { id: account.id },
        data: { balanceCents: newBalance },
      });

      // 4. Create MfsTransaction record
      const mfsTx = await tx.mfsTransaction.create({
        data: {
          shopId,
          mfsAccountId: account.id,
          type: data.type,
          customerPhone: data.customerPhone,
          amountCents: data.amountCents,
          feeCents: data.feeCents || 0,
          commissionCents: data.commissionCents || 0,
          txid: data.txid || null,
          status: txStatus,
          notes: data.notes || null,
          recordedBy: userId,
        },
        include: {
          mfsAccount: { select: { provider: true, accountNumber: true } },
          recorder: { select: { name: true } },
        },
      });

      // 5. Integrate Cashbook entries for CASH flows if transaction is COMPLETED
      if (txStatus === 'COMPLETED') {
        if (data.type === 'CASH_IN') {
          // Shop receives physical cash from customer to send digital money
          await CashbookRepository.recordEntry(tx, shopId, {
            type: 'IN',
            amountCents: data.amountCents + (data.feeCents || 0),
            description: `MFS Cash In: ${account.provider} to ${data.customerPhone} (Tx: ${mfsTx.id})`,
            referenceType: 'mfs',
            referenceId: mfsTx.id,
            recordedBy: userId,
          });
        } else if (data.type === 'CASH_OUT') {
          // Customer sends digital money, shop gives physical cash to customer
          await CashbookRepository.recordEntry(tx, shopId, {
            type: 'OUT',
            amountCents: data.amountCents,
            description: `MFS Cash Out: ${account.provider} from ${data.customerPhone} (Tx: ${mfsTx.id})`,
            referenceType: 'mfs',
            referenceId: mfsTx.id,
            recordedBy: userId,
          });
        }
      }

      return mfsTx;
    });
  }

  async findTransactionById(shopId: string, id: string) {
    return this.prisma.mfsTransaction.findFirst({
      where: { id, shopId },
      include: {
        mfsAccount: true,
        recorder: { select: { id: true, name: true } },
      },
    });
  }

  async findAndCountTransactions(
    shopId: string,
    options: {
      mfsAccountId?: string;
      provider?: 'BKASH' | 'NAGAD' | 'ROCKET' | 'UPAY';
      type?: 'CASH_IN' | 'CASH_OUT' | 'SEND_MONEY' | 'MERCHANT_PAY' | 'BILL_PAY' | 'ADJUSTMENT';
      startDate?: Date;
      endDate?: Date;
      limit: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ) {
    const whereClause: any = { shopId };

    if (options.mfsAccountId) {
      whereClause.mfsAccountId = options.mfsAccountId;
    }

    if (options.provider) {
      whereClause.mfsAccount = { provider: options.provider };
    }

    if (options.type) {
      whereClause.type = options.type;
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
        mfsAccount: { select: { id: true, provider: true, accountNumber: true } },
        recorder: { select: { id: true, name: true } },
      },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.mfsTransaction.findMany(queryOptions),
      this.prisma.mfsTransaction.count({ where: whereClause }),
    ]);

    return { data, total };
  }
}
