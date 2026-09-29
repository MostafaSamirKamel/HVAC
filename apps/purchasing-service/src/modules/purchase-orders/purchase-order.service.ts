import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { NotFoundError, ValidationError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { OutboxRepository, withTransaction } from '@hvac/database';
import { PurchaseOrderCreatedEvent } from '@hvac/event-contracts';
import {
  PurchaseOrderModel,
  IPurchaseOrder,
  IPurchaseOrderItem,
  PurchaseOrderStatus,
} from './purchase-order.model.js';
import { SupplierService } from '../suppliers/supplier.service.js';

export interface CreatePOItemInput {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number | string;
}

export interface CreatePOInput {
  companyId: string;
  supplierId: string;
  branchId: string;
  warehouseId: string;
  items: CreatePOItemInput[];
  currency?: string;
  expectedDeliveryDate?: Date;
  notes?: string;
  createdBy: string;
}

export class PurchaseOrderService {
  public static async createOrder(
    input: CreatePOInput,
    existingSession?: ClientSession
  ): Promise<IPurchaseOrder> {
    if (!input.items || input.items.length === 0) {
      throw new ValidationError('Purchase order must contain at least one item');
    }

    const currency = input.currency || 'EGP';
    let totalOrderMoney = Money.from(0, currency);

    const mappedItems: IPurchaseOrderItem[] = [];

    for (const item of input.items) {
      if (item.quantity <= 0) {
        throw new ValidationError('Item quantity must be greater than zero');
      }

      const costMoney = Money.from(item.unitCost, currency);
      const lineCost = costMoney.multiply(item.quantity);
      totalOrderMoney = totalOrderMoney.add(lineCost);

      mappedItems.push({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        receivedQuantity: 0,
        unitCost: mongoose.Types.Decimal128.fromString(costMoney.toFixed(2)),
        totalCost: mongoose.Types.Decimal128.fromString(lineCost.toFixed(2)),
      });
    }

    const runner = async (session: ClientSession) => {
      // Verify supplier
      await SupplierService.getSupplierById(input.companyId, input.supplierId);

      const purchaseOrderId = randomUUID();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const orderNumber = `PO-${new Date().getFullYear()}-${randomSuffix}`;

      const [order] = await PurchaseOrderModel.create(
        [
          {
            companyId: input.companyId,
            purchaseOrderId,
            orderNumber,
            supplierId: input.supplierId,
            branchId: input.branchId,
            warehouseId: input.warehouseId,
            status: 'DRAFT',
            items: mappedItems,
            totalAmount: mongoose.Types.Decimal128.fromString(totalOrderMoney.toFixed(2)),
            currency,
            expectedDeliveryDate: input.expectedDeliveryDate,
            notes: input.notes,
            createdBy: input.createdBy,
          },
        ],
        { session }
      );

      // Publish Outbox Event inside transaction
      const event = new PurchaseOrderCreatedEvent(
        {
          purchaseOrderId,
          orderNumber,
          supplierId: input.supplierId,
          branchId: input.branchId,
          warehouseId: input.warehouseId,
          items: input.items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            unitCost: Number(i.unitCost),
            totalCost: Number(Money.from(i.unitCost, currency).multiply(i.quantity).toFixed(2)),
          })),
          totalAmount: totalOrderMoney.toNumber(),
          currency,
        },
        {
          companyId: input.companyId,
          branchId: input.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
          actor: { userId: input.createdBy },
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return order;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async approveOrder(
    companyId: string,
    purchaseOrderId: string,
    approvedBy: string,
    existingSession?: ClientSession
  ): Promise<IPurchaseOrder> {
    const runner = async (session: ClientSession) => {
      const order = await PurchaseOrderModel.findOne({ companyId, purchaseOrderId }).session(session);
      if (!order) {
        throw new NotFoundError(`Purchase order ${purchaseOrderId} not found`);
      }

      if (order.status !== 'DRAFT' && order.status !== 'SUBMITTED') {
        throw new ValidationError(`Order is in status ${order.status}, cannot approve`);
      }

      order.status = 'APPROVED';
      order.approvedBy = approvedBy;
      order.approvedAt = new Date();
      await order.save({ session });

      return order;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async getOrderById(
    companyId: string,
    purchaseOrderId: string
  ): Promise<IPurchaseOrder> {
    const order = await PurchaseOrderModel.findOne({ companyId, purchaseOrderId });
    if (!order) {
      throw new NotFoundError(`Purchase order ${purchaseOrderId} not found`);
    }
    return order;
  }

  public static async listOrders(
    companyId: string,
    filter: { branchId?: string; supplierId?: string; status?: PurchaseOrderStatus }
  ): Promise<IPurchaseOrder[]> {
    const query: Record<string, unknown> = { companyId };
    if (filter.branchId) query.branchId = filter.branchId;
    if (filter.supplierId) query.supplierId = filter.supplierId;
    if (filter.status) query.status = filter.status;

    return PurchaseOrderModel.find(query).sort({ createdAt: -1 });
  }
}
