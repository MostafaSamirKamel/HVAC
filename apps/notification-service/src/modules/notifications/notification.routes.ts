import { Router } from 'express';
import { NotificationController } from './notification.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const notificationRoutes: Router = Router();

notificationRoutes.use(requireInternalAuth);

notificationRoutes.post('/', requirePermission('notifications:send'), NotificationController.send);
notificationRoutes.get('/me', NotificationController.listMyNotifications);
notificationRoutes.patch('/:id/read', NotificationController.markRead);
