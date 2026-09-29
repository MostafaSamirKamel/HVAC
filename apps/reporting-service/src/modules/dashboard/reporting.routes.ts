import { Router } from 'express';
import { ReportingController } from './reporting.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const reportingRoutes: Router = Router();

reportingRoutes.use(requireInternalAuth);

reportingRoutes.post('/closing', requirePermission('reporting:closing:create'), ReportingController.recordDailyClosing);
reportingRoutes.get('/closing', requirePermission('reporting:closing:view'), ReportingController.getDailyClosing);
reportingRoutes.get('/dashboard', requirePermission('reporting:dashboard:view'), ReportingController.getExecutiveDashboard);
reportingRoutes.get('/branches/:branchId/performance', requirePermission('reporting:branch:view'), ReportingController.getBranchPerformance);
