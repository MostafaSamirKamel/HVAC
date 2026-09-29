import { ClientSession } from 'mongoose';
import crypto from 'node:crypto';
import { SalesInvoiceModel, SalesInvoiceDocument, InvoiceStatus } from './sales-invoice.model.js';
import { SalesOrderDocument } from '../sales-orders/sales-order.model.js';
import { NotFoundError } from '@hvac/errors';

export class SalesInvoiceService {
  /**
   * Creates a draft commercial invoice from a sales order (Step 3 of Cash Sale Saga).
   */
  static async createDraftInvoice(
    order: SalesOrderDocument,
    session?: ClientSession,
  ): Promise<SalesInvoiceDocument> {
    const invoiceId = `inv_${crypto.randomUUID().slice(0, 8)}`;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${new Date().getFullYear()}-${randomSuffix}`;

    const [invoice] = await SalesInvoiceModel.create(
      [
        {
          companyId: order.companyId,
          invoiceId,
          invoiceNumber,
          orderId: order.orderId,
          customerId: order.customerId,
          branchId: order.branchId,
          status: 'DRAFT',
          items: order.items.map((i) => ({
            productId: i.productId,
            productName: i.productName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: i.totalPrice,
            serialNumbers: i.serialNumbers || [],
          })),
          totalAmount: order.totalAmount,
          taxAmount: order.taxAmount,
          netAmount: order.netAmount,
          issuedAt: new Date(),
          schemaVersion: 1,
        },
      ],
      { session },
    );

    return invoice;
  }

  static async markInvoicePaid(
    companyId: string,
    invoiceId: string,
    session?: ClientSession,
  ): Promise<SalesInvoiceDocument> {
    const updated = await SalesInvoiceModel.findOneAndUpdate(
      { companyId, invoiceId },
      { $set: { status: 'PAID' } },
      { new: true, session },
    ).exec();

    if (!updated) {
      throw new NotFoundError(`Invoice '${invoiceId}' not found`);
    }
    return updated;
  }

  static async markInvoicePosted(
    companyId: string,
    invoiceId: string,
    session?: ClientSession,
  ): Promise<SalesInvoiceDocument> {
    const updated = await SalesInvoiceModel.findOneAndUpdate(
      { companyId, invoiceId },
      { $set: { status: 'POSTED', postedAt: new Date() } },
      { new: true, session },
    ).exec();

    if (!updated) {
      throw new NotFoundError(`Invoice '${invoiceId}' not found`);
    }
    return updated;
  }

  static async voidInvoice(
    companyId: string,
    invoiceId: string,
    reason: string,
    session?: ClientSession,
  ): Promise<SalesInvoiceDocument> {
    const updated = await SalesInvoiceModel.findOneAndUpdate(
      { companyId, invoiceId },
      { $set: { status: 'VOIDED' } },
      { new: true, session },
    ).exec();

    if (!updated) {
      throw new NotFoundError(`Invoice '${invoiceId}' not found`);
    }
    return updated;
  }

  static async getInvoiceById(companyId: string, invoiceId: string): Promise<SalesInvoiceDocument> {
    const doc = await SalesInvoiceModel.findOne({ companyId, invoiceId }).exec();
    if (!doc) {
      throw new NotFoundError(`Invoice '${invoiceId}' not found`);
    }
    return doc;
  }
}
