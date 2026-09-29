import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { PurchaseOrderService } from './purchase-order.service.js';

const CreatePOSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        productName: z.string().min(1, 'Product name is required'),
        quantity: z.number().int().positive('Quantity must be positive'),
        unitCost: z.union([z.number(), z.string()]),
      })
    )
    .min(1, 'PO must contain at least one item'),
  currency: z.string().default('EGP'),
  expectedDeliveryDate: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
  notes: z.string().optional(),
});

export class PurchaseOrderController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreatePOSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const order = await PurchaseOrderService.createOrder({
        companyId,
        ...parsed.data,
        createdBy: req.authContext?.userId || 'unknown',
      });

      res.status(201).json({
        success: true,
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }

  static async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const order = await PurchaseOrderService.approveOrder(
        companyId,
        req.params.id,
        req.authContext?.userId || 'unknown'
      );

      res.json({
        success: true,
        message: 'Purchase order approved',
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const order = await PurchaseOrderService.getOrderById(companyId, req.params.id);

      res.json({
        success: true,
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const orders = await PurchaseOrderService.listOrders(companyId, {
        branchId: req.query.branchId as string | undefined,
        supplierId: req.query.supplierId as string | undefined,
        status: req.query.status as any,
      });

      res.json({
        success: true,
        data: orders,
      });
    } catch (err) {
      next(err);
    }
  }
}
