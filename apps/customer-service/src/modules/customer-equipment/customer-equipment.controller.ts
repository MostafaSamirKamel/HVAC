import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { CustomerEquipmentService } from './customer-equipment.service.js';

const RegisterEquipmentSchema = z.object({
  branchId: z.string().min(1, 'Branch ID is required'),
  customerId: z.string().min(1, 'Customer ID is required'),
  addressId: z.string().min(1, 'Address ID is required'),
  serialNumber: z.string().min(1, 'Serial number is required'),
  brand: z.string().min(1, 'Brand is required'),
  modelNumber: z.string().optional(),
  equipmentType: z
    .enum(['SPLIT', 'CONCEALED', 'VRF', 'PACKAGE', 'CHILLER', 'OTHER'])
    .optional(),
  capacityHP: z.number().positive().optional(),
  capacityTonnage: z.number().positive().optional(),
  installationDate: z.string().datetime().transform((d) => new Date(d)),
  warrantyYears: z.number().int().positive().optional(),
  warrantyEndDate: z
    .string()
    .datetime()
    .optional()
    .transform((d) => (d ? new Date(d) : undefined)),
  serviceContractId: z.string().optional(),
  notes: z.string().optional(),
});

const AddServiceRecordSchema = z.object({
  serviceDate: z
    .string()
    .datetime()
    .optional()
    .transform((d) => (d ? new Date(d) : undefined)),
  workOrderId: z.string().optional(),
  technicianId: z.string().optional(),
  serviceType: z.string().min(1, 'Service type is required'),
  description: z.string().min(1, 'Description is required'),
});

export class CustomerEquipmentController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = RegisterEquipmentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const equipment = await CustomerEquipmentService.registerEquipment({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        message: 'Customer equipment registered successfully',
        data: equipment,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getByCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const equipment = await CustomerEquipmentService.getEquipmentByCustomer(
        companyId,
        req.params.customerId
      );

      res.json({
        success: true,
        data: equipment,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getBySerial(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const equipment = await CustomerEquipmentService.getEquipmentBySerial(
        companyId,
        req.params.serialNumber
      );

      res.json({
        success: true,
        data: equipment,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const equipment = await CustomerEquipmentService.getEquipmentById(
        companyId,
        req.params.id
      );

      res.json({
        success: true,
        data: equipment,
      });
    } catch (err) {
      next(err);
    }
  }

  static async addServiceRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = AddServiceRecordSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const updated = await CustomerEquipmentService.addServiceRecord({
        companyId,
        equipmentId: req.params.id,
        ...parsed.data,
      });

      res.json({
        success: true,
        message: 'Service record added',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async verifyWarranty(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const result = await CustomerEquipmentService.verifyWarranty(
        companyId,
        req.params.id
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
