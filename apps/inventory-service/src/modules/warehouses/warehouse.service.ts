import crypto from 'node:crypto';
import { WarehouseModel, WarehouseDocument } from './warehouse.model.js';
import { ConflictError, NotFoundError } from '@hvac/errors';

export interface CreateWarehouseInput {
  companyId: string;
  code: string;
  name: string;
  branchId: string;
  address?: string;
  isDefault?: boolean;
}

export class WarehouseService {
  static async createWarehouse(input: CreateWarehouseInput): Promise<WarehouseDocument> {
    const cleanCode = input.code.toUpperCase().trim();

    const existing = await WarehouseModel.findOne({
      companyId: input.companyId,
      code: cleanCode,
    });
    if (existing) {
      throw new ConflictError(`Warehouse with code '${cleanCode}' already exists in this company`);
    }

    const warehouseId = `wh_${crypto.randomUUID().slice(0, 8)}`;

    if (input.isDefault) {
      await WarehouseModel.updateMany(
        { companyId: input.companyId, isDefault: true },
        { $set: { isDefault: false } },
      );
    }

    return WarehouseModel.create({
      companyId: input.companyId,
      warehouseId,
      code: cleanCode,
      name: input.name.trim(),
      branchId: input.branchId,
      address: input.address?.trim(),
      isDefault: !!input.isDefault,
      isActive: true,
      schemaVersion: 1,
    });
  }

  static async getWarehouseById(companyId: string, warehouseId: string): Promise<WarehouseDocument> {
    const doc = await WarehouseModel.findOne({ companyId, warehouseId }).exec();
    if (!doc) {
      throw new NotFoundError(`Warehouse '${warehouseId}' not found`);
    }
    return doc;
  }

  static async listWarehouses(companyId: string, branchId?: string): Promise<WarehouseDocument[]> {
    const query: Record<string, unknown> = { companyId, isActive: true };
    if (branchId) {
      query.branchId = branchId;
    }
    return WarehouseModel.find(query).sort({ code: 1 }).exec();
  }
}
