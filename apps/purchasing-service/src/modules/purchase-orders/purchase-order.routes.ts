import { Router } from 'express';
import { PurchaseOrderController } from './purchase-order.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const purchaseOrderRoutes: Router = Router();

purchaseOrderRoutes.use(requireInternalAuth);

purchaseOrderRoutes.post('/', PurchaseOrderController.create);
purchaseOrderRoutes.get('/', PurchaseOrderController.list);
purchaseOrderRoutes.get('/:id', PurchaseOrderController.getById);
purchaseOrderRoutes.post('/:id/approve', PurchaseOrderController.approve);
