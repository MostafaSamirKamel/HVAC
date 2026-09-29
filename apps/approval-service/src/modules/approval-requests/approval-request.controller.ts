import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { ApprovalRequestService } from './approval-request.service.js';

const CreateApprovalRequestSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  requestType: z.string().min(1, 'Request type is required'),
  referenceType: z.string().min(1, 'Reference type is required'),
  referenceId: z.string().min(1, 'Reference ID is required'),
  amount: z.union([z.number(), z.string()]).optional(),
  metadata: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

const RejectApprovalRequestSchema = z.object({
  rejectionReason: z.string().min(1, 'Rejection reason is required'),
});

const CancelApprovalRequestSchema = z.object({
  cancellationReason: z.string().optional(),
});

export class ApprovalRequestController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const requestedBy = req.authContext?.userId;
      if (!companyId || !requestedBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = CreateApprovalRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const request = await ApprovalRequestService.createRequest({
        companyId,
        requestedBy,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: request,
      });
    } catch (err) {
      next(err);
    }
  }

  static async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const approverId = req.authContext?.userId;
      if (!companyId || !approverId) throw new ForbiddenError('Tenant and user context required');

      const request = await ApprovalRequestService.approveRequest(
        companyId,
        req.params.id,
        approverId,
        req.body?.notes
      );

      res.json({
        success: true,
        message: 'Approval request approved',
        data: request,
      });
    } catch (err) {
      next(err);
    }
  }

  static async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const approverId = req.authContext?.userId;
      if (!companyId || !approverId) throw new ForbiddenError('Tenant and user context required');

      const parsed = RejectApprovalRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const request = await ApprovalRequestService.rejectRequest(
        companyId,
        req.params.id,
        approverId,
        parsed.data.rejectionReason
      );

      res.json({
        success: true,
        message: 'Approval request rejected',
        data: request,
      });
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const requestedBy = req.authContext?.userId;
      if (!companyId || !requestedBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = CancelApprovalRequestSchema.safeParse(req.body);
      const cancellationReason = parsed.success ? parsed.data.cancellationReason : undefined;

      const request = await ApprovalRequestService.cancelRequest(
        companyId,
        req.params.id,
        requestedBy,
        cancellationReason
      );

      res.json({
        success: true,
        message: 'Approval request cancelled',
        data: request,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const request = await ApprovalRequestService.getRequestById(companyId, req.params.id);

      res.json({
        success: true,
        data: request,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const requests = await ApprovalRequestService.listRequests(companyId, {
        branchId: req.query.branchId as string | undefined,
        status: req.query.status as any,
        requestType: req.query.requestType as string | undefined,
        referenceType: req.query.referenceType as string | undefined,
        requestedBy: req.query.requestedBy as string | undefined,
      });

      res.json({
        success: true,
        data: requests,
      });
    } catch (err) {
      next(err);
    }
  }
}
