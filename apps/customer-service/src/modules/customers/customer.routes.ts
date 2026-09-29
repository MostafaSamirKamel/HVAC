import { Router } from 'express';
import { CustomerController } from './customer.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const customerRoutes: Router = Router();

customerRoutes.use(requireInternalAuth);

customerRoutes.post('/', CustomerController.create);
customerRoutes.get('/', CustomerController.list);
customerRoutes.get('/:id', CustomerController.getById);
customerRoutes.patch('/:id/credit-limit', CustomerController.updateCreditLimit);
customerRoutes.get('/:id/credit-eligibility', CustomerController.checkCreditEligibility);
customerRoutes.post('/:id/addresses', CustomerController.addAddress);
customerRoutes.get('/:id/addresses', CustomerController.getAddresses);
