import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@hvac/errors';
import { ApprovalHistoryService } from './approval-history.service.js';

export class ApprovalHistoryController {
  static async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const history = await ApprovalHistoryService.getHistoryByRequestId(
        companyId,
        req.params.requestId
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (err) {
      next(err);
    }
  }
}
