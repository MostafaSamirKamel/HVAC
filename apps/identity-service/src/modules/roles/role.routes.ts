import { Router } from 'express';
import { RoleController } from './role.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';
import { SystemPermissions } from './permissions.constants.js';

export const roleRoutes: Router = Router();

roleRoutes.use(authenticate);

roleRoutes.post('/', requirePermission(SystemPermissions.IDENTITY_ROLES_MANAGE), RoleController.create);
roleRoutes.get('/', RoleController.list);
