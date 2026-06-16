import type { ExpenseRepository } from '@/repositories/expense.repository';
import { NotFoundError } from '@/utils/errors';
import { success } from '@/types/service';
import type { ServiceResult } from '@/types/service';
import { buildPaginationMeta } from '@/utils/pagination';
import { PAGINATION_DEFAULTS } from '@/types/pagination';
import type { PaginatedResult } from '@/types/pagination';
import type {
  ExpenseCategoryDTO,
  CreateExpenseDTO,
  UpdateExpenseDTO,
  CreateRecurringExpenseDTO,
  UpdateRecurringExpenseDTO,
  ExpenseQueryDTO,
  RecurringExpenseQueryDTO,
} from '@/validators/expense.schema';
import { AuditService } from './audit.service';
import { expenseEvents } from '@/events/expense.events';

export class ExpenseService {
  constructor(private expenseRepo: ExpenseRepository) {}

  // ==========================================
  // EXPENSE CATEGORIES
  // ==========================================

  async createCategory(
    shopId: string,
    dto: ExpenseCategoryDTO,
    actorUserId?: string
  ): Promise<ServiceResult<any>> {
    const category = await this.expenseRepo.createCategory(shopId, dto);

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'expense-category.created',
      entity: 'expense_categories',
      entityId: category.id,
      newValues: category as any,
    });

    return success(category);
  }

  async updateCategory(
    shopId: string,
    id: string,
    dto: ExpenseCategoryDTO,
    actorUserId?: string
  ): Promise<ServiceResult<any>> {
    const category = await this.expenseRepo.findCategoryById(shopId, id);
    if (!category) {
      throw new NotFoundError('Expense Category');
    }

    const updated = await this.expenseRepo.updateCategory(shopId, id, dto);

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'expense-category.updated',
      entity: 'expense_categories',
      entityId: id,
      oldValues: category as any,
      newValues: updated as any,
    });

    return success(updated);
  }

  async deleteCategory(shopId: string, id: string, actorUserId?: string): Promise<ServiceResult<void>> {
    const category = await this.expenseRepo.findCategoryById(shopId, id);
    if (!category) {
      throw new NotFoundError('Expense Category');
    }

    await this.expenseRepo.softDeleteCategory(shopId, id);

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'expense-category.deleted',
      entity: 'expense_categories',
      entityId: id,
      oldValues: category as any,
    });

    return success(undefined);
  }

  async getCategory(shopId: string, id: string): Promise<ServiceResult<any>> {
    const category = await this.expenseRepo.findCategoryById(shopId, id);
    if (!category) {
      throw new NotFoundError('Expense Category');
    }
    return success(category);
  }

  async listCategories(shopId: string): Promise<ServiceResult<any[]>> {
    const categories = await this.expenseRepo.findAllCategories(shopId);
    return success(categories);
  }

  // ==========================================
  // DAILY EXPENSES
  // ==========================================

  async createExpense(
    shopId: string,
    userId: string,
    dto: CreateExpenseDTO
  ): Promise<ServiceResult<any>> {
    const expense = await this.expenseRepo.createExpense(shopId, userId, dto);

    await AuditService.log({
      shopId,
      userId,
      action: 'expense.created',
      entity: 'expenses',
      entityId: expense.id,
      newValues: expense as any,
    });

    expenseEvents.created({
      shopId,
      expenseId: expense.id,
      amountCents: expense.amountCents,
      title: expense.title,
    });

    return success(expense);
  }

  async updateExpense(
    shopId: string,
    id: string,
    dto: UpdateExpenseDTO,
    actorUserId?: string
  ): Promise<ServiceResult<any>> {
    const expense = await this.expenseRepo.findExpenseById(shopId, id);
    if (!expense) {
      throw new NotFoundError('Expense');
    }

    const updated = await this.expenseRepo.updateExpense(shopId, id, dto);

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'expense.updated',
      entity: 'expenses',
      entityId: id,
      oldValues: expense as any,
      newValues: updated as any,
    });

    return success(updated);
  }

  async deleteExpense(shopId: string, id: string, actorUserId?: string): Promise<ServiceResult<void>> {
    const expense = await this.expenseRepo.findExpenseById(shopId, id);
    if (!expense) {
      throw new NotFoundError('Expense');
    }

    await this.expenseRepo.softDeleteExpense(shopId, id, actorUserId || expense.recordedBy);

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'expense.deleted',
      entity: 'expenses',
      entityId: id,
      oldValues: expense as any,
    });

    return success(undefined);
  }

  async getExpense(shopId: string, id: string): Promise<ServiceResult<any>> {
    const expense = await this.expenseRepo.findExpenseById(shopId, id);
    if (!expense) {
      throw new NotFoundError('Expense');
    }
    return success(expense);
  }

  async listExpenses(
    shopId: string,
    query: ExpenseQueryDTO
  ): Promise<ServiceResult<PaginatedResult<any>>> {
    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;
    const sortBy = query.sortBy || 'expenseDate';
    const sortOrder = query.sortOrder || PAGINATION_DEFAULTS.SORT_ORDER;

    const { data, total } = await this.expenseRepo.findAndCountExpenses(shopId, {
      categoryId: query.categoryId,
      isRecurring: query.isRecurring,
      startDate: query.startDate,
      endDate: query.endDate,
      search: query.search,
      limit,
      cursor: query.cursor,
      sortBy,
      sortOrder,
    });

    const meta = buildPaginationMeta(total, limit, data, query.cursor);

    return success({
      data,
      meta,
    });
  }

  // ==========================================
  // RECURRING EXPENSES
  // ==========================================

  async createRecurringExpense(
    shopId: string,
    userId: string,
    dto: CreateRecurringExpenseDTO
  ): Promise<ServiceResult<any>> {
    const template = await this.expenseRepo.createRecurringExpense(shopId, userId, dto);

    await AuditService.log({
      shopId,
      userId,
      action: 'recurring-expense.created',
      entity: 'recurring_expenses',
      entityId: template.id,
      newValues: template as any,
    });

    return success(template);
  }

  async updateRecurringExpense(
    shopId: string,
    id: string,
    dto: UpdateRecurringExpenseDTO,
    actorUserId?: string
  ): Promise<ServiceResult<any>> {
    const template = await this.expenseRepo.findRecurringExpenseById(shopId, id);
    if (!template) {
      throw new NotFoundError('Recurring Expense Template');
    }

    const updated = await this.expenseRepo.updateRecurringExpense(shopId, id, dto);

    await AuditService.log({
      shopId,
      userId: actorUserId,
      action: 'recurring-expense.updated',
      entity: 'recurring_expenses',
      entityId: id,
      oldValues: template as any,
      newValues: updated as any,
    });

    return success(updated);
  }

  async getRecurringExpense(shopId: string, id: string): Promise<ServiceResult<any>> {
    const template = await this.expenseRepo.findRecurringExpenseById(shopId, id);
    if (!template) {
      throw new NotFoundError('Recurring Expense Template');
    }
    return success(template);
  }

  async listRecurringExpenses(
    shopId: string,
    query: RecurringExpenseQueryDTO
  ): Promise<ServiceResult<PaginatedResult<any>>> {
    const limit = query.limit || PAGINATION_DEFAULTS.LIMIT;

    const { data, total } = await this.expenseRepo.findAndCountRecurringExpenses(shopId, {
      isActive: query.isActive,
      search: query.search,
      limit,
      cursor: query.cursor,
    });

    const meta = buildPaginationMeta(total, limit, data, query.cursor);

    return success({
      data,
      meta,
    });
  }

  /**
   * Scans and generates expenses from active templates that are due.
   */
  async processRecurringExpenses(actorUserId?: string): Promise<ServiceResult<{ count: number }>> {
    const now = new Date();
    const dueTemplates = await this.expenseRepo.findDueRecurringExpenses(now);
    let count = 0;

    for (const template of dueTemplates) {
      try {
        // 1. Generate the expense
        await this.expenseRepo.createExpense(template.shopId, template.recordedBy, {
          title: `Recurring: ${template.title}`,
          description: template.description,
          categoryId: template.categoryId,
          amountCents: template.amountCents,
          paymentMethod: template.paymentMethod,
          isRecurring: true,
          expenseDate: template.nextDueDate,
        });

        // 2. Compute the next due date
        const nextDue = new Date(template.nextDueDate);
        if (template.frequency === 'DAILY') {
          nextDue.setUTCDate(nextDue.getUTCDate() + 1);
        } else if (template.frequency === 'WEEKLY') {
          nextDue.setUTCDate(nextDue.getUTCDate() + 7);
        } else if (template.frequency === 'MONTHLY') {
          nextDue.setUTCMonth(nextDue.getUTCMonth() + 1);
        } else if (template.frequency === 'YEARLY') {
          nextDue.setUTCFullYear(nextDue.getUTCFullYear() + 1);
        }

        // Check if template end date has been exceeded
        const isActive = template.endDate ? nextDue <= template.endDate : true;

        // 3. Update the template
        await this.expenseRepo.updateRecurringExpense(template.shopId, template.id, {
          nextDueDate: nextDue,
          lastGenDate: now,
          isActive,
        });

        // Log audit trail
        await AuditService.log({
          shopId: template.shopId,
          userId: actorUserId,
          action: 'recurring-expense.generated',
          entity: 'expenses',
          entityId: template.id,
          newValues: {
            templateId: template.id,
            generatedAt: now,
            nextDueDate: nextDue,
          } as any,
        });

        count++;
      } catch (err: any) {
        // Log individual template generation failure, but continue processing others
        console.error(`Failed to generate recurring expense for template ${template.id}:`, err);
      }
    }

    return success({ count });
  }
}
