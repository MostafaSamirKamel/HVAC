import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { WorkOrderService } from './work-order.service.js';

const CreateWorkOrderSchema = z.object({
  ticketId: z.string().optional(),
  customerId: z.string().min(1, 'Customer ID is required'),
  addressId: z.string().min(1, 'Address ID is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
  technicianId: z.string().optional(),
  serviceType: z.enum(['INSTALLATION', 'MAINTENANCE', 'REPAIR', 'WARRANTY_INSPECTION']),
  scheduledDate: z.string().datetime().transform((v) => new Date(v)),
  estimatedDurationHours: z.number().positive().default(2),
  notes: z.string().optional(),
});

const CompleteWorkOrderSchema = z.object({
  technicianId: z.string().min(1, 'Technician ID is required'),
  installedSerialNumbers: z.array(z.string()).optional(),
  sparePartsUsed: z
    .array(
      z.object({
        productId: z.string(),
        productName: z.string(),
        quantity: z.number().int().positive(),
      })
    )
    .optional(),
  customerSignature: z.string().optional(),
  customerRating: z.number().min(1).max(5).optional(),
  customerFeedback: z.string().optional(),
  notes: z.string().optional(),
});

export class WorkOrderController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateWorkOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const order = await WorkOrderService.createAndSchedule({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }

  static async start(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const order = await WorkOrderService.startWorkOrder(companyId, req.params.id);

      res.json({
        success: true,
        message: 'Work order started',
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }

  static async complete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CompleteWorkOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const order = await WorkOrderService.completeWorkOrder({
        companyId,
        workOrderId: req.params.id,
        ...parsed.data,
      });

      res.json({
        success: true,
        message: 'Work order completed',
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

      const order = await WorkOrderService.getOrderById(companyId, req.params.id);

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

      const orders = await WorkOrderService.listOrders(companyId, {
        branchId: req.query.branchId as string | undefined,
        technicianId: req.query.technicianId as string | undefined,
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
