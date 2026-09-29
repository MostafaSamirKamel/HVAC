import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { PayablesService } from './payables.service.js';

const CreatePayableSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  vendorBillId: z.string().min(1, 'Vendor Bill ID is required'),
  billNumber: z.string().min(1, 'Bill Number is required'),
  amount: z.union([z.number(), z.string()]),
  dueDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export class PayablesController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreatePayableSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const payable = await PayablesService.createPayable({
        companyId,
        ...parsed.data,
        dueDate: new Date(parsed.data.dueDate),
      });

      res.status(201).json({
        success: true,
        data: payable,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAgingSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const summary = await PayablesService.getAgingSummary(
        companyId,
        req.query.supplierId as string | undefined
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

      const payables = await PayablesService.listPayables(companyId, {
        supplierId: req.query.supplierId as string | undefined,
        status: req.query.status as any,
      });

      res.json({
        success: true,
        data: payables,
      });
    } catch (err) {
      next(err);
    }
  }
}
