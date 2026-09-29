import { Router } from 'express';
import { SupplierController } from './supplier.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const supplierRoutes: Router = Router();

supplierRoutes.use(requireInternalAuth);

supplierRoutes.post('/', SupplierController.create);
supplierRoutes.get('/', SupplierController.list);
supplierRoutes.get('/:id', SupplierController.getById);
