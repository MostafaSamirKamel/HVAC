import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { AccountService } from './account.service.js';

const CreateAccountSchema = z.object({
  accountCode: z.string().min(1, 'Account code is required'),
  accountName: z.string().min(1, 'Account name is required'),
  accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
  parentAccountId: z.string().optional(),
  currency: z.string().default('EGP'),
});

export class AccountController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateAccountSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const account = await AccountService.createAccount({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: account,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const accounts = await AccountService.getAccountsByCompany(companyId);

      res.json({
        success: true,
        data: accounts,
      });
    } catch (err) {
      next(err);
    }
  }

  static async ensureStandard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      await AccountService.ensureStandardAccounts(companyId);

      const accounts = await AccountService.getAccountsByCompany(companyId);
      res.json({
        success: true,
        message: 'Standard accounts verified / created',
        data: accounts,
      });
    } catch (err) {
      next(err);
    }
  }
}
