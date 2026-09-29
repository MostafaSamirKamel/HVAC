import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { PurchaseRequestService } from './purchase-request.service.js';

const CreatePurchaseRequestSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  department: z.string().min(1, 'Department is required'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  requiredDate: z.string().datetime().optional().transform((d) => (d ? new Date(d) : undefined)),
  notes: z.string().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED']).optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product ID is required'),
      productName: z.string().min(1, 'Product Name is required'),
      requestedQuantity: z.number().int().positive('Quantity must be greater than zero'),
      estimatedUnitCost: z.union([z.number(), z.string()]),
      purpose: z.string().optional(),
    })
  ).min(1, 'At least one item is required'),
});

const RejectPurchaseRequestSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

const ConvertToPOSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
});

export class PurchaseRequestController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const requestedBy = req.authContext?.userId;
      if (!companyId || !requestedBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = CreatePurchaseRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const request = await PurchaseRequestService.createRequest({
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

  static async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const request = await PurchaseRequestService.submitRequest(companyId, req.params.id);

      res.json({
        success: true,
        message: 'Purchase request submitted',
        data: request,
      });
    } catch (err) {
      next(err);
    }
  }

  static async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const approvedBy = req.authContext?.userId;
      if (!companyId || !approvedBy) throw new ForbiddenError('Tenant and user context required');

      const request = await PurchaseRequestService.approveRequest(
        companyId,
        req.params.id,
        approvedBy
      );

      res.json({
        success: true,
        message: 'Purchase request approved',
        data: request,
      });
    } catch (err) {
      next(err);
    }
  }

  static async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const rejectedBy = req.authContext?.userId;
      if (!companyId || !rejectedBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = RejectPurchaseRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const request = await PurchaseRequestService.rejectRequest(
        companyId,
        req.params.id,
        rejectedBy,
        parsed.data.reason
      );

      res.json({
        success: true,
        message: 'Purchase request rejected',
        data: request,
      });
    } catch (err) {
      next(err);
    }
  }

  static async convertToPO(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const createdBy = req.authContext?.userId;
      if (!companyId || !createdBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = ConvertToPOSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const result = await PurchaseRequestService.convertToPO(
        companyId,
        req.params.id,
        parsed.data.supplierId,
        parsed.data.warehouseId,
        createdBy
      );

      res.status(201).json({
        success: true,
        message: 'Purchase request converted to Purchase Order',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const request = await PurchaseRequestService.getRequestById(companyId, req.params.id);

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

      const requests = await PurchaseRequestService.listRequests(companyId, {
        branchId: req.query.branchId as string | undefined,
        status: req.query.status as any,
        department: req.query.department as string | undefined,
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
