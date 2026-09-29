import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { ReceivablesService } from './receivables.service.js';

const CreateReceivableSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  orderId: z.string().optional(),
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  invoiceNumber: z.string().min(1, 'Invoice Number is required'),
  amount: z.union([z.number(), z.string()]),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export class ReceivablesController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateReceivableSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const receivable = await ReceivablesService.createReceivable({
        companyId,
        ...parsed.data,
        dueDate: new Date(parsed.data.dueDate),
      });

      res.status(201).json({
        success: true,
        data: receivable,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAgingSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const summary = await ReceivablesService.getAgingSummary(
        companyId,
        req.query.customerId as string | undefined
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const receivables = await ReceivablesService.listReceivables(companyId, {
        customerId: req.query.customerId as string | undefined,
        status: req.query.status as any,
      });

      res.json({
        success: true,
        data: receivables,
      });
    } catch (err) {
      next(err);
    }
  }
}
