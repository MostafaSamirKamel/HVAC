import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { NotFoundError, ValidationError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { withTransaction } from '@hvac/database';
import {
  RFQModel,
  IRFQ,
  IRFQItem,
  ISupplierQuotation,
  ISupplierQuotationItem,
  RFQStatus,
} from './rfq.model.js';
import { SupplierModel } from '../suppliers/supplier.model.js';
import { PurchaseOrderService } from '../purchase-orders/purchase-order.service.js';
import { IPurchaseOrder } from '../purchase-orders/purchase-order.model.js';

export interface CreateRFQItemInput {
  productId: string;
  productName: string;
  quantity: number;
  targetUnitCost?: number | string;
}

export interface CreateRFQInput {
  companyId: string;
  branchId: string;
  title: string;
  purchaseRequestId?: string;
  deadline?: Date;
  items: CreateRFQItemInput[];
  invitedSuppliers?: string[];
  notes?: string;
  createdBy: string;
}

export interface AddQuotationItemInput {
  productId: string;
  unitCost: number | string;
  leadTimeDays?: number;
}

export interface AddQuotationInput {
  companyId: string;
  rfqId: string;
  supplierId: string;
  quotationReference?: string;
  items: AddQuotationItemInput[];
  currency?: string;
  paymentTermsDays?: number;
  notes?: string;
}

export class RFQService {
  public static async createRFQ(
    input: CreateRFQInput,
    session?: ClientSession
  ): Promise<IRFQ> {
    if (!input.items || input.items.length === 0) {
      throw new ValidationError('RFQ must contain at least one item');
    }

    const mappedItems: IRFQItem[] = [];
    for (const item of input.items) {
      if (item.quantity <= 0) {
        throw new ValidationError('Item quantity must be greater than zero');
      }

      mappedItems.push({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        targetUnitCost: item.targetUnitCost
          ? mongoose.Types.Decimal128.fromString(
              Money.from(item.targetUnitCost, 'EGP').toFixed(2)
            )
          : undefined,
      });
    }

    if (input.invitedSuppliers && input.invitedSuppliers.length > 0) {
      const suppliersCount = await SupplierModel.countDocuments({
        companyId: input.companyId,
        supplierId: { $in: input.invitedSuppliers },
      });
      if (suppliersCount !== input.invitedSuppliers.length) {
        throw new ValidationError('One or more invited suppliers do not exist');
      }
    }

    const rfqId = randomUUID();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const rfqNumber = `RFQ-${new Date().getFullYear()}-${randomSuffix}`;

    const [rfq] = await RFQModel.create(
      [
        {
          companyId: input.companyId,
          branchId: input.branchId,
          rfqId,
          rfqNumber,
          title: input.title,
          purchaseRequestId: input.purchaseRequestId,
          deadline: input.deadline,
          status: 'DRAFT',
          items: mappedItems,
          invitedSuppliers: input.invitedSuppliers || [],
          quotations: [],
          notes: input.notes,
          createdBy: input.createdBy,
        },
      ],
      { session }
    );

    return rfq;
  }

  public static async addSupplierQuotation(
    input: AddQuotationInput,
    session?: ClientSession
  ): Promise<IRFQ> {
    const query = RFQModel.findOne({ companyId: input.companyId, rfqId: input.rfqId });
    const rfq = session ? await query.session(session) : await query;
    if (!rfq) {
      throw new NotFoundError(`RFQ ${input.rfqId} not found`);
    }

    if (rfq.status === 'CLOSED' || rfq.status === 'AWARDED' || rfq.status === 'CANCELLED') {
      throw new ValidationError(`Cannot add quotation to RFQ with status '${rfq.status}'`);
    }

    const supplier = await SupplierModel.findOne({
      companyId: input.companyId,
      supplierId: input.supplierId,
    });
    if (!supplier) {
      throw new NotFoundError(`Supplier ${input.supplierId} not found`);
    }

    const currency = input.currency || 'EGP';
    let totalMoney = Money.from(0, currency);
    const mappedItems: ISupplierQuotationItem[] = [];

    for (const rfqItem of rfq.items) {
      const quoteItem = input.items.find((i) => i.productId === rfqItem.productId);
      if (!quoteItem) {
        throw new ValidationError(
          `Missing quotation for RFQ product ${rfqItem.productId} (${rfqItem.productName})`
        );
      }

      const unitCost = Money.from(quoteItem.unitCost, currency);
      const totalCost = unitCost.multiply(rfqItem.quantity);
      totalMoney = totalMoney.add(totalCost);

      mappedItems.push({
        productId: quoteItem.productId,
        unitCost: mongoose.Types.Decimal128.fromString(unitCost.toFixed(2)),
        totalCost: mongoose.Types.Decimal128.fromString(totalCost.toFixed(2)),
        leadTimeDays: quoteItem.leadTimeDays,
      });
    }

    const quotation: ISupplierQuotation = {
      quotationId: randomUUID(),
      supplierId: supplier.supplierId,
      supplierName: supplier.name,
      quotationReference: input.quotationReference,
      receivedDate: new Date(),
      items: mappedItems,
      totalAmount: mongoose.Types.Decimal128.fromString(totalMoney.toFixed(2)),
      currency,
      paymentTermsDays: input.paymentTermsDays || supplier.paymentTermsDays,
      isAwarded: false,
      notes: input.notes,
    };

    rfq.quotations.push(quotation);
    if (rfq.status === 'DRAFT') {
      rfq.status = 'SENT';
    }

    await rfq.save({ session });
    return rfq;
  }

  public static async awardQuotation(
    companyId: string,
    rfqId: string,
    quotationId: string,
    warehouseId: string,
    awardedBy: string,
    existingSession?: ClientSession
  ): Promise<{ rfq: IRFQ; purchaseOrder: IPurchaseOrder }> {
    const runner = async (session: ClientSession) => {
      const rfq = await RFQModel.findOne({ companyId, rfqId }).session(session);
      if (!rfq) {
        throw new NotFoundError(`RFQ ${rfqId} not found`);
      }

      if (rfq.status === 'AWARDED' || rfq.status === 'CANCELLED') {
        throw new ValidationError(`Cannot award RFQ with status '${rfq.status}'`);
      }

      const quote = rfq.quotations.find((q) => q.quotationId === quotationId);
      if (!quote) {
        throw new NotFoundError(`Quotation ${quotationId} not found in RFQ ${rfqId}`);
      }

      // Mark quotation awarded
      for (const q of rfq.quotations) {
        q.isAwarded = q.quotationId === quotationId;
      }
      rfq.awardedSupplierId = quote.supplierId;
      rfq.status = 'AWARDED';

      // Automatically generate Purchase Order
      const poItems = quote.items.map((qi) => {
        const rfqItem = rfq.items.find((ri) => ri.productId === qi.productId);
        return {
          productId: qi.productId,
          productName: rfqItem?.productName || qi.productId,
          quantity: rfqItem?.quantity || 1,
          unitCost: qi.unitCost.toString(),
        };
      });

      const po = await PurchaseOrderService.createOrder(
        {
          companyId,
          supplierId: quote.supplierId,
          branchId: rfq.branchId,
          warehouseId,
          currency: quote.currency,
          notes: `Awarded from ${rfq.rfqNumber} (Quotation Ref: ${quote.quotationReference || quote.quotationId}). RFQ Title: ${rfq.title}`,
          createdBy: awardedBy,
          items: poItems,
        },
        session
      );

      rfq.awardedPurchaseOrderId = po.purchaseOrderId;
      await rfq.save({ session });

      return { rfq, purchaseOrder: po };
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async getRFQById(companyId: string, rfqId: string): Promise<IRFQ> {
    const rfq = await RFQModel.findOne({ companyId, rfqId });
    if (!rfq) {
      throw new NotFoundError(`RFQ ${rfqId} not found`);
    }
    return rfq;
  }

  public static async listRFQs(
    companyId: string,
    filter: { branchId?: string; status?: RFQStatus } = {}
  ): Promise<IRFQ[]> {
    const query: Record<string, unknown> = { companyId };
    if (filter.branchId) query.branchId = filter.branchId;
    if (filter.status) query.status = filter.status;

    return RFQModel.find(query).sort({ createdAt: -1 });
  }
}
