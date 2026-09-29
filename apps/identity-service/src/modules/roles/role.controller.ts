import { Request, Response, NextFunction } from 'express';
import { RoleService } from './role.service.js';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';

const CreateRoleSchema = z.object({
  name: z.string().min(2, 'Role name is required (e.g., JUNIOR_ACCOUNTANT)'),
  displayName: z.string().min(2, 'Display name is required'),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
});

export class RoleController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const role = await RoleService.createCustomRole(
        companyId,
        parsed.data.name,
        parsed.data.displayName,
        parsed.data.permissions,
      );

      res.status(201).json({
        success: true,
        data: role,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const roles = await RoleService.listRoles(companyId);
      res.status(200).json({
        success: true,
        data: roles,
      });
    } catch (err) {
      next(err);
    }
  }
}
