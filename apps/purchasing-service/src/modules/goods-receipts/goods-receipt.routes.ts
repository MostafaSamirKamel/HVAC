import { Router } from 'express';
import { GoodsReceiptController } from './goods-receipt.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const goodsReceiptRoutes: Router = Router();

goodsReceiptRoutes.use(requireInternalAuth);

goodsReceiptRoutes.post('/receive', GoodsReceiptController.receive);
goodsReceiptRoutes.get('/', GoodsReceiptController.list);
goodsReceiptRoutes.get('/:id', GoodsReceiptController.getById);
