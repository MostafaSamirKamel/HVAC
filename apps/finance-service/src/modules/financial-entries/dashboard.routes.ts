import { Router } from 'express';
import { FinanceDashboardController } from './dashboard.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const dashboardRoutes: Router = Router();

dashboardRoutes.use(requireInternalAuth);

dashboardRoutes.get('/', requirePermission('finance:dashboard:view'), FinanceDashboardController.getSummary);
