import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@hvac/errors';
import { OverdueProcessingService } from './overdue-processing.service.js';

export class OverdueProcessingController {
  static async triggerBatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const gracePeriod = req.body.gracePeriodDays ? Number(req.body.gracePeriodDays) : undefined;
      const defaultAfterDays = req.body.defaultAfterDays ? Number(req.body.defaultAfterDays) : undefined;

      const result = await OverdueProcessingService.processOverdues(companyId, {
        gracePeriodDays: gracePeriod,
        defaultAfterDays,
      });

      res.json({
        success: true,
        message: 'Overdue batch processing completed',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAgingReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const report = await OverdueProcessingService.getAgingReport(companyId);

      res.json({
        success: true,
        data: report,
      });
    } catch (err) {
      next(err);
    }
  }
}
