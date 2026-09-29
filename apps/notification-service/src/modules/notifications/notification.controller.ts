import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { NotificationService } from './notification.service.js';

const SendNotificationSchema = z.object({
  branchId: z.string().optional(),
  recipientId: z.string().min(1, 'Recipient ID is required'),
  recipientContact: z.string().min(1, 'Recipient contact is required'),
  channel: z.enum(['SMS', 'WHATSAPP', 'EMAIL', 'IN_APP']),
  type: z.string().min(1, 'Type is required'),
  title: z.string().min(1, 'Title is required'),
  message: z.string().min(1, 'Message is required'),
  metadata: z.record(z.unknown()).optional(),
});

export class NotificationController {
  static async send(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = SendNotificationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const notification = await NotificationService.sendNotification({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: notification,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listMyNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const userId = req.authContext?.userId;
      if (!companyId || !userId) throw new ForbiddenError('Tenant and user context required');

      const notifications = await NotificationService.getRecipientNotifications(companyId, userId, {
        unreadOnly: req.query.unreadOnly === 'true',
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      });

      res.json({
        success: true,
        data: notifications,
      });
    } catch (err) {
      next(err);
    }
  }

  static async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const userId = req.authContext?.userId;
      if (!companyId || !userId) throw new ForbiddenError('Tenant and user context required');

      const notification = await NotificationService.markAsRead(companyId, req.params.id, userId);

      res.json({
        success: true,
        data: notification,
      });
    } catch (err) {
      next(err);
    }
  }
}
