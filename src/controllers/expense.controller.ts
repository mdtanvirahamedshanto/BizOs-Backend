import type { Request, Response, NextFunction } from 'express';
import { ExpenseService } from '@/services/expense.service';
import { sendSuccess, sendCreated, sendNoContent } from '@/utils/response';

export class ExpenseController {
  constructor(private expenseService: ExpenseService) {}

  // ==========================================
  // EXPENSE CATEGORIES
  // ==========================================

  createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const actorUserId = req.user?.id;
      const result = await this.expenseService.createCategory(shopId, req.body, actorUserId);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  updateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const categoryId = req.params.id as string;
      const actorUserId = req.user?.id;
      const result = await this.expenseService.updateCategory(shopId, categoryId, req.body, actorUserId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  deleteCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const categoryId = req.params.id as string;
      const actorUserId = req.user?.id;
      await this.expenseService.deleteCategory(shopId, categoryId, actorUserId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  getCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const categoryId = req.params.id as string;
      const result = await this.expenseService.getCategory(shopId, categoryId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.expenseService.listCategories(shopId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // DAILY EXPENSES
  // ==========================================

  createExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const actorUserId = req.user?.id!;
      const result = await this.expenseService.createExpense(shopId, actorUserId, req.body);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  updateExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const expenseId = req.params.id as string;
      const actorUserId = req.user?.id;
      const result = await this.expenseService.updateExpense(shopId, expenseId, req.body, actorUserId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  deleteExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const expenseId = req.params.id as string;
      const actorUserId = req.user?.id;
      await this.expenseService.deleteExpense(shopId, expenseId, actorUserId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  getExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const expenseId = req.params.id as string;
      const result = await this.expenseService.getExpense(shopId, expenseId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listExpenses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.expenseService.listExpenses(shopId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  // ==========================================
  // RECURRING EXPENSES
  // ==========================================

  createRecurringExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const actorUserId = req.user?.id!;
      const result = await this.expenseService.createRecurringExpense(shopId, actorUserId, req.body);
      sendCreated(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  updateRecurringExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const templateId = req.params.id as string;
      const actorUserId = req.user?.id;
      const result = await this.expenseService.updateRecurringExpense(shopId, templateId, req.body, actorUserId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  getRecurringExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const templateId = req.params.id as string;
      const result = await this.expenseService.getRecurringExpense(shopId, templateId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  listRecurringExpenses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.shopId!;
      const result = await this.expenseService.listRecurringExpenses(shopId, req.query as any);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };

  processRecurringExpenses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actorUserId = req.user?.id;
      const result = await this.expenseService.processRecurringExpenses(actorUserId);
      sendSuccess(res, result.data);
    } catch (err) {
      next(err);
    }
  };
}
