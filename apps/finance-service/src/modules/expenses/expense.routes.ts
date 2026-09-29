import { Router } from 'express';
import { ExpenseController } from './expense.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const expenseRoutes: Router = Router();

expenseRoutes.use(requireInternalAuth);

expenseRoutes.post('/', requirePermission('finance:expense:create'), ExpenseController.record);
expenseRoutes.get('/', requirePermission('finance:expense:view'), ExpenseController.list);
