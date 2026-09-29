import { Router } from 'express';
import { WarrantyController } from './warranty.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const warrantyRoutes: Router = Router();

warrantyRoutes.use(requireInternalAuth);

warrantyRoutes.post('/', WarrantyController.register);
warrantyRoutes.get('/check/:serialNumber', WarrantyController.check);
