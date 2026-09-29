import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { NotFoundError, ValidationError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { OutboxRepository, withTransaction } from '@hvac/database';
import { GoodsReceiptCreatedEvent } from '@hvac/event-contracts';
import { GoodsReceiptModel, IGoodsReceipt, IGoodsReceiptItem } from './goods-receipt.model.js';
import { PurchaseOrderModel } from '../purchase-orders/purchase-order.model.js';

export interface ReceiveItemInput {
  productId: string;
  receivedQuantity: number;
  unitCost: number | string;
  serialNumbers?: string[];
}

export interface CreateGoodsReceiptInput {
  companyId: string;
  purchaseOrderId: string;
  warehouseId?: string;
  items: ReceiveItemInput[];
  notes?: string;
  receivedBy: string;
}

export class GoodsReceiptService {
  public static async receiveGoods(
    input: CreateGoodsReceiptInput,
    existingSession?: ClientSession
  ): Promise<IGoodsReceipt> {
    if (!input.items || input.items.length === 0) {
      throw new ValidationError('Goods receipt must contain at least one item');
    }

    const runner = async (session: ClientSession) => {
      const order = await PurchaseOrderModel.findOne({
        companyId: input.companyId,
        purchaseOrderId: input.purchaseOrderId,
      }).session(session);

      if (!order) {
        throw new NotFoundError(`Purchase order ${input.purchaseOrderId} not found`);
      }

      if (order.status !== 'APPROVED' && order.status !== 'PARTIALLY_RECEIVED') {
        throw new ValidationError(`Purchase order is in status ${order.status}, must be APPROVED to receive`);
      }

      const warehouseId = input.warehouseId || order.warehouseId;
      const mappedItems: IGoodsReceiptItem[] = [];

      for (const receiveItem of input.items) {
        const poItem = order.items.find((i) => i.productId === receiveItem.productId);
        if (!poItem) {
          throw new ValidationError(`Product ${receiveItem.productId} is not on Purchase Order ${order.orderNumber}`);
        }

        const remainingToReceive = poItem.quantity - poItem.receivedQuantity;
        if (receiveItem.receivedQuantity > remainingToReceive) {
          throw new ValidationError(
            `Cannot receive ${receiveItem.receivedQuantity} for product ${poItem.productName}. Maximum remaining: ${remainingToReceive}`
          );
        }

        if (receiveItem.serialNumbers && receiveItem.serialNumbers.length !== receiveItem.receivedQuantity) {
          throw new ValidationError(
            `Serial numbers count (${receiveItem.serialNumbers.length}) must match received quantity (${receiveItem.receivedQuantity}) for product ${poItem.productName}`
          );
        }

        poItem.receivedQuantity += receiveItem.receivedQuantity;

        mappedItems.push({
          productId: receiveItem.productId,
          receivedQuantity: receiveItem.receivedQuantity,
          unitCost: mongoose.Types.Decimal128.fromString(Money.from(receiveItem.unitCost).toFixed(2)),
          serialNumbers: receiveItem.serialNumbers || [],
        });
      }

      // Check if PO is fully received or partially received
      const allFullyReceived = order.items.every((i) => i.receivedQuantity >= i.quantity);
      order.status = allFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
      await order.save({ session });

      const goodsReceiptId = randomUUID();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const receiptNumber = `GRN-${new Date().getFullYear()}-${randomSuffix}`;

      const [receipt] = await GoodsReceiptModel.create(
        [
          {
            companyId: input.companyId,
            goodsReceiptId,
            receiptNumber,
            purchaseOrderId: order.purchaseOrderId,
            supplierId: order.supplierId,
            warehouseId,
            branchId: order.branchId,
            status: 'RECEIVED',
            items: mappedItems,
            notes: input.notes,
            receivedBy: input.receivedBy,
            receivedAt: new Date(),
          },
        ],
        { session }
      );

      // Publish GoodsReceiptCreatedEvent via Outbox (triggers stock ingestion in Inventory Service)
      const event = new GoodsReceiptCreatedEvent(
        {
          goodsReceiptId,
          receiptNumber,
          purchaseOrderId: order.purchaseOrderId,
          supplierId: order.supplierId,
          warehouseId,
          branchId: order.branchId,
          items: input.items.map((i) => ({
            productId: i.productId,
            receivedQuantity: i.receivedQuantity,
            unitCost: Number(i.unitCost),
            serialNumbers: i.serialNumbers,
          })),
        },
        {
          companyId: input.companyId,
          branchId: order.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
          actor: { userId: input.receivedBy },
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return receipt;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async getReceiptById(
    companyId: string,
    goodsReceiptId: string
  ): Promise<IGoodsReceipt> {
    const receipt = await GoodsReceiptModel.findOne({ companyId, goodsReceiptId });
    if (!receipt) {
      throw new NotFoundError(`Goods receipt ${goodsReceiptId} not found`);
    }
    return receipt;
  }

  public static async listReceipts(
    companyId: string,
    purchaseOrderId?: string
  ): Promise<IGoodsReceipt[]> {
    const query: Record<string, unknown> = { companyId };
    if (purchaseOrderId) query.purchaseOrderId = purchaseOrderId;

    return GoodsReceiptModel.find(query).sort({ receivedAt: -1 });
  }
}
