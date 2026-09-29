import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { ApprovalRuleService } from './approval-rule.service.js';

const CreateApprovalRuleSchema = z.object({
  branchId: z.string().optional(),
  ruleId: z.string().optional(),
  ruleName: z.string().min(1, 'Rule name is required'),
  requestType: z.string().min(1, 'Request type is required'),
  minAmount: z.union([z.number(), z.string()]).optional(),
  maxAmount: z.union([z.number(), z.string()]).optional(),
  minDiscountPercent: z.number().min(0).max(100).optional(),
  maxDiscountPercent: z.number().min(0).max(100).optional(),
  requiredRole: z.string().min(1, 'Required role is required'),
  approvalLevel: z.number().int().min(1).default(1),
  autoApproveBelowMin: z.boolean().default(false),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
});

const UpdateApprovalRuleSchema = z.object({
  ruleName: z.string().min(1).optional(),
  minAmount: z.union([z.number(), z.string()]).nullable().optional(),
  maxAmount: z.union([z.number(), z.string()]).nullable().optional(),
  minDiscountPercent: z.number().min(0).max(100).optional(),
  maxDiscountPercent: z.number().min(0).max(100).optional(),
  requiredRole: z.string().min(1).optional(),
  approvalLevel: z.number().int().min(1).optional(),
  autoApproveBelowMin: z.boolean().optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional(),
});

export class ApprovalRuleController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateApprovalRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      if (parsed.data.branchId) {
        req.authContext?.requireBranchAccess(parsed.data.branchId);
      }

      const rule = await ApprovalRuleService.createRule({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: rule,
      });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = UpdateApprovalRuleSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const rule = await ApprovalRuleService.updateRule(
        companyId,
        req.params.ruleId,
        parsed.data
      );

      res.json({
        success: true,
        data: rule,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const rule = await ApprovalRuleService.getRuleById(companyId, req.params.ruleId);

      res.json({
        success: true,
        data: rule,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const rules = await ApprovalRuleService.listRules(companyId, {
        requestType: req.query.requestType as string | undefined,
        isActive: req.query.isActive === undefined ? undefined : req.query.isActive === 'true',
        branchId: req.query.branchId as string | undefined,
      });

      res.json({
        success: true,
        data: rules,
      });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      await ApprovalRuleService.deleteRule(companyId, req.params.ruleId);

      res.json({
        success: true,
        message: 'Approval rule deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}
