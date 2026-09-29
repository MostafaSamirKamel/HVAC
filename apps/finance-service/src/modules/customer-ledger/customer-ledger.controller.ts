import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { CustomerLedgerService } from './customer-ledger.service.js';

const RecordEntrySchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
  entryType: z.enum(['SALE_INVOICE', 'PAYMENT', 'INSTALLMENT', 'RETURN', 'REFUND', 'CREDIT', 'ADJUSTMENT']),
  debit: z.union([z.number(), z.string()]).default(0),
  credit: z.union([z.number(), z.string()]).default(0),
  referenceId: z.string().min(1, 'Reference ID is required'),
  referenceType: z.string().min(1, 'Reference type is required'),
  description: z.string().min(1, 'Description is required'),
});

export class CustomerLedgerController {
  static async record(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const performedBy = req.authContext?.userId;
      if (!companyId || !performedBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = RecordEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const entry = await CustomerLedgerService.recordEntry({
        companyId,
        performedBy,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: entry,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getStatement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const statement = await CustomerLedgerService.getCustomerStatement(
        companyId,
        req.params.customerId,
        req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        req.query.toDate ? new Date(req.query.toDate as string) : undefined
      );

      res.json({
        success: true,
        data: statement,
      });
    } catch (err) {
      next(err);
    }
  }
}
