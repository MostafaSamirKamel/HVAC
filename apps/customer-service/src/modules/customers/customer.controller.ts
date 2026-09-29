import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { CustomerService } from './customer.service.js';

const CreateCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['INDIVIDUAL', 'COMMERCIAL']).default('INDIVIDUAL'),
  nationalId: z.string().optional(),
  taxNumber: z.string().optional(),
  commercialRegister: z.string().optional(),
  phone: z.string().min(1, 'Phone is required'),
  secondaryPhone: z.string().optional(),
  email: z.string().email().optional(),
  branchId: z.string().min(1, 'Branch ID is required'),
  creditLimit: z.union([z.number(), z.string()]).default(0),
  tags: z.array(z.string()).optional(),
  initialAddress: z
    .object({
      title: z.string().min(1, 'Title is required'),
      governorate: z.string().min(1, 'Governorate is required'),
      city: z.string().min(1, 'City is required'),
      street: z.string().min(1, 'Street is required'),
      buildingNumber: z.string().optional(),
      floor: z.string().optional(),
      apartment: z.string().optional(),
      landmark: z.string().optional(),
    })
    .optional(),
});

const UpdateCreditLimitSchema = z.object({
  newLimit: z.union([z.number(), z.string()]),
  reason: z.string().optional(),
});

const AddAddressSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  governorate: z.string().min(1, 'Governorate is required'),
  city: z.string().min(1, 'City is required'),
  street: z.string().min(1, 'Street is required'),
  buildingNumber: z.string().optional(),
  floor: z.string().optional(),
  apartment: z.string().optional(),
  landmark: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export class CustomerController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateCustomerSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const customer = await CustomerService.createCustomer({
        companyId,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: customer,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const customer = await CustomerService.getCustomerById(companyId, req.params.id);

      res.json({
        success: true,
        data: customer,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const customers = await CustomerService.listCustomers(companyId, {
        branchId: req.query.branchId as string | undefined,
        search: req.query.search as string | undefined,
      });

      res.json({
        success: true,
        data: customers,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateCreditLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = UpdateCreditLimitSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const customer = await CustomerService.updateCreditLimit(
        companyId,
        req.params.id,
        parsed.data.newLimit,
        parsed.data.reason
      );

      res.json({
        success: true,
        data: customer,
      });
    } catch (err) {
      next(err);
    }
  }

  static async checkCreditEligibility(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const amount = req.query.amount as string;
      if (!amount) throw new ValidationError('Amount parameter is required');

      const eligibility = await CustomerService.verifyCreditLimit(companyId, req.params.id, amount);

      res.json({
        success: true,
        data: eligibility,
      });
    } catch (err) {
      next(err);
    }
  }

  static async addAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = AddAddressSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const address = await CustomerService.addAddress({
        companyId,
        customerId: req.params.id,
        ...parsed.data,
      });

      res.status(201).json({
        success: true,
        data: address,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAddresses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const addresses = await CustomerService.getAddressesByCustomer(companyId, req.params.id);

      res.json({
        success: true,
        data: addresses,
      });
    } catch (err) {
      next(err);
    }
  }
}
