import { Router } from 'express';
import { ProductController } from './product.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const productRoutes: Router = Router();

productRoutes.use(requireInternalAuth);

productRoutes.post('/', requirePermission('inventory:products:write'), ProductController.create);
productRoutes.get('/', requirePermission('inventory:products:read'), ProductController.list);
productRoutes.get('/:productId', requirePermission('inventory:products:read'), ProductController.getById);
