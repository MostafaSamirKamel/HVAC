import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { ServiceTicketService } from './service-ticket.service.js';

const CreateTicketSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  customerAddressId: z.string().min(1, 'Customer address ID is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
  category: z.enum(['INSTALLATION', 'BREAKDOWN', 'PERIODIC_MAINTENANCE', 'COMPLAINT']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY']).optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
});

const AssignWorkOrderSchema = z.object({
  workOrderId: z.string().min(1, 'Work Order ID is required'),
});

export class ServiceTicketController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const reportedBy = req.authContext?.userId;
      if (!companyId || !reportedBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = CreateTicketSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const ticket = await ServiceTicketService.createTicket({
        companyId,
        reportedBy,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        message: 'Service ticket registered',
        data: ticket,
      });
    } catch (err) {
      next(err);
    }
  }

  static async assignToWorkOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = AssignWorkOrderSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const ticket = await ServiceTicketService.assignToWorkOrder(
        companyId,
        req.params.id,
        parsed.data.workOrderId
      );

      res.json({
        success: true,
        message: 'Service ticket assigned to work order',
        data: ticket,
      });
    } catch (err) {
      next(err);
    }
  }

  static async resolve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const ticket = await ServiceTicketService.resolveTicket(companyId, req.params.id);

      res.json({
        success: true,
        message: 'Service ticket resolved',
        data: ticket,
      });
    } catch (err) {
      next(err);
    }
  }

  static async close(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const ticket = await ServiceTicketService.closeTicket(companyId, req.params.id);

      res.json({
        success: true,
        message: 'Service ticket closed',
        data: ticket,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const ticket = await ServiceTicketService.getTicketById(companyId, req.params.id);

      res.json({
        success: true,
        data: ticket,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const tickets = await ServiceTicketService.listTickets(companyId, {
        customerId: req.query.customerId as string | undefined,
        branchId: req.query.branchId as string | undefined,
        status: req.query.status as any,
        category: req.query.category as any,
      });

      res.json({
        success: true,
        data: tickets,
      });
    } catch (err) {
      next(err);
    }
  }
}
