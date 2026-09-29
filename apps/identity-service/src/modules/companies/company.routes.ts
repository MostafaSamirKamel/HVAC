import { Router } from 'express';
import { CompanyController } from './company.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';
import { SystemPermissions } from '../roles/permissions.constants.js';

export const companyRoutes: Router = Router();

// Public route to register first company or by super admin
companyRoutes.post('/', CompanyController.create);
companyRoutes.get('/', authenticate, requirePermission(SystemPermissions.IDENTITY_BRANCHES_MANAGE), CompanyController.list);
companyRoutes.get('/:companyId', authenticate, CompanyController.getById);
