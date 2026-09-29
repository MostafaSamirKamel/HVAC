import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@hvac/errors';
import { ActivityHistoryService } from './activity-history.service.js';

export class ActivityHistoryController {
  static async getUserTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : 0;

      const result = await ActivityHistoryService.getUserActivityTimeline(
        companyId,
        req.params.userId,
        limit,
        skip
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getBranchTimeline(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      req.authContext?.requireBranchAccess(req.params.branchId);

      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : 0;

      const result = await ActivityHistoryService.getBranchActivityTimeline(
        companyId,
        req.params.branchId,
        limit,
        skip
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : undefined;
      const toDate = req.query.toDate ? new Date(req.query.toDate as string) : undefined;

      const summary = await ActivityHistoryService.getActivitySummary(
        companyId,
        fromDate,
        toDate
      );

      res.json({
        success: true,
        data: summary,
      });
    } catch (err) {
      next(err);
    }
  }
}
