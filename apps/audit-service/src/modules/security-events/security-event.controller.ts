import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { SecurityEventService } from './security-event.service.js';

const RecordSecurityEventSchema = z.object({
  branchId: z.string().optional(),
  eventId: z.string().optional(),
  eventType: z.string().min(1, 'Event type is required'),
  userId: z.string().optional(),
  userEmail: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('LOW'),
  details: z.record(z.unknown()).optional(),
});

export class SecurityEventController {
  static async record(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = RecordSecurityEventSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const event = await SecurityEventService.recordSecurityEvent({
        companyId,
        userId: req.authContext?.userId,
        userEmail: req.authContext?.email,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: event,
      });
    } catch (err) {
      next(err);
    }
  }

  static async query(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const result = await SecurityEventService.querySecurityEvents(companyId, {
        branchId: req.query.branchId as string | undefined,
        eventType: req.query.eventType as string | undefined,
        userId: req.query.userId as string | undefined,
        severity: req.query.severity as any,
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

  static async getAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const minSeverity = (req.query.minSeverity as any) || 'HIGH';
      const alerts = await SecurityEventService.getRecentAlerts(companyId, minSeverity);

      res.json({
        success: true,
        data: alerts,
      });
    } catch (err) {
      next(err);
    }
  }
}
