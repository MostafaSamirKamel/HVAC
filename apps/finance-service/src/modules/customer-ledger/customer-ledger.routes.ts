import { Router } from 'express';
import { CustomerLedgerController } from './customer-ledger.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const customerLedgerRoutes: Router = Router();

customerLedgerRoutes.use(requireInternalAuth);

customerLedgerRoutes.post('/', requirePermission('finance:customer-ledger:create'), CustomerLedgerController.record);
customerLedgerRoutes.get('/:customerId/statement', requirePermission('finance:customer-ledger:view'), CustomerLedgerController.getStatement);
