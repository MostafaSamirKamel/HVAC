import { Router } from 'express';
import { SupplierLedgerController } from './supplier-ledger.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const supplierLedgerRoutes: Router = Router();

supplierLedgerRoutes.use(requireInternalAuth);

supplierLedgerRoutes.post('/', requirePermission('finance:supplier-ledger:create'), SupplierLedgerController.record);
supplierLedgerRoutes.get('/:supplierId/statement', requirePermission('finance:supplier-ledger:view'), SupplierLedgerController.getStatement);
