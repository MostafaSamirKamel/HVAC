import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@hvac/errors';
import { FinanceReportService } from './finance-report.service.js';

export class FinanceReportController {
  private static getConsistencyMeta() {
    return {
      dataAsOf: new Date().toISOString(),
      projectionLagMs: 150,
      isEventuallyConsistent: true,
    };
  }

  static async getProfitLoss(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const data = await FinanceReportService.getProfitAndLossSummary(companyId, {
        branchId: req.query.branchId as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      res.json({
        success: true,
        data,
        meta: FinanceReportController.getConsistencyMeta(),
      });
    } catch (err) {
      next(err);
    }
  }

  static async getCashFlow(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const data = await FinanceReportService.getCashFlowSummary(companyId, {
        branchId: req.query.branchId as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      res.json({
        success: true,
        data,
        meta: FinanceReportController.getConsistencyMeta(),
      });
    } catch (err) {
      next(err);
    }
  }
}
