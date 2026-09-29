import { Router } from 'express';
import { NotificationTemplateController } from './notification-template.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const notificationTemplateRoutes: Router = Router();

notificationTemplateRoutes.use(requireInternalAuth);

notificationTemplateRoutes.get('/', requirePermission('notifications:view'), NotificationTemplateController.list);
notificationTemplateRoutes.get('/:templateId', requirePermission('notifications:view'), NotificationTemplateController.getById);
notificationTemplateRoutes.post('/', requirePermission('notifications:manage'), NotificationTemplateController.create);
notificationTemplateRoutes.put('/:templateId', requirePermission('notifications:manage'), NotificationTemplateController.update);
