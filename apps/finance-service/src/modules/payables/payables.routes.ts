import { Router } from 'express';
import { PayablesController } from './payables.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const payablesRoutes: Router = Router();

payablesRoutes.use(requireInternalAuth);

payablesRoutes.post('/', requirePermission('finance:payables:create'), PayablesController.create);
payablesRoutes.get('/summary', requirePermission('finance:payables:view'), PayablesController.getAgingSummary);
payablesRoutes.get('/', requirePermission('finance:payables:view'), PayablesController.list);
