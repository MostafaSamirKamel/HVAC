import { Router } from 'express';
import { BankAccountController } from './bank-account.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const bankAccountRoutes: Router = Router();

bankAccountRoutes.use(requireInternalAuth);

bankAccountRoutes.post('/', requirePermission('finance:bank:create'), BankAccountController.create);
bankAccountRoutes.get('/', requirePermission('finance:bank:view'), BankAccountController.list);
bankAccountRoutes.get('/:id', requirePermission('finance:bank:view'), BankAccountController.getById);
