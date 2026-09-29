import { Router } from 'express';
import { SalesInvoiceController } from './sales-invoice.controller.js';
import { requireInternalAuth, requirePermission } from '../../middleware/auth.middleware.js';

export const salesInvoiceRoutes: Router = Router();

salesInvoiceRoutes.use(requireInternalAuth);

salesInvoiceRoutes.get('/', requirePermission('sales:orders:read'), SalesInvoiceController.list);
salesInvoiceRoutes.get('/:invoiceId', requirePermission('sales:orders:read'), SalesInvoiceController.getById);
