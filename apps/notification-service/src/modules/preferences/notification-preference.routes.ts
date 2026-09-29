import { Router } from 'express';
import { NotificationPreferenceController } from './notification-preference.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const notificationPreferenceRoutes: Router = Router();

notificationPreferenceRoutes.use(requireInternalAuth);

notificationPreferenceRoutes.get('/me', NotificationPreferenceController.getMyPreferences);
notificationPreferenceRoutes.put('/me', NotificationPreferenceController.updateMyPreferences);
