import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service.js';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';

const CreateUserSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Valid email required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().min(2, 'Full name required'),
  phone: z.string().optional(),
  roles: z.array(z.string()).min(1, 'At least one role required'),
  userBranchId: z.string().optional(),
  allowedBranchIds: z.array(z.string()).optional(),
  isSuperAdmin: z.boolean().optional(),
});

const UpdateUserRolesSchema = z.object({
  roles: z.array(z.string()).min(1, 'At least one role required'),
  userBranchId: z.string().optional(),
  allowedBranchIds: z.array(z.string()).optional(),
});

export class UserController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const user = await UserService.createUser({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: {
          userId: user.userId,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          roles: user.roles,
          userBranchId: user.userBranchId,
          allowedBranchIds: user.allowedBranchIds,
          isSuperAdmin: user.isSuperAdmin,
          isActive: user.isActive,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const branchId = (req.query.branchId as string) || undefined;
      const users = await UserService.listUsers(companyId, branchId);

      res.status(200).json({
        success: true,
        data: users.map((u) => ({
          userId: u.userId,
          username: u.username,
          email: u.email,
          fullName: u.fullName,
          phone: u.phone,
          roles: u.roles,
          userBranchId: u.userBranchId,
          allowedBranchIds: u.allowedBranchIds,
          isSuperAdmin: u.isSuperAdmin,
          isActive: u.isActive,
          lastLoginAt: u.lastLoginAt,
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const user = await UserService.getUserById(companyId, req.params.userId);
      res.status(200).json({
        success: true,
        data: {
          userId: user.userId,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          roles: user.roles,
          userBranchId: user.userBranchId,
          allowedBranchIds: user.allowedBranchIds,
          isSuperAdmin: user.isSuperAdmin,
          isActive: user.isActive,
          lastLoginAt: user.lastLoginAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = UpdateUserRolesSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const updated = await UserService.updateUserRoles(
        companyId,
        req.params.userId,
        parsed.data.roles,
        parsed.data.userBranchId,
        parsed.data.allowedBranchIds,
      );

      res.status(200).json({
        success: true,
        data: {
          userId: updated.userId,
          roles: updated.roles,
          permissionVersion: updated.permissionVersion,
          userBranchId: updated.userBranchId,
          allowedBranchIds: updated.allowedBranchIds,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
