import { PaginationParams, BranchScopedRequest } from '../common/index.js';

export interface CreateProductRequest {
  name: string;
  sku: string;
  brandId: string;
  categoryId: string;
  modelNumber?: string;
  coolingCapacityBtu?: number;
  costPrice: number;
  cashPrice: number;
  installmentPrice: number;
  isSerialized: boolean;
}

export interface CreateOrderRequest extends BranchScopedRequest {
  customerId: string;
  saleType: 'CASH' | 'INSTALLMENT' | 'COMMERCIAL';
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  downPayment?: number;
  numberOfInstallments?: number;
}
