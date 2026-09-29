import { BaseDomainEvent, BaseEventContext } from '../common/base-event.js';

export interface ProductCreatedPayload {
  productId: string;
  sku: string;
  name: string;
  brand: string;
  category: string;
  basePrice: string;
  costPrice: string;
  isSerialized: boolean;
}

export class ProductCreatedEvent extends BaseDomainEvent<ProductCreatedPayload> {
  constructor(payload: ProductCreatedPayload, context: BaseEventContext) {
    super('inventory.product.created', 1, 'Product', payload.productId, payload, context);
  }
}

export interface StockReservedPayload {
  reservationId: string;
  orderId: string;
  warehouseId: string;
  items: Array<{
    productId: string;
    quantity: number;
    serialNumbers?: string[];
  }>;
}

export class StockReservedEvent extends BaseDomainEvent<StockReservedPayload> {
  constructor(payload: StockReservedPayload, context: BaseEventContext) {
    super('inventory.stock.reserved', 1, 'StockReservation', payload.reservationId, payload, context);
  }
}

export interface StockDeductedPayload {
  deductionId: string;
  orderId: string;
  warehouseId: string;
  items: Array<{
    productId: string;
    quantity: number;
    serialNumbers?: string[];
  }>;
}

export class StockDeductedEvent extends BaseDomainEvent<StockDeductedPayload> {
  constructor(payload: StockDeductedPayload, context: BaseEventContext) {
    super('inventory.stock.deducted', 1, 'StockDeduction', payload.deductionId, payload, context);
  }
}

export interface StockReleasedPayload {
  reservationId: string;
  orderId: string;
  warehouseId: string;
  reason: string;
  items: Array<{
    productId: string;
    quantity: number;
    serialNumbers?: string[];
  }>;
}

export class StockReleasedEvent extends BaseDomainEvent<StockReleasedPayload> {
  constructor(payload: StockReleasedPayload, context: BaseEventContext) {
    super('inventory.stock.released', 1, 'StockReservation', payload.reservationId, payload, context);
  }
}

export interface StockMovedPayload {
  movementId: string;
  productId: string;
  fromLocationId?: string;
  toLocationId?: string;
  warehouseId: string;
  quantity: number;
  serialNumbers?: string[];
  movementType: 'INBOUND' | 'OUTBOUND' | 'TRANSFER' | 'ADJUSTMENT' | 'COMPENSATION_RETURN';
}

export class StockMovedEvent extends BaseDomainEvent<StockMovedPayload> {
  constructor(payload: StockMovedPayload, context: BaseEventContext) {
    super('inventory.stock.moved', 1, 'StockMovement', payload.movementId, payload, context);
  }
}

export interface TransferCompletedPayload {
  transferId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  items: Array<{
    productId: string;
    quantity: number;
    serialNumbers?: string[];
  }>;
}

export class TransferCompletedEvent extends BaseDomainEvent<TransferCompletedPayload> {
  constructor(payload: TransferCompletedPayload, context: BaseEventContext) {
    super('inventory.transfer.completed', 1, 'WarehouseTransfer', payload.transferId, payload, context);
  }
}
