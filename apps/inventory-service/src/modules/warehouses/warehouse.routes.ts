import { Router } from 'express';
import { WarehouseController } from './warehouse.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const warehouseRoutes: Router = Router();

warehouseRoutes.use(requireInternalAuth);

warehouseRoutes.post('/', requirePermission('inventory:stock:adjust'), WarehouseController.create);
warehouseRoutes.get('/', requirePermission('inventory:stock:read'), WarehouseController.list);
warehouseRoutes.get('/:warehouseId', requirePermission('inventory:stock:read'), WarehouseController.getById);
