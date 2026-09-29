import { Router } from 'express';
import { CashFlowController } from './cash-flow.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const cashFlowRoutes: Router = Router();

cashFlowRoutes.use(requireInternalAuth);

cashFlowRoutes.get('/', requirePermission('finance:reports:view'), CashFlowController.getReport);
