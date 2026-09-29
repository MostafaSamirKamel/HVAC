import { Router } from 'express';
import { VendorBillController } from './vendor-bill.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const vendorBillRoutes: Router = Router();

vendorBillRoutes.use(requireInternalAuth);

vendorBillRoutes.post('/', VendorBillController.create);
vendorBillRoutes.get('/', VendorBillController.list);
vendorBillRoutes.get('/:id', VendorBillController.getById);
vendorBillRoutes.post('/:id/post', VendorBillController.post);
