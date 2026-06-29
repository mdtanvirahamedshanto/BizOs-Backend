import type { PrismaClient, PaymentMethod } from '@prisma/client';
import { NotFoundError, ConflictError } from '@/utils/errors';
import { CashbookRepository } from './cashbook.repository';

export class ExpenseRepository {
  constructor(private prisma: PrismaClient) {}

  // ==========================================
  // EXPENSE CATEGORIES
  // ==========================================

  async createCategory(shopId: string, data: { name: string; color?: string | null; icon?: string | null }) {
    // Check if category name already exists in this shop (active/non-deleted)
    const existing = await this.prisma.expenseCategory.findFirst({
      where: { shopId, name: { equals: data.name, mode: 'insensitive' }, deletedAt: null },
    });

    if (existing) {
      throw new ConflictError(`An expense category with name "${data.name}" already exists`);
    }

    return this.prisma.expenseCategory.create({
      data: {
        ...data,
        shopId,
      },
    });
  }

  async updateCategory(
    shopId: string,
    id: string,
    data: { name?: string; color?: string | null; icon?: string | null }
  ) {
    const category = await this.findCategoryById(shopId, id);
    if (!category) {
      throw new NotFoundError('Expense Category');
    }

    if (data.name && data.name !== category.name) {
      const existing = await this.prisma.expenseCategory.findFirst({
        where: { shopId, name: { equals: data.name, mode: 'insensitive' }, deletedAt: null },
      });
      if (existing) {
        throw new ConflictError(`An expense category with name "${data.name}" already exists`);
      }
    }

    const { count } = await this.prisma.expenseCategory.updateMany({
      where: { id, shopId },
      data,
    });
    if (count === 0) throw new NotFoundError('Expense Category');
    return this.prisma.expenseCategory.findFirst({ where: { id, shopId } });
  }

  async softDeleteCategory(shopId: string, id: string) {
    const { count } = await this.prisma.expenseCategory.updateMany({
      where: { id, shopId },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw new NotFoundError('Expense Category');
    return this.prisma.expenseCategory.findFirst({ where: { id, shopId } });
  }

  async findCategoryById(shopId: string, id: string) {
    return this.prisma.expenseCategory.findFirst({
      where: { id, shopId, deletedAt: null },
    });
  }

  async findAllCategories(shopId: string) {
    return this.prisma.expenseCategory.findMany({
      where: { shopId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  // ==========================================
  // DAILY EXPENSES
  // ==========================================

  async createExpense(
    shopId: string,
    userId: string,
    data: {
      title: string;
      description?: string | null;
      categoryId?: string | null;
      amountCents: number;
      paymentMethod: PaymentMethod;
      receiptUrl?: string | null;
      expenseDate?: Date;
      isRecurring?: boolean;
    }
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Verify category if specified
      if (data.categoryId) {
        const cat = await tx.expenseCategory.findFirst({
          where: { id: data.categoryId, shopId, deletedAt: null },
        });
        if (!cat) {
          throw new NotFoundError('Expense Category');
        }
      }

      // 2. Create the Expense
      const expense = await tx.expense.create({
        data: {
          shopId,
          categoryId: data.categoryId || null,
          title: data.title,
          description: data.description || null,
          amountCents: data.amountCents,
          paymentMethod: data.paymentMethod,
          receiptUrl: data.receiptUrl || null,
          expenseDate: data.expenseDate || new Date(),
          recordedBy: userId,
          isRecurring: data.isRecurring || false,
        },
        include: {
          category: { select: { name: true } },
          recorder: { select: { name: true } },
        },
      });

      // 3. Log to Cashbook if method is CASH
      if (data.paymentMethod === 'CASH') {
        await CashbookRepository.recordEntry(tx, shopId, {
          type: 'OUT',
          amountCents: data.amountCents,
          description: `Expense: ${data.title}`,
          referenceType: 'expense',
          referenceId: expense.id,
          recordedBy: userId,
          entryDate: data.expenseDate || new Date(),
        });
      }

      return expense;
    });
  }

  async updateExpense(
    shopId: string,
    id: string,
    data: {
      title?: string;
      description?: string | null;
      categoryId?: string | null;
      amountCents?: number;
      receiptUrl?: string | null;
      expenseDate?: Date;
    }
  ) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, shopId, deletedAt: null },
    });

    if (!expense) {
      throw new NotFoundError('Expense');
    }

    if (data.categoryId) {
      const cat = await this.prisma.expenseCategory.findFirst({
        where: { id: data.categoryId, shopId, deletedAt: null },
      });
      if (!cat) {
        throw new NotFoundError('Expense Category');
      }
    }

    // Note: To keep things simple and prevent complex ledger recalculation logic,
    // modification of amount or paymentMethod is not allowed in basic updates,
    // or if needed, can trigger warning. Let's make basic updates non-ledger affecting
    // (excluding amountCents modification) or handle them inside transaction if amount changes.
    // If amountCents changes and paymentMethod was CASH, we must calculate the diff and adjust the cashbook.
    if (data.amountCents !== undefined && data.amountCents !== expense.amountCents && expense.paymentMethod === 'CASH') {
      return this.prisma.$transaction(async (tx) => {
        const diff = data.amountCents! - expense.amountCents;
        const adjustmentType = diff > 0 ? 'OUT' : 'IN';
        const absoluteDiff = Math.abs(diff);

        // Update expense
        await tx.expense.updateMany({
          where: { id, shopId },
          data,
        });
        const updated = await tx.expense.findFirst({
          where: { id, shopId },
          include: {
            category: { select: { name: true } },
            recorder: { select: { name: true } },
          },
        });
        
        if (!updated) throw new NotFoundError('Expense');

        // Record adjustment
        await CashbookRepository.recordEntry(tx, shopId, {
          type: adjustmentType,
          amountCents: absoluteDiff,
          description: `Expense adjustment: ${updated.title}`,
          referenceType: 'expense',
          referenceId: updated.id,
          recordedBy: expense.recordedBy,
        });

        return updated;
      });
    }

    await this.prisma.expense.updateMany({
      where: { id, shopId },
      data,
    });
    return this.prisma.expense.findFirst({
      where: { id, shopId },
      include: {
        category: { select: { name: true } },
        recorder: { select: { name: true } },
      },
    });
  }

