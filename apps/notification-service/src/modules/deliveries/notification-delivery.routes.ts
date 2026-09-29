import { Router } from 'express';
import { NotificationDeliveryController } from './notification-delivery.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const notificationDeliveryRoutes: Router = Router();

notificationDeliveryRoutes.use(requireInternalAuth);

notificationDeliveryRoutes.get(
  '/:notificationId/deliveries',
  requirePermission('notifications:view'),
  NotificationDeliveryController.getDeliveries
);
