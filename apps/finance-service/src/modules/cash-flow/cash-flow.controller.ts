import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@hvac/errors';
import { CashFlowService } from './cash-flow.service.js';

export class CashFlowController {
  static async getReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const report = await CashFlowService.generateReport(companyId, {
        branchId: req.query.branchId as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      res.json({
        success: true,
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }
}
