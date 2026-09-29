import { Router } from 'express';
import { CashSaleController } from './cash-sale.controller.js';
import { HttpInventoryAdapter } from '../../infrastructure/adapters/inventory.adapter.js';
import { HttpFinanceAdapter } from '../../infrastructure/adapters/finance.adapter.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const cashSaleRoutes: Router = Router();

cashSaleRoutes.use(requireInternalAuth);

const controller = new CashSaleController(
  new HttpInventoryAdapter(),
  new HttpFinanceAdapter(),
);

cashSaleRoutes.post('/', requirePermission('sales:orders:create'), controller.execute);
