import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { SupplierService } from './supplier.service.js';

const CreateSupplierSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().min(1, 'Name is required'),
  taxNumber: z.string().optional(),
  commercialRegister: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email().optional(),
  address: z.string().optional(),
  paymentTermsDays: z.number().int().default(30),
  currency: z.string().default('EGP'),
  creditLimit: z.union([z.number(), z.string()]).default(0),
});

export class SupplierController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateSupplierSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const supplier = await SupplierService.createSupplier({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: supplier,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const suppliers = await SupplierService.listSuppliers(companyId);

      res.json({
        success: true,
        data: suppliers,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const supplier = await SupplierService.getSupplierById(companyId, req.params.id);

      res.json({
        success: true,
        data: supplier,
      });
    } catch (err) {
      next(err);
    }
  }
}
