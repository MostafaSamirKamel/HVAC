import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { ReportingService } from './reporting.service.js';

const RecordDailyClosingSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  treasuryId: z.string().min(1, 'Treasury ID is required'),
  closingDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  openingBalance: z.union([z.number(), z.string()]),
  totalCashIn: z.union([z.number(), z.string()]),
  totalCashOut: z.union([z.number(), z.string()]),
  actualBalance: z.union([z.number(), z.string()]),
  notes: z.string().optional(),
  varianceApprovalThreshold: z.number().optional(),
});

export class ReportingController {
  static async recordDailyClosing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const closedBy = req.authContext?.userId;
      if (!companyId || !closedBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = RecordDailyClosingSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const closing = await ReportingService.recordDailyClosing({
        companyId,
        closedBy,
        ...parsed.data,
        closingDate: new Date(parsed.data.closingDate),
      });

      res.status(201).json({
        success: true,
        data: closing,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getDailyClosing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const branchId = req.query.branchId as string;
      const dateStr = req.query.date as string;

      if (!branchId || !dateStr) {
        throw new ValidationError('branchId and date are required query parameters');
      }

      const closings = await ReportingService.getDailyClosing(
        companyId,
        branchId,
        new Date(dateStr)
      );

      res.json({
        success: true,
        data: closings,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getExecutiveDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const dashboard = await ReportingService.getExecutiveDashboard(companyId);

      res.json({
        success: true,
        data: dashboard,
        meta: {
          dataAsOf: new Date().toISOString(),
          projectionLagMs: 150,
          isEventuallyConsistent: true,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getBranchPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const branchId = req.params.branchId;
      req.authContext?.requireBranchAccess(branchId);

      const performance = await ReportingService.getBranchPerformance(
        companyId,
        branchId,
        req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        req.query.toDate ? new Date(req.query.toDate as string) : undefined
      );

      res.json({
        success: true,
        data: performance,
        meta: {
          dataAsOf: new Date().toISOString(),
          projectionLagMs: 150,
          isEventuallyConsistent: true,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
