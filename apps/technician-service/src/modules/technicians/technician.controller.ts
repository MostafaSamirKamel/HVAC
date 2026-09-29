import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { TechnicianService } from './technician.service.js';

const CreateTechnicianSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(1, 'Phone is required'),
  branchId: z.string().min(1, 'Branch ID is required'),
  skills: z.array(z.string()).optional(),
  vanWarehouseId: z.string().optional(),
  userId: z.string().optional(),
});

const RecordCommissionSchema = z.object({
  workOrderId: z.string().min(1, 'Work Order ID is required'),
  amount: z.union([z.number(), z.string()]),
  reason: z.string().optional(),
});

const SubmitSettlementSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  treasuryId: z.string().optional(),
  cashCollected: z.union([z.number(), z.string()]),
  usedSpareParts: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })).optional(),
  returnedSpareParts: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })).optional(),
  notes: z.string().optional(),
});

export class TechnicianController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateTechnicianSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const tech = await TechnicianService.createTechnician({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: tech,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const tech = await TechnicianService.getTechnicianById(companyId, req.params.id);

      res.json({
        success: true,
        data: tech,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const techs = await TechnicianService.listTechnicians(companyId, {
        branchId: req.query.branchId as string | undefined,
        status: req.query.status as any,
      });

      res.json({
        success: true,
        data: techs,
      });
    } catch (err) {
      next(err);
    }
  }

  static async recordCommission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = RecordCommissionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const tech = await TechnicianService.recordCommission(
        companyId,
        req.params.id,
        parsed.data.workOrderId,
        parsed.data.amount,
        parsed.data.reason
      );

      res.json({
        success: true,
        message: 'Commission recorded',
        data: tech,
      });
    } catch (err) {
      next(err);
    }
  }

  static async submitSettlement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = SubmitSettlementSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const settlement = await TechnicianService.submitDailySettlement({
        companyId,
        technicianId: req.params.id,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        message: 'Daily settlement submitted',
        data: settlement,
      });
    } catch (err) {
      next(err);
    }
  }
}
