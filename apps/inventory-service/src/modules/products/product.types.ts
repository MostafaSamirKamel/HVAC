export interface ProductDto {
  productId: string;
  companyId: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  modelNumber?: string;
  coolingCapacityBtu?: number;
  horsepower?: string;
  refrigerantType?: string;
  basePrice: string;
  costPrice: string;
  isSerialized: boolean;
  minStockLevel: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  companyId: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  modelNumber?: string;
  coolingCapacityBtu?: number;
  horsepower?: string;
  refrigerantType?: string;
  basePrice: number | string;
  costPrice: number | string;
  isSerialized?: boolean;
  minStockLevel?: number;
}
