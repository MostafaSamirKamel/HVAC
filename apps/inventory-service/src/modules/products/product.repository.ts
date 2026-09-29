import { ProductModel } from './product.model.js';
import { CreateProductInput, ProductDto } from './product.types.js';
import { ProductMapper } from './product.mapper.js';
import { NotFoundError } from '@hvac/errors';

export class ProductRepository {
  public async findById(companyId: string, productId: string): Promise<ProductDto | null> {
    const doc = await ProductModel.findOne({ companyId, productId }).exec();
    return doc ? ProductMapper.toDto(doc) : null;
  }

  public async findBySku(companyId: string, sku: string): Promise<ProductDto | null> {
    const doc = await ProductModel.findOne({ companyId, sku: sku.toUpperCase() }).exec();
    return doc ? ProductMapper.toDto(doc) : null;
  }

  public async create(input: CreateProductInput): Promise<ProductDto> {
    const doc = await ProductModel.create(input);
    return ProductMapper.toDto(doc);
  }

  public async list(companyId: string, limit: number = 50, skip: number = 0): Promise<ProductDto[]> {
    const docs = await ProductModel.find({ companyId }).skip(skip).limit(limit).exec();
    return docs.map(ProductMapper.toDto);
  }

  public async getOrThrow(companyId: string, productId: string): Promise<ProductDto> {
    const prod = await this.findById(companyId, productId);
    if (!prod) {
      throw new NotFoundError(`Product '${productId}' not found in company '${companyId}'`);
    }
    return prod;
  }
}
