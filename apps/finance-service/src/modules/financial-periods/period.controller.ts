import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { FinancialPeriodService } from './period.service.js';

const CreatePeriodSchema = z.object({
  periodName: z.string().min(1, 'Period name is required'),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export class FinancialPeriodController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreatePeriodSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const period = await FinancialPeriodService.createPeriod(
        companyId,
        parsed.data.periodName,
        new Date(parsed.data.startDate),
        new Date(parsed.data.endDate)
      );

      res.status(201).json({
        success: true,
        data: period,
      });
    } catch (err) {
      next(err);
    }
  }

  static async close(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const closedBy = req.authContext?.userId;
      if (!companyId || !closedBy) throw new ForbiddenError('Tenant and user context required');

      const period = await FinancialPeriodService.closePeriod(companyId, req.params.id, closedBy);

      res.json({
        success: true,
        message: 'Financial period closed successfully',
        data: period,
      });
    } catch (err) {
      next(err);
    }
  }

  static async lock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const period = await FinancialPeriodService.lockPeriod(companyId, req.params.id);

      res.json({
        success: true,
        message: 'Financial period permanently locked',
        data: period,
      });
    } catch (err) {
      next(err);
    }
  }

  static async reopen(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const reopenedBy = req.authContext?.userId;
      if (!companyId || !reopenedBy) throw new ForbiddenError('Tenant and user context required');

      const period = await FinancialPeriodService.reopenPeriod(
        companyId,
        req.params.id,
        reopenedBy
      );

      res.json({
        success: true,
        message: 'Financial period reopened',
        data: period,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const periods = await FinancialPeriodService.listPeriods(companyId);

      res.json({
        success: true,
        data: periods,
      });
    } catch (err) {
      next(err);
    }
  }
}
