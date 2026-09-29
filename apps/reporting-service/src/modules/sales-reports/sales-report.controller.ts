import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@hvac/errors';
import { SalesReportService } from './sales-report.service.js';

export class SalesReportController {
  private static getConsistencyMeta() {
    return {
      dataAsOf: new Date().toISOString(),
      projectionLagMs: 140,
      isEventuallyConsistent: true,
    };
  }

  static async getFunnel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const data = await SalesReportService.getSalesFunnel(companyId, {
        branchId: req.query.branchId as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      res.json({
        success: true,
        data,
        meta: SalesReportController.getConsistencyMeta(),
      });
    } catch (err) {
      next(err);
    }
  }

  static async getByProductCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const data = await SalesReportService.getSalesByProductCategory(companyId, {
        branchId: req.query.branchId as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      res.json({
        success: true,
        data,
        meta: SalesReportController.getConsistencyMeta(),
      });
    } catch (err) {
      next(err);
    }
  }

  static async getSalespersonPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const data = await SalesReportService.getSalespersonPerformance(companyId, {
        branchId: req.query.branchId as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
      });

      res.json({
        success: true,
        data,
        meta: SalesReportController.getConsistencyMeta(),
      });
    } catch (err) {
      next(err);
    }
  }
}
