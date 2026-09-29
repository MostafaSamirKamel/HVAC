import { Router } from 'express';
import { PriceListController } from './price-list.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const priceListRoutes: Router = Router();

priceListRoutes.use(requireInternalAuth);

priceListRoutes.post('/', requirePermission('sales:orders:create'), PriceListController.create);
priceListRoutes.get('/', requirePermission('sales:orders:read'), PriceListController.list);
priceListRoutes.get('/:priceListId', requirePermission('sales:orders:read'), PriceListController.getById);
