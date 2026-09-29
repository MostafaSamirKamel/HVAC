import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { RFQService } from './rfq.service.js';

const CreateRFQSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  title: z.string().min(1, 'Title is required'),
  purchaseRequestId: z.string().optional(),
  deadline: z.string().datetime().optional().transform((d) => (d ? new Date(d) : undefined)),
  notes: z.string().optional(),
  invitedSuppliers: z.array(z.string()).optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product ID is required'),
      productName: z.string().min(1, 'Product Name is required'),
      quantity: z.number().int().positive('Quantity must be greater than zero'),
      targetUnitCost: z.union([z.number(), z.string()]).optional(),
    })
  ).min(1, 'At least one item is required'),
});

const AddQuotationSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  quotationReference: z.string().optional(),
  currency: z.string().optional(),
  paymentTermsDays: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product ID is required'),
      unitCost: z.union([z.number(), z.string()]),
      leadTimeDays: z.number().int().nonnegative().optional(),
    })
  ).min(1, 'At least one quotation item is required'),
});

const AwardQuotationSchema = z.object({
  quotationId: z.string().min(1, 'Quotation ID is required'),
  warehouseId: z.string().min(1, 'Destination warehouse ID is required'),
});

export class RFQController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const createdBy = req.authContext?.userId;
      if (!companyId || !createdBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = CreateRFQSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const rfq = await RFQService.createRFQ({
        companyId,
        createdBy,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: rfq,
      });
    } catch (err) {
      next(err);
    }
  }

  static async addQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = AddQuotationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const rfq = await RFQService.addSupplierQuotation({
        companyId,
        rfqId: req.params.id,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        message: 'Supplier quotation recorded',
        data: rfq,
      });
    } catch (err) {
      next(err);
    }
  }

  static async award(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const awardedBy = req.authContext?.userId;
      if (!companyId || !awardedBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = AwardQuotationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const result = await RFQService.awardQuotation(
        companyId,
        req.params.id,
        parsed.data.quotationId,
        parsed.data.warehouseId,
        awardedBy
      );

      res.json({
        success: true,
        message: 'Quotation awarded and Purchase Order generated',
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

      const rfq = await RFQService.getRFQById(companyId, req.params.id);

      res.json({
        success: true,
        data: rfq,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const rfqs = await RFQService.listRFQs(companyId, {
        branchId: req.query.branchId as string | undefined,
        status: req.query.status as any,
      });

      res.json({
        success: true,
        data: rfqs,
      });
    } catch (err) {
      next(err);
    }
  }
}
