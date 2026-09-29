import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { ExpenseService } from './expense.service.js';

const RecordExpenseSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  categoryId: z.string().min(1, 'Category ID is required'),
  categoryName: z.string().min(1, 'Category Name is required'),
  amount: z.union([z.number(), z.string()]),
  paymentSourceType: z.enum(['TREASURY', 'BANK']).default('TREASURY'),
  treasuryId: z.string().optional(),
  bankAccountId: z.string().optional(),
  employeeId: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  expenseAccountId: z.string().min(1, 'Expense Account ID is required'),
  expenseDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
});

export class ExpenseController {
  static async record(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const recordedBy = req.authContext?.userId;
      if (!companyId || !recordedBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = RecordExpenseSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const expense = await ExpenseService.recordExpense({
        companyId,
        recordedBy,
        ...parsed.data,
        expenseDate: parsed.data.expenseDate ? new Date(parsed.data.expenseDate) : undefined,
      });

      res.status(201).json({
        success: true,
        data: expense,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const expenses = await ExpenseService.listExpenses(companyId, {
        branchId: req.query.branchId as string | undefined,
        categoryId: req.query.categoryId as string | undefined,
        approvalStatus: req.query.approvalStatus as any,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      res.json({
        success: true,
        data: expenses,
      });
    } catch (err) {
      next(err);
    }
  }
}
