import { Router } from 'express';
import { CustomerCreditProfileController } from './customer-credit-profile.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const customerCreditProfileRoutes: Router = Router({ mergeParams: true });

customerCreditProfileRoutes.use(requireInternalAuth);

customerCreditProfileRoutes.get('/', CustomerCreditProfileController.get);
customerCreditProfileRoutes.put('/', CustomerCreditProfileController.upsert);
customerCreditProfileRoutes.post('/block', CustomerCreditProfileController.block);
customerCreditProfileRoutes.post('/unblock', CustomerCreditProfileController.unblock);
customerCreditProfileRoutes.get('/evaluate', CustomerCreditProfileController.evaluate);
