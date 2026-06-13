import { Router } from 'express';
import { ExpenseController } from '@/controllers/expense.controller';
import { ExpenseService } from '@/services/expense.service';
import { ExpenseRepository } from '@/repositories/expense.repository';
import { prisma } from '@/prisma/client';
import { authenticate } from '@/middlewares/authenticate';
import { tenantContext } from '@/middlewares/tenantContext';
import { authorize } from '@/middlewares/authorize';
import { validate } from '@/middlewares/validate';
import {
  expenseCategorySchema,
  createExpenseSchema,
  updateExpenseSchema,
  createRecurringExpenseSchema,
  updateRecurringExpenseSchema,
  expenseQuerySchema,
  recurringExpenseQuerySchema,
} from '@/validators/expense.schema';

const router = Router();
const expenseRepo = new ExpenseRepository(prisma);
const expenseService = new ExpenseService(expenseRepo);
const expenseController = new ExpenseController(expenseService);

router.use(authenticate);
router.use(tenantContext);

// ==========================================
// EXPENSE CATEGORIES
// ==========================================
router.post(
  '/categories',
  authorize('expense-categories.write'),
  validate(expenseCategorySchema),
  expenseController.createCategory
);
router.get(
  '/categories',
  authorize('expense-categories.read'),
  expenseController.listCategories
);
router.get(
  '/categories/:id',
  authorize('expense-categories.read'),
  expenseController.getCategory
);
router.put(
  '/categories/:id',
  authorize('expense-categories.update'),
  validate(expenseCategorySchema),
  expenseController.updateCategory
);
router.delete(
  '/categories/:id',
  authorize('expense-categories.delete'),
  expenseController.deleteCategory
);

// ==========================================
// RECURRING EXPENSES (Placed before parameterized daily routes to avoid conflict)
// ==========================================
router.post(
  '/recurring/process',
  authorize('expenses.update'),
  expenseController.processRecurringExpenses
);
router.post(
  '/recurring',
  authorize('expenses.write'),
  validate(createRecurringExpenseSchema),
  expenseController.createRecurringExpense
);
router.get(
  '/recurring',
  authorize('expenses.read'),
  validate(recurringExpenseQuerySchema, 'query'),
  expenseController.listRecurringExpenses
);
router.get(
  '/recurring/:id',
  authorize('expenses.read'),
  expenseController.getRecurringExpense
);
router.put(
  '/recurring/:id',
  authorize('expenses.update'),
  validate(updateRecurringExpenseSchema),
  expenseController.updateRecurringExpense
);

// ==========================================
// DAILY EXPENSES
// ==========================================
router.post(
  '/',
  authorize('expenses.write'),
  validate(createExpenseSchema),
  expenseController.createExpense
);
router.get(
  '/',
  authorize('expenses.read'),
  validate(expenseQuerySchema, 'query'),
  expenseController.listExpenses
);
router.get(
  '/:id',
  authorize('expenses.read'),
  expenseController.getExpense
);
router.put(
  '/:id',
  authorize('expenses.update'),
  validate(updateExpenseSchema),
  expenseController.updateExpense
);
router.delete(
  '/:id',
  authorize('expenses.delete'),
  expenseController.deleteExpense
);

export const expenseRoutes = router;
