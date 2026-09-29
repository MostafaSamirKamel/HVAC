import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { ProductModel, ProductDocument } from './product.model.js';
import { CreateProductInput, ProductDto } from './product.types.js';
import { withTransaction, OutboxRepository } from '@hvac/database';
import { ProductCreatedEvent } from '@hvac/event-contracts';
import { ConflictError, NotFoundError } from '@hvac/errors';

export class ProductService {
  static toDto(doc: ProductDocument): ProductDto {
    return {
      productId: doc.productId,
      companyId: doc.companyId,
      sku: doc.sku,
      name: doc.name,
      brand: doc.brand,
      category: doc.category,
      modelNumber: doc.modelNumber,
      coolingCapacityBtu: doc.coolingCapacityBtu,
      horsepower: doc.horsepower,
      refrigerantType: doc.refrigerantType,
      basePrice: doc.basePrice.toString(),
      costPrice: doc.costPrice.toString(),
      isSerialized: doc.isSerialized,
      minStockLevel: doc.minStockLevel,
      isActive: doc.isActive,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  static async createProduct(input: CreateProductInput): Promise<ProductDto> {
    const cleanSku = input.sku.toUpperCase().trim();

    const existing = await ProductModel.findOne({
      companyId: input.companyId,
      sku: cleanSku,
    });
    if (existing) {
      throw new ConflictError(`Product with SKU '${cleanSku}' already exists in this company`);
    }

    const productId = `prod_${crypto.randomUUID().slice(0, 8)}`;

    return withTransaction(async (session) => {
      const [product] = await ProductModel.create(
        [
          {
            companyId: input.companyId,
            productId,
            sku: cleanSku,
            name: input.name.trim(),
            brand: input.brand.trim(),
            category: input.category.trim(),
            modelNumber: input.modelNumber?.trim(),
            coolingCapacityBtu: input.coolingCapacityBtu,
            horsepower: input.horsepower?.trim(),
            refrigerantType: input.refrigerantType?.trim(),
            basePrice: mongoose.Types.Decimal128.fromString(input.basePrice.toString()),
            costPrice: mongoose.Types.Decimal128.fromString(input.costPrice.toString()),
            isSerialized: input.isSerialized !== false,
            minStockLevel: input.minStockLevel || 0,
            isActive: true,
            schemaVersion: 1,
          },
        ],
        { session },
      );

      const event = new ProductCreatedEvent(
        {
          productId: product.productId,
          sku: product.sku,
          name: product.name,
          brand: product.brand,
          category: product.category,
          basePrice: product.basePrice.toString(),
          costPrice: product.costPrice.toString(),
          isSerialized: product.isSerialized,
        },
        {
          companyId: product.companyId,
        },
      );

      await OutboxRepository.recordEvent(event, session);

      return this.toDto(product);
    });
  }

  static async getProductById(companyId: string, productId: string): Promise<ProductDto> {
    const doc = await ProductModel.findOne({ companyId, productId }).exec();
    if (!doc) {
      throw new NotFoundError(`Product '${productId}' not found`);
    }
    return this.toDto(doc);
  }

  static async getProductBySku(companyId: string, sku: string): Promise<ProductDto> {
    const doc = await ProductModel.findOne({ companyId, sku: sku.toUpperCase().trim() }).exec();
    if (!doc) {
      throw new NotFoundError(`Product with SKU '${sku}' not found`);
    }
    return this.toDto(doc);
  }

  static async listProducts(
    companyId: string,
    filters: { brand?: string; category?: string; search?: string } = {},
  ): Promise<ProductDto[]> {
    const query: Record<string, unknown> = { companyId, isActive: true };

    if (filters.brand) query.brand = filters.brand;
    if (filters.category) query.category = filters.category;
    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { sku: { $regex: filters.search, $options: 'i' } },
        { modelNumber: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const docs = await ProductModel.find(query).sort({ name: 1 }).exec();
    return docs.map((d) => this.toDto(d));
  }
}
