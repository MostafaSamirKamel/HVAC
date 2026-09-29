import { Router } from 'express';
import { InstallmentContractController } from './installment-contract.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const installmentContractRoutes: Router = Router();

installmentContractRoutes.use(requireInternalAuth);

installmentContractRoutes.post('/', InstallmentContractController.create);
installmentContractRoutes.get('/', InstallmentContractController.list);
installmentContractRoutes.get('/:id', InstallmentContractController.getById);
installmentContractRoutes.post('/:id/pay', InstallmentContractController.pay);
installmentContractRoutes.post('/process-overdue', InstallmentContractController.processOverdue);
