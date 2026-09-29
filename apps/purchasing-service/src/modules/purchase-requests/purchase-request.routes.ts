import { Router } from 'express';
import { PurchaseRequestController } from './purchase-request.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const purchaseRequestRoutes: Router = Router();

purchaseRequestRoutes.use(requireInternalAuth);

purchaseRequestRoutes.post('/', PurchaseRequestController.create);
purchaseRequestRoutes.get('/', PurchaseRequestController.list);
purchaseRequestRoutes.get('/:id', PurchaseRequestController.getById);
purchaseRequestRoutes.post('/:id/submit', PurchaseRequestController.submit);
purchaseRequestRoutes.post('/:id/approve', PurchaseRequestController.approve);
purchaseRequestRoutes.post('/:id/reject', PurchaseRequestController.reject);
purchaseRequestRoutes.post('/:id/convert-to-po', PurchaseRequestController.convertToPO);