  async softDeleteExpense(shopId: string, id: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.findFirst({
        where: { id, shopId, deletedAt: null },
      });

      if (!expense) {
        throw new NotFoundError('Expense');
      }

      const { count } = await tx.expense.updateMany({
        where: { id, shopId },
        data: { deletedAt: new Date() },
      });
      if (count === 0) throw new NotFoundError('Expense');

      // Reverse cashbook entry if paymentMethod was CASH
      if (expense.paymentMethod === 'CASH') {
        await CashbookRepository.recordEntry(tx, shopId, {
          type: 'IN',
          amountCents: expense.amountCents,
          description: `Reverse deleted expense: ${expense.title}`,
          referenceType: 'expense',
          referenceId: expense.id,
          recordedBy: userId,
        });
      }

      return tx.expense.findFirst({ where: { id, shopId } });
    });
  }

  async findExpenseById(shopId: string, id: string) {
    return this.prisma.expense.findFirst({
      where: { id, shopId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        recorder: { select: { id: true, name: true } },
      },
    });
  }

  async findAndCountExpenses(
    shopId: string,
    options: {
      categoryId?: string;
      isRecurring?: boolean;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      limit: number;
      cursor?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ) {
    const whereClause: any = { shopId, deletedAt: null };

    if (options.categoryId) {
      whereClause.categoryId = options.categoryId;
    }

    if (options.isRecurring !== undefined) {
      whereClause.isRecurring = options.isRecurring;
    }

    if (options.startDate || options.endDate) {
      whereClause.expenseDate = {};
      if (options.startDate) {
        whereClause.expenseDate.gte = options.startDate;
      }
      if (options.endDate) {
        whereClause.expenseDate.lte = options.endDate;
      }
    }

    if (options.search) {
      whereClause.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const queryOptions: any = {
      where: whereClause,
      take: options.limit,
      orderBy: { [options.sortBy || 'expenseDate']: options.sortOrder || 'desc' },
      include: {
        category: { select: { id: true, name: true, color: true } },
        recorder: { select: { id: true, name: true } },
      },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.expense.findMany(queryOptions),
      this.prisma.expense.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  // ==========================================
  // RECURRING EXPENSES
  // ==========================================

  async createRecurringExpense(
    shopId: string,
    userId: string,
    data: {
      categoryId?: string | null;
      title: string;
      description?: string | null;
      amountCents: number;
      paymentMethod?: PaymentMethod;
      frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
      startDate: Date;
      endDate?: Date | null;
      isActive?: boolean;
    }
  ) {
    if (data.categoryId) {
      const cat = await this.prisma.expenseCategory.findFirst({
        where: { id: data.categoryId, shopId, deletedAt: null },
      });
      if (!cat) {
        throw new NotFoundError('Expense Category');
      }
    }

    return this.prisma.recurringExpense.create({
      data: {
        shopId,
        categoryId: data.categoryId || null,
        title: data.title,
        description: data.description || null,
        amountCents: data.amountCents,
        paymentMethod: data.paymentMethod || 'CASH',
        frequency: data.frequency,
        startDate: data.startDate,
        endDate: data.endDate || null,
        nextDueDate: data.startDate, // Initial generation due at start date
        isActive: data.isActive !== undefined ? data.isActive : true,
        recordedBy: userId,
      },
      include: {
        category: { select: { name: true } },
        recorder: { select: { name: true } },
      },
    });
  }

  async updateRecurringExpense(
    shopId: string,
    id: string,
    data: {
      categoryId?: string | null;
      title?: string;
      description?: string | null;
      amountCents?: number;
      paymentMethod?: PaymentMethod;
      frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
      startDate?: Date;
      endDate?: Date | null;
      nextDueDate?: Date;
      lastGenDate?: Date | null;
      isActive?: boolean;
    }
  ) {
    const template = await this.prisma.recurringExpense.findFirst({
      where: { id, shopId },
    });

    if (!template) {
      throw new NotFoundError('Recurring Expense Template');
    }

    if (data.categoryId) {
      const cat = await this.prisma.expenseCategory.findFirst({
        where: { id: data.categoryId, shopId, deletedAt: null },
      });
      if (!cat) {
        throw new NotFoundError('Expense Category');
      }
    }

    const { count } = await this.prisma.recurringExpense.updateMany({
      where: { id, shopId },
      data,
    });
    if (count === 0) throw new NotFoundError('Recurring Expense');
    return this.prisma.recurringExpense.findFirst({
      where: { id, shopId },
      include: {
        category: { select: { name: true } },
        recorder: { select: { name: true } },
      },
    });
  }

  async findRecurringExpenseById(shopId: string, id: string) {
    return this.prisma.recurringExpense.findFirst({
      where: { id, shopId },
      include: {
        category: { select: { id: true, name: true } },
        recorder: { select: { id: true, name: true } },
      },
    });
  }

  async findAndCountRecurringExpenses(
    shopId: string,
    options: {
      isActive?: boolean;
      search?: string;
      limit: number;
      cursor?: string;
    }
  ) {
    const whereClause: any = { shopId };

    if (options.isActive !== undefined) {
      whereClause.isActive = options.isActive;
    }

    if (options.search) {
      whereClause.OR = [
        { title: { contains: options.search, mode: 'insensitive' } },
        { description: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const queryOptions: any = {
      where: whereClause,
      take: options.limit,
      orderBy: { nextDueDate: 'asc' },
      include: {
        category: { select: { id: true, name: true, color: true } },
        recorder: { select: { id: true, name: true } },
      },
    };

    if (options.cursor) {
      queryOptions.cursor = { id: options.cursor };
      queryOptions.skip = 1;
    }

    const [data, total] = await Promise.all([
      this.prisma.recurringExpense.findMany(queryOptions),
      this.prisma.recurringExpense.count({ where: whereClause }),
    ]);

    return { data, total };
  }

  /**
   * Find templates that are due to trigger an expense generation.
   */
  async findDueRecurringExpenses(currentDate: Date) {
    return this.prisma.recurringExpense.findMany({
      where: {
        isActive: true,
        nextDueDate: { lte: currentDate },
        OR: [
          { endDate: null },
          { endDate: { gte: currentDate } },
        ],
      },
    });
  }
}
