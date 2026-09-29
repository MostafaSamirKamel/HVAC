import { Router } from 'express';
import { CashTransferController } from './cash-transfer.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const cashTransferRoutes: Router = Router();

cashTransferRoutes.use(requireInternalAuth);

cashTransferRoutes.post('/', CashTransferController.initiate);
cashTransferRoutes.get('/', CashTransferController.list);
cashTransferRoutes.post('/:id/complete', CashTransferController.complete);
