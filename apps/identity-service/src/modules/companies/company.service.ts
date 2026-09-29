import { CompanyModel, CompanyDocument } from './company.model.js';
import { withTransaction, OutboxRepository } from '@hvac/database';
import { CompanyCreatedEvent } from '@hvac/event-contracts';
import { ConflictError, NotFoundError } from '@hvac/errors';
import { RoleService } from '../roles/role.service.js';

export interface CreateCompanyInput {
  companyId: string;
  name: string;
  commercialRegistrationNumber?: string;
  taxNumber?: string;
  currency?: string;
}

export class CompanyService {
  static async createCompany(input: CreateCompanyInput): Promise<CompanyDocument> {
    const existing = await CompanyModel.findOne({ companyId: input.companyId });
    if (existing) {
      throw new ConflictError(`Company with ID '${input.companyId}' already exists`);
    }

    return withTransaction(async (session) => {
      const [company] = await CompanyModel.create(
        [
          {
            companyId: input.companyId,
            name: input.name,
            commercialRegistrationNumber: input.commercialRegistrationNumber,
            taxNumber: input.taxNumber,
            currency: input.currency || 'EGP',
            isActive: true,
            schemaVersion: 1,
          },
        ],
        { session },
      );

      // Seed default system roles for this new company
      await RoleService.seedDefaultRoles(input.companyId, session);

      // Record outbox event atomically
      const event = new CompanyCreatedEvent(
        {
          companyId: company.companyId,
          name: company.name,
          taxNumber: company.taxNumber,
          currency: company.currency,
        },
        {
          companyId: company.companyId,
        },
      );

      await OutboxRepository.recordEvent(event, session);

      return company;
    });
  }

  static async getCompanyById(companyId: string): Promise<CompanyDocument> {
    const company = await CompanyModel.findOne({ companyId }).exec();
    if (!company) {
      throw new NotFoundError(`Company '${companyId}' not found`);
    }
    return company;
  }

  static async listCompanies(): Promise<CompanyDocument[]> {
    return CompanyModel.find({ isActive: true }).sort({ name: 1 }).exec();
  }
}
