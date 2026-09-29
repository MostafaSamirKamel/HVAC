import { Router } from 'express';
import { PaymentController } from './payment.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const paymentRoutes: Router = Router();

paymentRoutes.use(requireInternalAuth);

paymentRoutes.post('/collect', PaymentController.collect);
paymentRoutes.post('/post-invoice-journal', PaymentController.postInvoiceJournal);
paymentRoutes.post('/rollback', PaymentController.rollback);
paymentRoutes.post('/rollback-journal', PaymentController.rollbackJournal);
paymentRoutes.get('/', PaymentController.list);
