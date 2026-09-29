import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { NotFoundError, ValidationError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { OutboxRepository, withTransaction } from '@hvac/database';
import { VendorBillCreatedEvent } from '@hvac/event-contracts';
import { VendorBillModel, IVendorBill, IVendorBillItem, VendorBillStatus } from './vendor-bill.model.js';
import { SupplierService } from '../suppliers/supplier.service.js';

export interface CreateVendorBillItemInput {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: number | string;
}

export interface CreateVendorBillInput {
  companyId: string;
  supplierId: string;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
  branchId: string;
  billNumber?: string;
  billDate?: Date;
  dueDate?: Date;
  taxAmount?: number | string;
  discountAmount?: number | string;
  items: CreateVendorBillItemInput[];
  currency?: string;
  createdBy: string;
}

export class VendorBillService {
  public static async createBill(
    input: CreateVendorBillInput,
    existingSession?: ClientSession
  ): Promise<IVendorBill> {
    if (!input.items || input.items.length === 0) {
      throw new ValidationError('Vendor bill must contain at least one item');
    }

    const currency = input.currency || 'EGP';
    let subtotalMoney = Money.from(0, currency);

    const mappedItems: IVendorBillItem[] = [];

    for (const item of input.items) {
      if (item.quantity <= 0) {
        throw new ValidationError('Item quantity must be greater than zero');
      }

      const costMoney = Money.from(item.unitCost, currency);
      const lineCost = costMoney.multiply(item.quantity);
      subtotalMoney = subtotalMoney.add(lineCost);

      mappedItems.push({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitCost: mongoose.Types.Decimal128.fromString(costMoney.toFixed(2)),
        totalCost: mongoose.Types.Decimal128.fromString(lineCost.toFixed(2)),
      });
    }

    const taxMoney = Money.from(input.taxAmount || 0, currency);
    const discountMoney = Money.from(input.discountAmount || 0, currency);
    const netMoney = subtotalMoney.add(taxMoney).subtract(discountMoney);

    const runner = async (session: ClientSession) => {
      const supplier = await SupplierService.getSupplierById(input.companyId, input.supplierId);

      const vendorBillId = randomUUID();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const billNumber = input.billNumber || `VB-${new Date().getFullYear()}-${randomSuffix}`;

      // Calculate due date if not provided based on supplier payment terms
      const billDate = input.billDate || new Date();
      const dueDate =
        input.dueDate ||
        new Date(billDate.getTime() + (supplier.paymentTermsDays || 30) * 24 * 60 * 60 * 1000);

      const [bill] = await VendorBillModel.create(
        [
          {
            companyId: input.companyId,
            vendorBillId,
            billNumber,
            supplierId: input.supplierId,
            purchaseOrderId: input.purchaseOrderId,
            goodsReceiptId: input.goodsReceiptId,
            branchId: input.branchId,
            status: 'DRAFT',
            billDate,
            dueDate,
            subtotal: mongoose.Types.Decimal128.fromString(subtotalMoney.toFixed(2)),
            taxAmount: mongoose.Types.Decimal128.fromString(taxMoney.toFixed(2)),
            discountAmount: mongoose.Types.Decimal128.fromString(discountMoney.toFixed(2)),
            netAmount: mongoose.Types.Decimal128.fromString(netMoney.toFixed(2)),
            currency,
            items: mappedItems,
            createdBy: input.createdBy,
          },
        ],
        { session }
      );

      // Publish Outbox Event inside transaction (consumed by Finance Service for AP posting - Rule 11)
      const event = new VendorBillCreatedEvent(
        {
          vendorBillId,
          billNumber,
          supplierId: input.supplierId,
          purchaseOrderId: input.purchaseOrderId,
          goodsReceiptId: input.goodsReceiptId,
          totalAmount: subtotalMoney.toNumber(),
          taxAmount: taxMoney.toNumber(),
          netAmount: netMoney.toNumber(),
          currency,
          dueDate: dueDate.toISOString(),
          branchId: input.branchId,
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

      return bill;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async postBill(
    companyId: string,
    vendorBillId: string,
    existingSession?: ClientSession
  ): Promise<IVendorBill> {
    const runner = async (session: ClientSession) => {
      const bill = await VendorBillModel.findOne({ companyId, vendorBillId }).session(session);
      if (!bill) {
        throw new NotFoundError(`Vendor bill ${vendorBillId} not found`);
      }

      if (bill.status !== 'DRAFT') {
        throw new ValidationError(`Bill is already ${bill.status}, cannot post`);
      }

      bill.status = 'POSTED';
      bill.postedAt = new Date();
      await bill.save({ session });

      return bill;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async markPaid(
    companyId: string,
    vendorBillId: string,
    existingSession?: ClientSession
  ): Promise<IVendorBill> {
    const runner = async (session: ClientSession) => {
      const bill = await VendorBillModel.findOne({ companyId, vendorBillId }).session(session);
      if (!bill) {
        throw new NotFoundError(`Vendor bill ${vendorBillId} not found`);
      }

      bill.status = 'PAID';
      await bill.save({ session });

      return bill;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async getBillById(companyId: string, vendorBillId: string): Promise<IVendorBill> {
    const bill = await VendorBillModel.findOne({ companyId, vendorBillId });
    if (!bill) {
      throw new NotFoundError(`Vendor bill ${vendorBillId} not found`);
    }
    return bill;
  }

  public static async listBills(
    companyId: string,
    filter: { supplierId?: string; branchId?: string; status?: VendorBillStatus }
  ): Promise<IVendorBill[]> {
    const query: Record<string, unknown> = { companyId };
    if (filter.supplierId) query.supplierId = filter.supplierId;
    if (filter.branchId) query.branchId = filter.branchId;
    if (filter.status) query.status = filter.status;

    return VendorBillModel.find(query).sort({ billDate: -1 });
  }
}
