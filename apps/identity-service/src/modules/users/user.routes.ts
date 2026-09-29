import { Router } from 'express';
import { UserController } from './user.controller.js';
import { authenticate, requirePermission } from '../../middleware/auth.middleware.js';
import { SystemPermissions } from '../roles/permissions.constants.js';

export const userRoutes: Router = Router();

userRoutes.use(authenticate);

userRoutes.post('/', requirePermission(SystemPermissions.IDENTITY_USERS_CREATE), UserController.create);
userRoutes.get('/', requirePermission(SystemPermissions.IDENTITY_USERS_READ), UserController.list);
userRoutes.get('/:userId', requirePermission(SystemPermissions.IDENTITY_USERS_READ), UserController.getById);
userRoutes.patch('/:userId/roles', requirePermission(SystemPermissions.IDENTITY_ROLES_MANAGE), UserController.updateRoles);
