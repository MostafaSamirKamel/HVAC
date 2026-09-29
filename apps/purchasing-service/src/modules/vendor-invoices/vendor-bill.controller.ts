import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { VendorBillService } from './vendor-bill.service.js';

const CreateVendorBillSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
  purchaseOrderId: z.string().optional(),
  goodsReceiptId: z.string().optional(),
  billNumber: z.string().optional(),
  billDate: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
  dueDate: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
  taxAmount: z.union([z.number(), z.string()]).default(0),
  discountAmount: z.union([z.number(), z.string()]).default(0),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        productName: z.string().min(1, 'Product name is required'),
        quantity: z.number().int().positive('Quantity must be positive'),
        unitCost: z.union([z.number(), z.string()]),
      })
    )
    .min(1, 'Vendor bill must contain at least one item'),
  currency: z.string().default('EGP'),
});

export class VendorBillController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateVendorBillSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const bill = await VendorBillService.createBill({
        companyId,
        ...parsed.data,
        createdBy: req.authContext?.userId || 'unknown',
      });

      res.status(201).json({
        success: true,
        data: bill,
      });
    } catch (err) {
      next(err);
    }
  }

  static async post(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const bill = await VendorBillService.postBill(companyId, req.params.id);

      res.json({
        success: true,
        message: 'Vendor bill posted',
        data: bill,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const bill = await VendorBillService.getBillById(companyId, req.params.id);

      res.json({
        success: true,
        data: bill,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const bills = await VendorBillService.listBills(companyId, {
        supplierId: req.query.supplierId as string | undefined,
        branchId: req.query.branchId as string | undefined,
        status: req.query.status as any,
      });

      res.json({
        success: true,
        data: bills,
      });
    } catch (err) {
      next(err);
    }
  }
}
