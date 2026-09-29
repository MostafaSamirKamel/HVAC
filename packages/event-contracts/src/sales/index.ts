import { BaseDomainEvent, BaseEventContext } from '../common/base-event.js';

export interface SaleCreatedPayload {
  orderId: string;
  orderNumber: string;
  customerId: string;
  branchId: string;
  saleType: 'CASH' | 'INSTALLMENT' | 'COMMERCIAL';
  totalAmount: number;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
}

export class SaleCreatedEvent extends BaseDomainEvent<SaleCreatedPayload> {
  constructor(payload: SaleCreatedPayload, context: BaseEventContext) {
    super('sales.order.created', 1, 'SalesOrder', payload.orderId, payload, { ...context, branchId: payload.branchId });
  }
}

export interface SaleConfirmedPayload {
  orderId: string;
  orderNumber: string;
  customerId: string;
  branchId: string;
  confirmedBy: string;
}

export class SaleConfirmedEvent extends BaseDomainEvent<SaleConfirmedPayload> {
  constructor(payload: SaleConfirmedPayload, context: BaseEventContext) {
    super('sales.order.confirmed', 1, 'SalesOrder', payload.orderId, payload, context);
  }
}

export interface SaleCompletedPayload {
  orderId: string;
  orderNumber: string;
  customerId: string;
  deliveryId?: string;
  invoiceId?: string;
}

export class SaleCompletedEvent extends BaseDomainEvent<SaleCompletedPayload> {
  constructor(payload: SaleCompletedPayload, context: BaseEventContext) {
    super('sales.order.completed', 1, 'SalesOrder', payload.orderId, payload, context);
  }
}
