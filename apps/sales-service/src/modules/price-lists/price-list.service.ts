import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { PriceListModel, PriceListDocument } from './price-list.model.js';
import { ConflictError, NotFoundError } from '@hvac/errors';

export interface CreatePriceListInput {
  companyId: string;
  name: string;
  currency?: string;
  items: Array<{ productId: string; price: number | string; minQuantity?: number }>;
  isDefault?: boolean;
}

export class PriceListService {
  static async createPriceList(input: CreatePriceListInput): Promise<PriceListDocument> {
    const existing = await PriceListModel.findOne({
      companyId: input.companyId,
      name: input.name.trim(),
    });
    if (existing) {
      throw new ConflictError(`Price list '${input.name}' already exists in this company`);
    }

    const priceListId = `pl_${crypto.randomUUID().slice(0, 8)}`;

    if (input.isDefault) {
      await PriceListModel.updateMany(
        { companyId: input.companyId, isDefault: true },
        { $set: { isDefault: false } },
      );
    }

    return PriceListModel.create({
      companyId: input.companyId,
      priceListId,
      name: input.name.trim(),
      currency: input.currency || 'EGP',
      items: input.items.map((i) => ({
        productId: i.productId,
        price: mongoose.Types.Decimal128.fromString(i.price.toString()),
        minQuantity: i.minQuantity || 1,
      })),
      isDefault: !!input.isDefault,
      isActive: true,
      schemaVersion: 1,
    });
  }

  static async getPriceListById(companyId: string, priceListId: string): Promise<PriceListDocument> {
    const doc = await PriceListModel.findOne({ companyId, priceListId }).exec();
    if (!doc) {
      throw new NotFoundError(`Price list '${priceListId}' not found`);
    }
    return doc;
  }

  static async listPriceLists(companyId: string): Promise<PriceListDocument[]> {
    return PriceListModel.find({ companyId, isActive: true }).sort({ name: 1 }).exec();
  }
}
