import { Router } from 'express';
import { SalesReportController } from './sales-report.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const salesReportRoutes: Router = Router();

salesReportRoutes.use(requireInternalAuth);

salesReportRoutes.get('/funnel', requirePermission('reports:view'), SalesReportController.getFunnel);
salesReportRoutes.get('/categories', requirePermission('reports:view'), SalesReportController.getByProductCategory);
salesReportRoutes.get('/salespeople', requirePermission('reports:view'), SalesReportController.getSalespersonPerformance);
