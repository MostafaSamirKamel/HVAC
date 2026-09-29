import { Router } from 'express';
import { TechnicianReportController } from './technician-report.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const technicianReportRoutes: Router = Router();

technicianReportRoutes.use(requireInternalAuth);

technicianReportRoutes.get('/performance', requirePermission('reports:view'), TechnicianReportController.getPerformance);
