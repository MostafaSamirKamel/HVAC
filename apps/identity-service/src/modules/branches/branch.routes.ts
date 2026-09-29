import { Router } from 'express';
import { BranchController } from './branch.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';
import { SystemPermissions } from '../roles/permissions.constants.js';

export const branchRoutes: Router = Router();

branchRoutes.use(authenticate);

branchRoutes.post('/', requirePermission(SystemPermissions.IDENTITY_BRANCHES_MANAGE), BranchController.create);
branchRoutes.get('/', BranchController.list);
branchRoutes.get('/:branchId', BranchController.getById);
