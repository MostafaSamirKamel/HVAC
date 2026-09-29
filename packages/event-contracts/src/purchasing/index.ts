import { BaseDomainEvent, BaseEventContext } from '../common/base-event.js';

export interface PurchaseOrderItemPayload {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface PurchaseOrderCreatedPayload {
  purchaseOrderId: string;
  orderNumber: string;
  supplierId: string;
  branchId: string;
  warehouseId: string;
  items: PurchaseOrderItemPayload[];
  totalAmount: number;
  currency: string;
}

export class PurchaseOrderCreatedEvent extends BaseDomainEvent<PurchaseOrderCreatedPayload> {
  constructor(payload: PurchaseOrderCreatedPayload, context: BaseEventContext) {
    super('purchasing.order.created', 1, 'PurchaseOrder', payload.purchaseOrderId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface GoodsReceiptItemPayload {
  productId: string;
  receivedQuantity: number;
  unitCost: number;
  serialNumbers?: string[];
}

export interface GoodsReceiptCreatedPayload {
  goodsReceiptId: string;
  receiptNumber: string;
  purchaseOrderId: string;
  supplierId: string;
  warehouseId: string;
  branchId: string;
  items: GoodsReceiptItemPayload[];
}

export class GoodsReceiptCreatedEvent extends BaseDomainEvent<GoodsReceiptCreatedPayload> {
  constructor(payload: GoodsReceiptCreatedPayload, context: BaseEventContext) {
    super('purchasing.grn.created', 1, 'GoodsReceipt', payload.goodsReceiptId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface VendorBillCreatedPayload {
  vendorBillId: string;
  billNumber: string;
  supplierId: string;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
  totalAmount: number;
  taxAmount: number;
  netAmount: number;
  currency: string;
  dueDate: string;
  branchId: string;
}

export class VendorBillCreatedEvent extends BaseDomainEvent<VendorBillCreatedPayload> {
  constructor(payload: VendorBillCreatedPayload, context: BaseEventContext) {
    super('purchasing.bill.created', 1, 'VendorBill', payload.vendorBillId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface PurchaseReturnItemPayload {
  productId: string;
  quantity: number;
  unitCost: number;
  serialNumbers?: string[];
}

export interface PurchaseReturnCreatedPayload {
  returnId: string;
  returnNumber: string;
  supplierId: string;
  warehouseId: string;
  branchId: string;
  items: PurchaseReturnItemPayload[];
  totalAmount: number;
  reason: string;
}

export class PurchaseReturnCreatedEvent extends BaseDomainEvent<PurchaseReturnCreatedPayload> {
  constructor(payload: PurchaseReturnCreatedPayload, context: BaseEventContext) {
    super('purchasing.return.created', 1, 'PurchaseReturn', payload.returnId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface PurchaseRequestItemPayload {
  productId: string;
  productName: string;
  requestedQuantity: number;
  estimatedUnitCost: number;
}

export interface PurchaseRequestCreatedPayload {
  requestId: string;
  requestNumber: string;
  branchId: string;
  department: string;
  requestedBy: string;
  priority: string;
  totalEstimatedAmount: number;
  currency: string;
  items: PurchaseRequestItemPayload[];
}

export class PurchaseRequestCreatedEvent extends BaseDomainEvent<PurchaseRequestCreatedPayload> {
  constructor(payload: PurchaseRequestCreatedPayload, context: BaseEventContext) {
    super('purchasing.request.created', 1, 'PurchaseRequest', payload.requestId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}

export interface PurchaseRequestApprovedPayload {
  requestId: string;
  requestNumber: string;
  branchId: string;
  approvedBy: string;
  approvedAt: string;
}

export class PurchaseRequestApprovedEvent extends BaseDomainEvent<PurchaseRequestApprovedPayload> {
  constructor(payload: PurchaseRequestApprovedPayload, context: BaseEventContext) {
    super('purchasing.request.approved', 1, 'PurchaseRequest', payload.requestId, payload, {
      ...context,
      branchId: payload.branchId,
    });
  }
}
