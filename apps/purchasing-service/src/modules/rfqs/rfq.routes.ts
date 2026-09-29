import { Router } from 'express';
import { RFQController } from './rfq.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const rfqRoutes: Router = Router();

rfqRoutes.use(requireInternalAuth);

rfqRoutes.post('/', RFQController.create);
rfqRoutes.get('/', RFQController.list);
rfqRoutes.get('/:id', RFQController.getById);
rfqRoutes.post('/:id/quotations', RFQController.addQuotation);
rfqRoutes.post('/:id/award', RFQController.award);
