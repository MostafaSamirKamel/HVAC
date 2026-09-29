import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { BankAccountService } from './bank-account.service.js';

const CreateBankAccountSchema = z.object({
  bankName: z.string().min(1, 'Bank name is required'),
  accountName: z.string().min(1, 'Account name is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  iban: z.string().optional(),
  branchId: z.string().optional(),
  currency: z.string().default('EGP'),
  openingBalance: z.union([z.number(), z.string()]).default(0),
});

export class BankAccountController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateBankAccountSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const account = await BankAccountService.createBankAccount({
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

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const account = await BankAccountService.getBankAccountById(companyId, req.params.id);

      res.json({
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

      const accounts = await BankAccountService.listBankAccounts(companyId, {
        branchId: req.query.branchId as string | undefined,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      });

      res.json({
        success: true,
        data: accounts,
      });
    } catch (err) {
      next(err);
    }
  }
}
