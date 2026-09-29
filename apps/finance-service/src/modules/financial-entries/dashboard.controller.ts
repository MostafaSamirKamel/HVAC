import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@hvac/errors';
import { FinanceDashboardService } from './dashboard.service.js';

export class FinanceDashboardController {
  static async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const summary = await FinanceDashboardService.getDashboardSummary(companyId, {
        branchId: req.query.branchId as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      res.json({
        success: true,
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }
}
