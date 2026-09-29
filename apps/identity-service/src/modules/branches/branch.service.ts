import { BranchModel, BranchDocument } from './branch.model.js';
import { withTransaction, OutboxRepository } from '@hvac/database';
import { BranchCreatedEvent } from '@hvac/event-contracts';
import { ConflictError, NotFoundError } from '@hvac/errors';
import crypto from 'node:crypto';

export interface CreateBranchInput {
  companyId: string;
  name: string;
  code: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
  };
  isMainBranch?: boolean;
}

export class BranchService {
  static async createBranch(input: CreateBranchInput): Promise<BranchDocument> {
    const upperCode = input.code.toUpperCase().trim();
    const existing = await BranchModel.findOne({ companyId: input.companyId, code: upperCode });
    if (existing) {
      throw new ConflictError(`Branch with code '${upperCode}' already exists in company '${input.companyId}'`);
    }

    const branchId = `br_${crypto.randomUUID().slice(0, 8)}`;

    return withTransaction(async (session) => {
      // If this is set as main branch, demote previous main branch
      if (input.isMainBranch) {
        await BranchModel.updateMany(
          { companyId: input.companyId, isMainBranch: true },
          { $set: { isMainBranch: false } },
          { session },
        );
      }

      const [branch] = await BranchModel.create(
        [
          {
            companyId: input.companyId,
            branchId,
            name: input.name,
            code: upperCode,
            phone: input.phone,
            address: input.address,
            isMainBranch: !!input.isMainBranch,
            isActive: true,
            schemaVersion: 1,
          },
        ],
        { session },
      );

      const event = new BranchCreatedEvent(
        {
          branchId: branch.branchId,
          companyId: branch.companyId,
          name: branch.name,
          code: branch.code,
          isMainBranch: branch.isMainBranch,
        },
        {
          companyId: branch.companyId,
          branchId: branch.branchId,
        },
      );

      await OutboxRepository.recordEvent(event, session);

      return branch;
    });
  }

  static async listBranches(companyId: string): Promise<BranchDocument[]> {
    return BranchModel.find({ companyId, isActive: true }).sort({ code: 1 }).exec();
  }

  static async getBranchById(companyId: string, branchId: string): Promise<BranchDocument> {
    const branch = await BranchModel.findOne({ companyId, branchId }).exec();
    if (!branch) {
      throw new NotFoundError(`Branch '${branchId}' not found for company '${companyId}'`);
    }
    return branch;
  }
}
