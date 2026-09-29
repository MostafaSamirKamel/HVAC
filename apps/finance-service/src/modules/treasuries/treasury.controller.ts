import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { TreasuryService } from './treasury.service.js';
import { TreasuryModel } from './treasury.model.js';

const CreateTreasurySchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['CASH_SAFE', 'BANK_ACCOUNT', 'PETTY_CASH']).default('CASH_SAFE'),
  branchId: z.string().min(1, 'Branch ID is required'),
  custodianUserId: z.string().optional(),
  accountId: z.string().optional(),
  currency: z.string().default('EGP'),
  initialBalance: z.union([z.number(), z.string()]).default(0),
});

const RecordMovementSchema = z.object({
  movementType: z.enum(['INFLOW', 'OUTFLOW']),
  amount: z.union([z.number(), z.string()]),
  referenceType: z.enum([
    'CASH_SALE',
    'VENDOR_PAYMENT',
    'EXPENSE',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'CUSTOMER_RECEIPT',
    'ADJUSTMENT',
  ]),
  referenceId: z.string().min(1, 'Reference ID is required'),
  description: z.string().min(1, 'Description is required'),
});

export class TreasuryController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateTreasurySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const treasury = await TreasuryService.createTreasury({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: treasury,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const branchId = req.query.branchId as string | undefined;
      const query: Record<string, unknown> = { companyId, isActive: true };
      if (branchId) query.branchId = branchId;

      const treasuries = await TreasuryModel.find(query);

      res.json({
        success: true,
        data: treasuries,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const treasury = await TreasuryService.getTreasuryById(companyId, req.params.id);

      res.json({
        success: true,
        data: treasury,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getLedgerHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const history = await TreasuryService.getLedgerHistory(companyId, req.params.id);

      res.json({
        success: true,
        data: history,
      });
    } catch (err) {
      next(err);
    }
  }

  static async recordMovement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = RecordMovementSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const result = await TreasuryService.recordMovement({
        companyId,
        treasuryId: req.params.id,
        ...parsed.data,
        performedBy: req.authContext?.userId || 'unknown',
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
