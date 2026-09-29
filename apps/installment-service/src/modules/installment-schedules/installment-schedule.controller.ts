import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@hvac/errors';
import { InstallmentScheduleService } from './installment-schedule.service.js';

export class InstallmentScheduleController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const dueBefore = req.query.dueBefore ? new Date(req.query.dueBefore as string) : undefined;
      const dueAfter = req.query.dueAfter ? new Date(req.query.dueAfter as string) : undefined;

      const schedules = await InstallmentScheduleService.listSchedules(companyId, {
        status: req.query.status as any,
        dueBefore,
        dueAfter,
      });

      res.json({
        success: true,
        data: schedules,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const schedule = await InstallmentScheduleService.getById(companyId, req.params.id);

      res.json({
        success: true,
        data: schedule,
      });
    } catch (err) {
      next(err);
    }
  }
}
