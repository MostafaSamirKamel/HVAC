import { Router } from 'express';
import { InventoryReportController } from './inventory-report.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const inventoryReportRoutes: Router = Router();

inventoryReportRoutes.use(requireInternalAuth);

inventoryReportRoutes.get('/valuation', requirePermission('reports:view'), InventoryReportController.getValuation);
inventoryReportRoutes.get('/turnover', requirePermission('reports:view'), InventoryReportController.getTurnover);
