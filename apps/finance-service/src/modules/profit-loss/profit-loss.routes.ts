import { Router } from 'express';
import { ProfitLossController } from './profit-loss.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const profitLossRoutes: Router = Router();

profitLossRoutes.use(requireInternalAuth);

profitLossRoutes.get('/', requirePermission('finance:reports:view'), ProfitLossController.getReport);
