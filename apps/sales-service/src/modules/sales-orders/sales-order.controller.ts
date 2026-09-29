import { Request, Response, NextFunction } from 'express';
import { SalesOrderService } from './sales-order.service.js';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';

const CreateSalesOrderSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
  warehouseId: z.string().min(1, 'Warehouse ID is required'),
  saleType: z.enum(['CASH', 'INSTALLMENT', 'COMMERCIAL']).default('CASH'),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        productName: z.string().min(1, 'Product Name is required'),
        quantity: z.number().int().positive('Quantity must be a positive integer'),
        unitPrice: z.union([z.number(), z.string()]),
        discountAmount: z.union([z.number(), z.string()]).optional(),
        serialNumbers: z.array(z.string()).optional(),
      }),
    )
    .min(1, 'Order must contain at least one item'),
  notes: z.string().optional(),
});

export class SalesOrderController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateSalesOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const order = await SalesOrderService.createPendingOrder({
        companyId,
        ...parsed.data,
        salesRepresentativeId: req.authContext?.userId || 'unknown',
      });

      res.status(201).json({
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

      const branchId = req.query.branchId as string | undefined;
      const customerId = req.query.customerId as string | undefined;
      const status = req.query.status as string | undefined;

      const orders = await SalesOrderService.listOrders(companyId, { branchId, customerId, status });
      res.status(200).json({
        success: true,
        data: orders,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const order = await SalesOrderService.getOrderById(companyId, req.params.orderId);
      res.status(200).json({
        success: true,
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }
}
