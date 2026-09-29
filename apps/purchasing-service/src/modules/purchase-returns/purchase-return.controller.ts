import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { PurchaseReturnService } from './purchase-return.service.js';

const CreatePurchaseReturnSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  supplierId: z.string().min(1, 'Supplier ID is required'),
  purchaseOrderId: z.string().optional(),
  vendorBillId: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product ID is required'),
      productName: z.string().min(1, 'Product Name is required'),
      quantity: z.number().int().positive('Quantity must be greater than zero'),
      unitCost: z.union([z.number(), z.string()]),
      serialNumbers: z.array(z.string()).optional(),
      reason: z.string().min(1, 'Reason is required'),
    })
  ).min(1, 'At least one item is required'),
});

export class PurchaseReturnController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const returnedBy = req.authContext?.userId;
      if (!companyId || !returnedBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = CreatePurchaseReturnSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const pReturn = await PurchaseReturnService.createReturn({
        companyId,
        returnedBy,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: pReturn,
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

      const pReturn = await PurchaseReturnService.approveReturn(
        companyId,
        req.params.id,
        approvedBy
      );

      res.json({
        success: true,
        message: 'Purchase return approved and event emitted',
        data: pReturn,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const pReturn = await PurchaseReturnService.getReturnById(companyId, req.params.id);

      res.json({
        success: true,
        data: pReturn,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const returns = await PurchaseReturnService.listReturns(companyId, {
        supplierId: req.query.supplierId as string | undefined,
        status: req.query.status as any,
        branchId: req.query.branchId as string | undefined,
      });

      res.json({
        success: true,
        data: returns,
      });
    } catch (err) {
      next(err);
    }
  }
}
