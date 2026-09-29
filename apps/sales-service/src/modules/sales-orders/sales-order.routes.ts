import { Router } from 'express';
import { SalesOrderController } from './sales-order.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const salesOrderRoutes: Router = Router();

salesOrderRoutes.use(requireInternalAuth);

salesOrderRoutes.post('/', requirePermission('sales:orders:create'), SalesOrderController.create);
salesOrderRoutes.get('/', requirePermission('sales:orders:read'), SalesOrderController.list);
salesOrderRoutes.get('/:orderId', requirePermission('sales:orders:read'), SalesOrderController.getById);
