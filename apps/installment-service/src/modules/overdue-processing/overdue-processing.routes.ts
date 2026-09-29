import { Router } from 'express';
import { OverdueProcessingController } from './overdue-processing.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const overdueProcessingRoutes: Router = Router();

overdueProcessingRoutes.use(requireInternalAuth);

overdueProcessingRoutes.post('/process', OverdueProcessingController.triggerBatch);
overdueProcessingRoutes.get('/aging-report', OverdueProcessingController.getAgingReport);
