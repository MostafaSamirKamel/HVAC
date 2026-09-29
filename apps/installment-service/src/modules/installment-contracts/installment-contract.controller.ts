import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError, ForbiddenError } from '@hvac/errors';
import { InstallmentContractService } from './installment-contract.service.js';

const CreateContractSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  orderId: z.string().optional(),
  branchId: z.string().min(1, 'Branch ID is required'),
  orderTotalAmount: z.union([z.number(), z.string()]),
  downPayment: z.union([z.number(), z.string()]).default(0),
  annualInterestRate: z.union([z.number(), z.string()]),
  tenorMonths: z.number().int().positive('Tenor must be positive integer'),
  startDate: z.string().datetime().optional().transform((v) => (v ? new Date(v) : undefined)),
  currency: z.string().default('EGP'),
});

const PayInstallmentSchema = z.object({
  installmentNumber: z.number().int().positive(),
  amount: z.union([z.number(), z.string()]),
  receiptId: z.string().optional(),
});

export class InstallmentContractController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = CreateContractSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      req.authContext?.requireBranchAccess(parsed.data.branchId);

      const result = await InstallmentContractService.createContract({
        companyId,
        ...parsed.data,
        createdBy: req.authContext?.userId || 'unknown',
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async pay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const parsed = PayInstallmentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const result = await InstallmentContractService.payInstallment({
        companyId,
        contractId: req.params.id,
        ...parsed.data,
        performedBy: req.authContext?.userId || 'unknown',
      });

      res.json({
        success: true,
        message: 'Installment payment recorded',
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

      const result = await InstallmentContractService.getContractById(companyId, req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const contracts = await InstallmentContractService.listContracts(companyId, {
        customerId: req.query.customerId as string | undefined,
        branchId: req.query.branchId as string | undefined,
        status: req.query.status as any,
      });

      res.json({
        success: true,
        data: contracts,
      });
    } catch (err) {
      next(err);
    }
  }

  static async processOverdue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companyId = req.authContext?.companyId;
      if (!companyId) throw new ForbiddenError('Tenant context required');

      const count = await InstallmentContractService.processOverdueInstallments(companyId);

      res.json({
        success: true,
        message: `Processed ${count} overdue installments`,
      });
    } catch (err) {
      next(err);
    }
  }
}
