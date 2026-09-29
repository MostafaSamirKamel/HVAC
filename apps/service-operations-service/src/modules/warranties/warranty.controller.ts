import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { WarrantyService } from './warranty.service.js';

const RegisterWarrantySchema = z.object({
  serialNumber: z.string().min(1, 'Serial number is required'),
  productId: z.string().min(1, 'Product ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  workOrderId: z.string().optional(),
  branchId: z.string().min(1, 'Branch ID is required'),
  startDate: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
  machineWarrantyYears: z.number().int().positive().default(2),
  compressorWarrantyYears: z.number().int().positive().default(5),
  terms: z.string().optional(),
});

export class WarrantyController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = RegisterWarrantySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const warranty = await WarrantyService.registerWarranty({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: warranty,
      });
    } catch (err) {
      next(err);
    }
  }

  static async check(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const serialNumber = req.params.serialNumber;
      if (!serialNumber) throw new ValidationError('Serial number parameter required');

      const coverage = await WarrantyService.checkCoverage(companyId, serialNumber);

      res.json({
        success: true,
        data: coverage,
      });
    } catch (err) {
      next(err);
    }
  }
}
