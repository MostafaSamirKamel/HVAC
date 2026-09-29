import { Router } from 'express';
import { ReceivablesController } from './receivables.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const receivablesRoutes: Router = Router();

receivablesRoutes.use(requireInternalAuth);

receivablesRoutes.post('/', requirePermission('finance:receivables:create'), ReceivablesController.create);
receivablesRoutes.get('/summary', requirePermission('finance:receivables:view'), ReceivablesController.getAgingSummary);
receivablesRoutes.get('/', requirePermission('finance:receivables:view'), ReceivablesController.list);
