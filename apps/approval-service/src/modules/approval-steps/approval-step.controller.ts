import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ForbiddenError, ValidationError } from '@hvac/errors';
import { ApprovalStepService } from './approval-step.service.js';

const ApproveStepSchema = z.object({
  notes: z.string().optional(),
});

const RejectStepSchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
});

export class ApprovalStepController {
  static async getSteps(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const steps = await ApprovalStepService.getStepsByRequestId(
        companyId,
        req.params.requestId
      );

      res.json({
        success: true,
        data: steps,
      });
    } catch (err) {
      next(err);
    }
  }

  static async approveStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const approverId = req.authContext?.userId;
      if (!companyId || !approverId) throw new ForbiddenError('Tenant and user context required');

      const parsed = ApproveStepSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const stepNumber = parseInt(req.params.stepNumber, 10);
      const result = await ApprovalStepService.approveStep(
        companyId,
        req.params.requestId,
        stepNumber,
        approverId,
        parsed.data.notes
      );

      res.json({
        success: true,
        message: result.isFullyApproved
          ? 'Final approval step completed'
          : `Step ${stepNumber} approved, next step is ${result.nextStepNumber}`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async rejectStep(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const approverId = req.authContext?.userId;
      if (!companyId || !approverId) throw new ForbiddenError('Tenant and user context required');

      const parsed = RejectStepSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const stepNumber = parseInt(req.params.stepNumber, 10);
      const step = await ApprovalStepService.rejectStep(
        companyId,
        req.params.requestId,
        stepNumber,
        approverId,
        parsed.data.rejectionReason
      );

      res.json({
        success: true,
        message: `Step ${stepNumber} rejected`,
        data: step,
      });
    } catch (err) {
      next(err);
    }
  }
}
