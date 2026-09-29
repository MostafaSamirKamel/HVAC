import { Router } from 'express';
import { PurchaseReturnController } from './purchase-return.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const purchaseReturnRoutes: Router = Router();

purchaseReturnRoutes.use(requireInternalAuth);

purchaseReturnRoutes.post('/', PurchaseReturnController.create);
purchaseReturnRoutes.get('/', PurchaseReturnController.list);
purchaseReturnRoutes.get('/:id', PurchaseReturnController.getById);
purchaseReturnRoutes.post('/:id/approve', PurchaseReturnController.approve);
