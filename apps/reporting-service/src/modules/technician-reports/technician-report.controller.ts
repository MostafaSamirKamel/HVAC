import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@hvac/errors';
import { TechnicianReportService } from './technician-report.service.js';

export class TechnicianReportController {
  private static getConsistencyMeta() {
    return {
      dataAsOf: new Date().toISOString(),
      projectionLagMs: 130,
      isEventuallyConsistent: true,
    };
  }

  static async getPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const data = await TechnicianReportService.getTechnicianPerformanceSummary(companyId, {
        branchId: req.query.branchId as string | undefined,
        technicianId: req.query.technicianId as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      res.json({
        success: true,
        data,
        meta: TechnicianReportController.getConsistencyMeta(),
      });
    } catch (err) {
      next(err);
    }
  }
}
