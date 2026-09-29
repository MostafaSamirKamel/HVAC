import mongoose, { ClientSession } from 'mongoose';
import crypto from 'node:crypto';
import { SalesOrderModel, SalesOrderDocument, OrderStatus, SaleType } from './sales-order.model.js';
import { Money } from '@hvac/money';
import { withTransaction, OutboxRepository } from '@hvac/database';
import { SaleCreatedEvent } from '@hvac/event-contracts';
import { NotFoundError } from '@hvac/errors';

export interface CreateOrderLineItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number | string;
  discountAmount?: number | string;
  serialNumbers?: string[];
}

export interface CreateOrderInput {
  companyId: string;
  customerId: string;
  branchId: string;
  warehouseId: string;
  saleType: SaleType;
  items: CreateOrderLineItem[];
  salesRepresentativeId: string;
  notes?: string;
}

export class SalesOrderService {
  static async createPendingOrder(
    input: CreateOrderInput,
    externalSession?: ClientSession,
  ): Promise<SalesOrderDocument> {
    const orderId = `ord_${crypto.randomUUID().slice(0, 8)}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `SO-${new Date().getFullYear()}-${randomSuffix}`;

    // Exact Money arithmetic
    let totalMoney = Money.from(0, 'EGP');
    let discountMoney = Money.from(0, 'EGP');

    const mappedItems = input.items.map((item) => {
      const itemPrice = Money.from(item.unitPrice, 'EGP');
      const itemDiscount = Money.from(item.discountAmount || 0, 'EGP');
      const lineTotal = itemPrice.multiply(item.quantity).subtract(itemDiscount);

      totalMoney = totalMoney.add(itemPrice.multiply(item.quantity));
      discountMoney = discountMoney.add(itemDiscount);

      return {
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: mongoose.Types.Decimal128.fromString(itemPrice.toString()),
        discountAmount: mongoose.Types.Decimal128.fromString(itemDiscount.toString()),
        totalPrice: mongoose.Types.Decimal128.fromString(lineTotal.toString()),
        serialNumbers: item.serialNumbers || [],
      };
    });

    const netMoney = totalMoney.subtract(discountMoney);
    const taxMoney = Money.from(0, 'EGP'); // standard 0 or customizable

    const runner = async (session: ClientSession) => {
      const [order] = await SalesOrderModel.create(
        [
          {
            companyId: input.companyId,
            orderId,
            orderNumber,
            customerId: input.customerId,
            branchId: input.branchId,
            warehouseId: input.warehouseId,
            saleType: input.saleType,
            status: 'PENDING',
            items: mappedItems,
            totalAmount: mongoose.Types.Decimal128.fromString(totalMoney.toString()),
            discountAmount: mongoose.Types.Decimal128.fromString(discountMoney.toString()),
            taxAmount: mongoose.Types.Decimal128.fromString(taxMoney.toString()),
            netAmount: mongoose.Types.Decimal128.fromString(netMoney.toString()),
            salesRepresentativeId: input.salesRepresentativeId,
            notes: input.notes,
            schemaVersion: 1,
          },
        ],
        { session },
      );

      const event = new SaleCreatedEvent(
        {
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          branchId: order.branchId,
          saleType: order.saleType,
          totalAmount: netMoney.toNumber(),
          items: order.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice.toString()),
          })),
        },
        {
          companyId: order.companyId,
          branchId: order.branchId,
        },
      );

      await OutboxRepository.recordEvent(event, session);

      return order;
    };

    if (externalSession) {
      return runner(externalSession);
    }
    return withTransaction(runner);
  }

  static async getOrderById(companyId: string, orderId: string): Promise<SalesOrderDocument> {
    const doc = await SalesOrderModel.findOne({ companyId, orderId }).exec();
    if (!doc) {
      throw new NotFoundError(`Sales Order '${orderId}' not found`);
    }
    return doc;
  }

  static async updateOrderStatus(
    companyId: string,
    orderId: string,
    status: OrderStatus,
    extraFields: Record<string, unknown> = {},
    session?: ClientSession,
  ): Promise<SalesOrderDocument> {
    const updated = await SalesOrderModel.findOneAndUpdate(
      { companyId, orderId },
      {
        $set: {
          status,
          ...extraFields,
          updatedAt: new Date(),
        },
      },
      { new: true, session },
    ).exec();

    if (!updated) {
      throw new NotFoundError(`Sales Order '${orderId}' not found`);
    }
    return updated;
  }

  static async listOrders(
    companyId: string,
    filters: { branchId?: string; customerId?: string; status?: string } = {},
  ): Promise<SalesOrderDocument[]> {
    const query: Record<string, unknown> = { companyId };
    if (filters.branchId) query.branchId = filters.branchId;
    if (filters.customerId) query.customerId = filters.customerId;
    if (filters.status) query.status = filters.status;

    return SalesOrderModel.find(query).sort({ createdAt: -1 }).exec();
  }
}
