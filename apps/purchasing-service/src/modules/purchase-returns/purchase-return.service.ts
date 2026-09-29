import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { ValidationError, NotFoundError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { OutboxRepository, withTransaction } from '@hvac/database';
import { PurchaseReturnCreatedEvent } from '@hvac/event-contracts';
import {
  PurchaseReturnModel,
  IPurchaseReturn,
  IPurchaseReturnItem,
  PurchaseReturnStatus,
} from './purchase-return.model.js';
import { SupplierModel } from '../suppliers/supplier.model.js';

export interface CreatePurchaseReturnItemInput {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number | string;
  serialNumbers?: string[];
  reason: string;
}

export interface CreatePurchaseReturnInput {
  companyId: string;
  branchId: string;
  warehouseId: string;
  supplierId: string;
  purchaseOrderId?: string;
  vendorBillId?: string;
  items: CreatePurchaseReturnItemInput[];
  notes?: string;
  returnedBy: string;
  currency?: string;
}

export class PurchaseReturnService {
  public static async createReturn(
    input: CreatePurchaseReturnInput,
    session?: ClientSession
  ): Promise<IPurchaseReturn> {
    if (!input.items || input.items.length === 0) {
      throw new ValidationError('Purchase return must contain at least one item');
    }

    const supplier = await SupplierModel.findOne({
      companyId: input.companyId,
      supplierId: input.supplierId,
    });
    if (!supplier) {
      throw new NotFoundError(`Supplier ${input.supplierId} not found`);
    }

    const currency = input.currency || 'EGP';
    let totalReturnMoney = Money.from(0, currency);
    const mappedItems: IPurchaseReturnItem[] = [];

    for (const item of input.items) {
      if (item.quantity <= 0) {
        throw new ValidationError('Return item quantity must be greater than zero');
      }

      if (item.serialNumbers && item.serialNumbers.length !== item.quantity) {
        throw new ValidationError(
          `Number of serial numbers (${item.serialNumbers.length}) must match returned quantity (${item.quantity}) for product ${item.productId}`
        );
      }

      const unitCostMoney = Money.from(item.unitCost, currency);
      const lineCostMoney = unitCostMoney.multiply(item.quantity);
      totalReturnMoney = totalReturnMoney.add(lineCostMoney);

      mappedItems.push({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitCost: mongoose.Types.Decimal128.fromString(unitCostMoney.toFixed(2)),
        totalCost: mongoose.Types.Decimal128.fromString(lineCostMoney.toFixed(2)),
        serialNumbers: item.serialNumbers,
        reason: item.reason,
      });
    }

    const returnId = randomUUID();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const returnNumber = `RTV-${new Date().getFullYear()}-${randomSuffix}`;

    const [purchaseReturn] = await PurchaseReturnModel.create(
      [
        {
          companyId: input.companyId,
          branchId: input.branchId,
          warehouseId: input.warehouseId,
          returnId,
          returnNumber,
          supplierId: input.supplierId,
          purchaseOrderId: input.purchaseOrderId,
          vendorBillId: input.vendorBillId,
          status: 'DRAFT',
          items: mappedItems,
          totalAmount: mongoose.Types.Decimal128.fromString(totalReturnMoney.toFixed(2)),
          currency,
          notes: input.notes,
          returnedBy: input.returnedBy,
        },
      ],
      { session }
    );

    return purchaseReturn;
  }

  public static async approveReturn(
    companyId: string,
    returnId: string,
    approvedBy: string,
    existingSession?: ClientSession
  ): Promise<IPurchaseReturn> {
    const runner = async (session: ClientSession) => {
      const pReturn = await PurchaseReturnModel.findOne({ companyId, returnId }).session(session);
      if (!pReturn) {
        throw new NotFoundError(`Purchase return ${returnId} not found`);
      }

      if (pReturn.status !== 'DRAFT') {
        throw new ValidationError(`Cannot approve return with status '${pReturn.status}'`);
      }

      pReturn.status = 'APPROVED';
      pReturn.approvedBy = approvedBy;
      pReturn.approvedAt = new Date();
      await pReturn.save({ session });

      // Publish Outbox Event to notify Inventory Service (deduct stock, set serial status to SUPPLIER_RETURN)
      // and Finance Service (debit supplier ledger)
      const event = new PurchaseReturnCreatedEvent(
        {
          returnId: pReturn.returnId,
          returnNumber: pReturn.returnNumber,
          supplierId: pReturn.supplierId,
          warehouseId: pReturn.warehouseId,
          branchId: pReturn.branchId,
          totalAmount: Money.from(pReturn.totalAmount.toString(), pReturn.currency).toNumber(),
          reason: pReturn.notes || 'Return to Vendor',
          items: pReturn.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitCost: Money.from(i.unitCost.toString(), pReturn.currency).toNumber(),
            serialNumbers: i.serialNumbers,
          })),
        },
        {
          companyId,
          branchId: pReturn.branchId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return pReturn;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async getReturnById(
    companyId: string,
    returnId: string
  ): Promise<IPurchaseReturn> {
    const pReturn = await PurchaseReturnModel.findOne({ companyId, returnId });
    if (!pReturn) {
      throw new NotFoundError(`Purchase return ${returnId} not found`);
    }
    return pReturn;
  }

  public static async listReturns(
    companyId: string,
    filter: { supplierId?: string; status?: PurchaseReturnStatus; branchId?: string } = {}
  ): Promise<IPurchaseReturn[]> {
    const query: Record<string, unknown> = { companyId };
    if (filter.supplierId) query.supplierId = filter.supplierId;
    if (filter.status) query.status = filter.status;
    if (filter.branchId) query.branchId = filter.branchId;

    return PurchaseReturnModel.find(query).sort({ createdAt: -1 });
  }
}
