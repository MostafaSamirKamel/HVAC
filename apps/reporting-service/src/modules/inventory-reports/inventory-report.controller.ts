import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@hvac/errors';
import { InventoryReportService } from './inventory-report.service.js';

export class InventoryReportController {
  private static getConsistencyMeta() {
    return {
      dataAsOf: new Date().toISOString(),
      projectionLagMs: 160,
      isEventuallyConsistent: true,
    };
  }

  static async getValuation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const data = await InventoryReportService.getInventoryValuation(companyId, {
        warehouseId: req.query.warehouseId as string | undefined,
        category: req.query.category as string | undefined,
      });

      res.json({
        success: true,
        data,
        meta: InventoryReportController.getConsistencyMeta(),
      });
    } catch (err) {
      next(err);
    }
  }

  static async getTurnover(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const data = await InventoryReportService.getInventoryTurnover(companyId, {
        warehouseId: req.query.warehouseId as string | undefined,
        category: req.query.category as string | undefined,
      });

      res.json({
        success: true,
        data,
        meta: InventoryReportController.getConsistencyMeta(),
      });
    } catch (err) {
      next(err);
    }
  }
}
