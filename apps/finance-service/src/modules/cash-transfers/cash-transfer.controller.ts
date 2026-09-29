import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { CashTransferService } from './cash-transfer.service.js';
import { CashTransferModel } from './cash-transfer.model.js';

const InitiateTransferSchema = z.object({
  sourceTreasuryId: z.string().min(1, 'Source treasury ID is required'),
  targetTreasuryId: z.string().min(1, 'Target treasury ID is required'),
  amount: z.union([z.number(), z.string()]),
  description: z.string().optional(),
});

export class CashTransferController {
  static async initiate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = InitiateTransferSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const transfer = await CashTransferService.initiateTransfer({
        companyId,
        ...parsed.data,
        initiatedBy: req.authContext?.userId || 'unknown',
      });

      res.status(201).json({
        success: true,
        data: transfer,
      });
    } catch (err) {
      next(err);
    }
  }

  static async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const transfer = await CashTransferService.completeTransfer(
        companyId,
        req.params.id,
        req.authContext?.userId || 'unknown'
      );

      res.json({
        success: true,
        message: 'Cash transfer completed and ledger posted',
        data: transfer,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const status = req.query.status as string | undefined;
      const query: Record<string, unknown> = { companyId };
      if (status) query.status = status;

      const transfers = await CashTransferModel.find(query).sort({ initiatedAt: -1 });

      res.json({
        success: true,
        data: transfers,
      });
    } catch (err) {
      next(err);
    }
  }
}
