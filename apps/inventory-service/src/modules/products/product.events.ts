import { BaseDomainEvent, BaseEventContext } from '@hvac/event-contracts';

export interface ProductCreatedPayload {
  productId: string;
  sku: string;
  name: string;
  costPrice: number;
  cashPrice: number;
  installmentPrice: number;
}

export class ProductCreatedEvent extends BaseDomainEvent<ProductCreatedPayload> {
  constructor(payload: ProductCreatedPayload, context: BaseEventContext) {
    super('inventory.product.created', 1, 'Product', payload.productId, payload, context);
  }
}
