import { Router } from 'express';
import { SecurityEventController } from './security-event.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const securityEventRoutes: Router = Router();

securityEventRoutes.use(requireInternalAuth);

securityEventRoutes.get('/', requirePermission('audit:security:view'), SecurityEventController.query);
securityEventRoutes.get('/alerts', requirePermission('audit:security:view'), SecurityEventController.getAlerts);
securityEventRoutes.post('/', requirePermission('audit:security:write'), SecurityEventController.record);
