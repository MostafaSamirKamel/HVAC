import { Router } from 'express';
import { AccountController } from './account.controller.js';
import { requireInternalAuth } from '../../middleware/auth.middleware.js';

export const accountRoutes: Router = Router();

accountRoutes.use(requireInternalAuth);

accountRoutes.post('/', AccountController.create);
accountRoutes.get('/', AccountController.list);
accountRoutes.post('/standard-accounts', AccountController.ensureStandard);
