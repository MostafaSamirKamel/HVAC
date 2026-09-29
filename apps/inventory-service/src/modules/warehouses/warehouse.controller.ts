import { Request, Response, NextFunction } from 'express';
import { WarehouseService } from './warehouse.service.js';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';

const CreateWarehouseSchema = z.object({
  code: z.string().min(2, 'Warehouse code is required'),
  name: z.string().min(2, 'Warehouse name is required'),
  branchId: z.string().min(2, 'Branch ID is required'),
  address: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export class WarehouseController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateWarehouseSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      // Check branch access permissions
      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const warehouse = await WarehouseService.createWarehouse({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: warehouse,
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
      const warehouses = await WarehouseService.listWarehouses(companyId, branchId);

      res.status(200).json({
        success: true,
        data: warehouses,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const warehouse = await WarehouseService.getWarehouseById(companyId, req.params.warehouseId);
      res.status(200).json({
        success: true,
        data: warehouse,
      });
    } catch (err) {
      next(err);
    }
  }
}
