import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { AuditLogService } from './audit-log.service.js';

const RecordAuditLogSchema = z.object({
  branchId: z.string().optional(),
  eventId: z.string().optional(),
  eventType: z.string().min(1, 'Event type is required'),
  aggregateType: z.string().min(1, 'Aggregate type is required'),
  aggregateId: z.string().min(1, 'Aggregate ID is required'),
  action: z.string().min(1, 'Action is required'),
  payload: z.record(z.unknown()),
  diff: z.record(z.object({ before: z.unknown(), after: z.unknown() })).optional(),
});

export class AuditLogController {
  static async query(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const result = await AuditLogService.queryLogs(companyId, {
        branchId: req.query.branchId as string | undefined,
        aggregateType: req.query.aggregateType as string | undefined,
        aggregateId: req.query.aggregateId as string | undefined,
        userId: req.query.userId as string | undefined,
        action: req.query.action as string | undefined,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        skip: req.query.skip ? parseInt(req.query.skip as string, 10) : 0,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getEntityHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const { aggregateType, aggregateId } = req.params;
      const history = await AuditLogService.getEntityHistory(companyId, aggregateType, aggregateId);

      res.json({
        success: true,
        data: history,
      });
    } catch (err) {
      next(err);
    }
  }

  static async record(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = RecordAuditLogSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const log = await AuditLogService.recordLog({
        companyId,
        actor: req.authContext?.userId
          ? {
              userId: req.authContext.userId,
              roles: req.authContext.roles,
            }
          : undefined,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: log,
      });
    } catch (err) {
      next(err);
    }
  }
}
