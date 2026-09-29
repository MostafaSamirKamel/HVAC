import { Router } from 'express';
import { FinanceReportController } from './finance-report.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const financeReportRoutes: Router = Router();

financeReportRoutes.use(requireInternalAuth);

financeReportRoutes.get('/profit-loss', requirePermission('reports:view'), FinanceReportController.getProfitLoss);
financeReportRoutes.get('/cash-flow', requirePermission('reports:view'), FinanceReportController.getCashFlow);
