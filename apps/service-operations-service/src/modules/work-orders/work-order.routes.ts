import { Router } from 'express';
import { WorkOrderController } from './work-order.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const workOrderRoutes: Router = Router();

workOrderRoutes.use(requireInternalAuth);

workOrderRoutes.post('/', WorkOrderController.create);
workOrderRoutes.get('/', WorkOrderController.list);
workOrderRoutes.get('/:id', WorkOrderController.getById);
workOrderRoutes.post('/:id/start', WorkOrderController.start);
workOrderRoutes.post('/:id/complete', WorkOrderController.complete);
