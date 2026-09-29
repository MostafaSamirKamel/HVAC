import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '@hvac/errors';
import { NotificationDeliveryService } from './notification-delivery.service.js';

export class NotificationDeliveryController {
  static async getDeliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const deliveries = await NotificationDeliveryService.getDeliveriesByNotificationId(
        companyId,
        req.params.notificationId
      );

      res.json({
        success: true,
        data: deliveries,
      });
    } catch (err) {
      next(err);
    }
  }
}
