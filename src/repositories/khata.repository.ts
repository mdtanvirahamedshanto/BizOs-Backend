import type { PrismaClient } from '@prisma/client';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { CashbookRepository } from './cashbook.repository';

export class KhataRepository {
  constructor(private prisma: PrismaClient | any) {}

  async findAndCountAccounts(
    shopId: string,
    options: {
      partyType?: 'CUSTOMER' | 'SUPPLIER';
      isActive?: boolean;
      limit: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const whereClause: any = { shopId };

    if (options.partyType) {
      whereClause.partyType = options.partyType;
    }

    if (options.isActive !== undefined) {
      whereClause.isActive = options.isActive;
    }

    const queryOptions: any = {
      where: whereClause,
      take: options.limit,
      orderBy: { [options.sortBy || 'updatedAt']: options.sortOrder || 'desc' },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        supplier: {
          select: { id: true, name: true, phone: true, email: true, company: true },
        },
      },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.khataAccount.findMany(queryOptions),
      this.prisma.khataAccount.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  async findById(shopId: string, id: string) {
    return this.prisma.khataAccount.findFirst({
      where: { id, shopId },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        supplier: {
          select: { id: true, name: true, phone: true, email: true, company: true },
        },
      },
    });
  }

  async findEntries(
    shopId: string,
    accountId: string,
    options: {
      limit: number;
      cursor?: string;
    },
  ) {
    const whereClause = { shopId, khataAccountId: accountId };

    const queryOptions: any = {
      where: whereClause,
      take: options.limit,
      orderBy: { entryDate: 'desc' },
      include: {
        recorder: { select: { id: true, name: true } },
      },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.khataEntry.findMany(queryOptions),
      this.prisma.khataEntry.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  async recordKhataPayment(
    tx: any,
    shopId: string,
    accountId: string,
    userId: string,
    data: {
      amountCents: number;
      method: 'CASH' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'BANK' | 'CARD' | 'CHECK' | 'OTHER';
      reference: string | null;
      notes: string | null;
    },
  ) {
    const khata = await tx.khataAccount.findFirst({
      where: { id: accountId, shopId, isActive: true },
    });

    if (!khata) {
      throw new NotFoundError('Active Khata Account');
    }

    const isCustomer = khata.partyType === 'CUSTOMER';
    const paymentType = isCustomer ? 'RECEIVED' : 'MADE';

    // Adjust Khata balance
    // Customer paying shop reduces ledger balance (+ve balance represents receivable)
    // Shop paying supplier reduces payable debt (-ve balance represents payable, increases towards 0)
    const newBalance = isCustomer
      ? khata.balanceCents - data.amountCents
      : khata.balanceCents + data.amountCents;

    const khataEntryType = isCustomer ? 'CREDIT' : 'DEBIT';
    const defaultPaymentNotes = isCustomer 
      ? 'Customer khata outstanding dues collection' 
      : 'Supplier khata debt repayment payout';
    const defaultEntryDesc = isCustomer 
      ? 'Collected dues cash payment' 
      : 'Supplier repayment cash payout';

    // 1. Create Payment record
    const payment = await tx.payment.create({
      data: {
        shopId,
        type: paymentType,
        method: data.method,
        amountCents: data.amountCents,
        payableType: 'khata',
        payableId: khata.id,
        reference: data.reference,
        notes: data.notes || defaultPaymentNotes,
        recordedBy: userId,
      },
    });

    // 2. Log to Cashbook if method is CASH
    if (data.method === 'CASH') {
      await CashbookRepository.recordEntry(tx, shopId, {
        type: isCustomer ? 'IN' : 'OUT',
        amountCents: data.amountCents,
        description: isCustomer
          ? `Customer khata collection: ${data.notes || 'No notes'}`
          : `Supplier khata repayment payout: ${data.notes || 'No notes'}`,
        referenceType: 'payment',
        referenceId: payment.id,
        recordedBy: userId,
      });
    }

    // 3. Update KhataAccount balance
    const updatedAccount = await tx.khataAccount.update({
      where: { id: khata.id },
      data: { balanceCents: newBalance },
    });

    // 4. Create KhataEntry
    await tx.khataEntry.create({
      data: {
        shopId,
        khataAccountId: khata.id,
        type: khataEntryType,
        amountCents: data.amountCents,
        runningBalanceCents: newBalance,
        description: data.notes || defaultEntryDesc,
        referenceType: 'payment',
        referenceId: payment.id,
        recordedBy: userId,
      },
    });

    return { payment, account: updatedAccount };
  }

  async recordCollection(
    shopId: string,
    accountId: string,
    userId: string,
    data: {
      amountCents: number;
      method: 'CASH' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'BANK' | 'CARD' | 'CHECK' | 'OTHER';
      reference: string | null;
      notes: string | null;
    },
  ) {
    return this.prisma.$transaction(async (tx: any) => {
      const result = await this.recordKhataPayment(tx, shopId, accountId, userId, data);
      if (result.account.partyType !== 'CUSTOMER') {
        throw new ConflictError('Dues collection can only be processed for customer khata accounts');
      }
      return result;
    });
  }

  async recordRepayment(
    shopId: string,
    accountId: string,
    userId: string,
    data: {
      amountCents: number;
      method: 'CASH' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'BANK' | 'CARD' | 'CHECK' | 'OTHER';
      reference: string | null;
      notes: string | null;
    },
  ) {
    return this.prisma.$transaction(async (tx: any) => {
      const result = await this.recordKhataPayment(tx, shopId, accountId, userId, data);
      if (result.account.partyType !== 'SUPPLIER') {
        throw new ConflictError('Repayment payouts can only be processed for supplier khata accounts');
      }
      return result;
    });
  }

  async recordAdjustment(
    shopId: string,
    accountId: string,
    userId: string,
    data: {
      type: 'CREDIT' | 'DEBIT' | 'ADJUSTMENT';
      amountCents: number;
      description: string;
    },
  ) {
    return this.prisma.$transaction(async (tx: any) => {
      const khata = await tx.khataAccount.findFirst({
        where: { id: accountId, shopId },
      });

      if (!khata) {
        throw new NotFoundError('Khata Account');
      }

      // Calculation of balance shift
      // DEBIT adds to balance (+ve shift)
      // CREDIT subtracts from balance (-ve shift)
      // ADJUSTMENT adds/subtracts depending on value. Let's make it add for simplicity.
      let balanceShift = data.amountCents;
      if (data.type === 'CREDIT') {
        balanceShift = -data.amountCents;
      }

      const newBalance = khata.balanceCents + balanceShift;

      // Update account balance
      const updatedAccount = await tx.khataAccount.update({
        where: { id: khata.id },
        data: { balanceCents: newBalance },
      });

      // Record adjustment entry
      const entry = await tx.khataEntry.create({
        data: {
          shopId,
          khataAccountId: khata.id,
          type: data.type,
          amountCents: data.amountCents,
          runningBalanceCents: newBalance,
          description: data.description,
          recordedBy: userId,
        },
      });

      return { entry, account: updatedAccount };
    });
  }

  async getDueSummary(shopId: string) {
    // Total customer receivables: sum of balances where balance > 0
    const customerDues = await this.prisma.khataAccount.aggregate({
      _sum: { balanceCents: true },
      where: {
        shopId,
        partyType: 'CUSTOMER',
        balanceCents: { gt: 0 },
        isActive: true,
      },
    });

    // Total supplier payables: sum of balances where balance < 0
    const supplierDues = await this.prisma.khataAccount.aggregate({
      _sum: { balanceCents: true },
      where: {
        shopId,
        partyType: 'SUPPLIER',
        balanceCents: { lt: 0 },
        isActive: true,
      },
    });

    const totalReceivableCents = customerDues._sum.balanceCents || 0;
    const totalPayableCents = Math.abs(supplierDues._sum.balanceCents || 0);

    return {
      totalReceivableCents,
      totalPayableCents,
      netReceivableCents: totalReceivableCents - totalPayableCents,
    };
  }

  async findOrCreateCustomerAccount(shopId: string, customerId: string) {
    const existing = await this.prisma.khataAccount.findFirst({
      where: { shopId, partyType: 'CUSTOMER', partyId: customerId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.khataAccount.create({
      data: {
        shopId,
        partyType: 'CUSTOMER',
        partyId: customerId,
        balanceCents: 0,
        creditLimitCents: 0,
      },
    });
  }

  async findOrCreateSupplierAccount(shopId: string, supplierId: string) {
    const existing = await this.prisma.khataAccount.findFirst({
      where: { shopId, partyType: 'SUPPLIER', partyId: supplierId },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.khataAccount.create({
      data: {
        shopId,
        partyType: 'SUPPLIER',
        partyId: supplierId,
        balanceCents: 0,
        creditLimitCents: 0,
      },
    });
  }

  async ensureAccount(shopId: string, partyType: 'CUSTOMER' | 'SUPPLIER', partyId: string) {
    if (partyType === 'CUSTOMER') {
      return this.findOrCreateCustomerAccount(shopId, partyId);
    }
    return this.findOrCreateSupplierAccount(shopId, partyId);
  }
}
