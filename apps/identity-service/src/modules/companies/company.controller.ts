import { Request, Response, NextFunction } from 'express';
import { CompanyService } from './company.service.js';
import { z } from 'zod';
import { ValidationError } from '@hvac/errors';

const CreateCompanySchema = z.object({
  companyId: z.string().min(2, 'companyId must be at least 2 characters'),
  name: z.string().min(2, 'Company name is required'),
  commercialRegistrationNumber: z.string().optional(),
  taxNumber: z.string().optional(),
  currency: z.string().default('EGP'),
  adminUser: z
    .object({
      username: z.string().min(3, 'Username must be at least 3 characters'),
      email: z.string().email('Valid email required'),
      password: z.string().min(6, 'Password must be at least 6 characters'),
      fullName: z.string().min(2, 'Full name required'),
      phone: z.string().optional(),
    })
    .optional(),
});

export class CompanyController {
  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = CreateCompanySchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('Validation failed', parsed.error.format() as any);
      }

      const company = await CompanyService.createCompany(parsed.data);
      res.status(201).json({
        success: true,
        data: company,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const companies = await CompanyService.listCompanies();
      res.status(200).json({
        success: true,
        data: companies,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const company = await CompanyService.getCompanyById(req.params.companyId);
      res.status(200).json({
        success: true,
        data: company,
      });
    } catch (err) {
      next(err);
    }
  }
}
