import { ProductDocument } from './product.schema.js';
import { ProductDto } from './product.types.js';

export class ProductMapper {
  public static toDto(doc: ProductDocument): ProductDto {
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
}
