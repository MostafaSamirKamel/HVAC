import { Request, Response, NextFunction } from 'express';
import { BranchService } from './branch.service.js';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';

const CreateBranchSchema = z.object({
  name: z.string().min(2, 'Branch name is required'),
  code: z.string().min(2, 'Branch code is required (e.g., CAI-01)'),
  phone: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
    })
    .optional(),
  isMainBranch: z.boolean().optional(),
});

export class BranchController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        throw new ForbiddenError('Tenant context required');
      }

      const parsed = CreateBranchSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const branch = await BranchService.createBranch({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: branch,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        throw new ForbiddenError('Tenant context required');
      }

      const branches = await BranchService.listBranches(companyId);
      res.status(200).json({
        success: true,
        data: branches,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        throw new ForbiddenError('Tenant context required');
      }

      const branch = await BranchService.getBranchById(companyId, req.params.branchId);
      res.status(200).json({
        success: true,
        data: branch,
      });
    } catch (err) {
      next(err);
    }
  }
}
