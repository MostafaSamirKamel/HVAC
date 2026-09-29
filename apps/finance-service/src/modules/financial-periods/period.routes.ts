import { Router } from 'express';
import { FinancialPeriodController } from './period.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const periodRoutes: Router = Router();

periodRoutes.use(requireInternalAuth);

periodRoutes.post('/', requirePermission('finance:period:create'), FinancialPeriodController.create);
periodRoutes.get('/', requirePermission('finance:period:view'), FinancialPeriodController.list);
periodRoutes.patch('/:id/close', requirePermission('finance:period:close'), FinancialPeriodController.close);
periodRoutes.patch('/:id/lock', requirePermission('finance:period:lock'), FinancialPeriodController.lock);
periodRoutes.patch('/:id/reopen', requirePermission('finance:period:reopen'), FinancialPeriodController.reopen);
