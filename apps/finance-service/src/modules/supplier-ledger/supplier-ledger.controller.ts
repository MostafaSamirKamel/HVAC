import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { SupplierLedgerService } from './supplier-ledger.service.js';

const RecordSupplierEntrySchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
  entryType: z.enum(['PURCHASE_INVOICE', 'PAYMENT', 'ADVANCE_PAYMENT', 'PURCHASE_RETURN', 'ADJUSTMENT']),
  debit: z.union([z.number(), z.string()]).default(0),
  credit: z.union([z.number(), z.string()]).default(0),
  referenceId: z.string().min(1, 'Reference ID is required'),
  referenceType: z.string().min(1, 'Reference type is required'),
  description: z.string().min(1, 'Description is required'),
});

export class SupplierLedgerController {
  static async record(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const performedBy = req.authContext?.userId;
      if (!companyId || !performedBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = RecordSupplierEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const entry = await SupplierLedgerService.recordEntry({
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

      const statement = await SupplierLedgerService.getSupplierStatement(
        companyId,
        req.params.supplierId,
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
