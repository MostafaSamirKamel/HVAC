import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { InstallmentRescheduleService } from './installment-reschedule.service.js';

const ExecuteEarlySettlementSchema = z.object({
  waiveInterestPercentage: z.number().min(0).max(100).optional(),
  receiptId: z.string().optional(),
  reason: z.string().min(1, 'Reason is required'),
});

const RescheduleTenorSchema = z.object({
  newAdditionalMonths: z.number().int().positive('Additional months must be positive'),
  newAnnualInterestRate: z.number().positive().optional(),
  reason: z.string().min(1, 'Reason is required'),
});

export class InstallmentRescheduleController {
  static async calculateSettlement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const waivePercentage = req.query.waiveInterestPercentage
        ? Number(req.query.waiveInterestPercentage)
        : 100;

      const calc = await InstallmentRescheduleService.calculateEarlySettlement(
        companyId,
        req.params.contractId,
        waivePercentage
      );

      res.json({
        success: true,
        data: calc,
      });
    } catch (err) {
      next(err);
    }
  }

  static async executeSettlement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const approvedBy = req.authContext?.userId;
      if (!companyId || !approvedBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = ExecuteEarlySettlementSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const result = await InstallmentRescheduleService.executeEarlySettlement({
        companyId,
        contractId: req.params.contractId,
        requestedBy: approvedBy,
        approvedBy,
        ...parsed.data,
      });

      res.json({
        success: true,
        message: 'Contract settled early and closed',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async rescheduleTenor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      const approvedBy = req.authContext?.userId;
      if (!companyId || !approvedBy) throw new ForbiddenError('Tenant and user context required');

      const parsed = RescheduleTenorSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const result = await InstallmentRescheduleService.rescheduleTenor({
        companyId,
        contractId: req.params.contractId,
        requestedBy: approvedBy,
        approvedBy,
        ...parsed.data,
      });

      res.json({
        success: true,
        message: 'Contract tenor rescheduled and new installments generated',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
