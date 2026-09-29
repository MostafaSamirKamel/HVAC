import mongoose, { Schema, Document, Model } from 'mongoose';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'POSTED' | 'VOIDED';

export interface SalesInvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: mongoose.Types.Decimal128;
  totalPrice: mongoose.Types.Decimal128;
  serialNumbers?: string[];
}

export interface SalesInvoiceDocument extends Document {
  companyId: string;
  invoiceId: string;
  invoiceNumber: string;
  orderId: string;
  customerId: string;
  branchId: string;
  status: InvoiceStatus;
  items: SalesInvoiceItem[];
  totalAmount: mongoose.Types.Decimal128;
  taxAmount: mongoose.Types.Decimal128;
  netAmount: mongoose.Types.Decimal128;
  issuedAt: Date;
  postedAt?: Date;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const SalesInvoiceItemSchema = new Schema<SalesInvoiceItem>(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Schema.Types.Decimal128, required: true },
    totalPrice: { type: Schema.Types.Decimal128, required: true },
    serialNumbers: [{ type: String }],
  },
  { _id: false },
);

export const SalesInvoiceSchema = new Schema<SalesInvoiceDocument>(
  {
    companyId: { type: String, required: true, index: true },
    invoiceId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, required: true, trim: true, uppercase: true },
    orderId: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['DRAFT', 'ISSUED', 'PAID', 'POSTED', 'VOIDED'],
      default: 'DRAFT',
      index: true,
    },
    items: [SalesInvoiceItemSchema],
    totalAmount: { type: Schema.Types.Decimal128, required: true },
    taxAmount: { type: Schema.Types.Decimal128, required: true, default: 0 },
    netAmount: { type: Schema.Types.Decimal128, required: true },
    issuedAt: { type: Date, default: Date.now },
    postedAt: { type: Date },
    schemaVersion: { type: Number, default: 1, required: true },
  },
  {
    timestamps: true,
    collection: 'sales_invoices',
  },
);

// Rule 5 & 11: Commercial Invoice Ownership and Tenant-Aware Index
SalesInvoiceSchema.index({ companyId: 1, invoiceNumber: 1 }, { unique: true });
SalesInvoiceSchema.index({ companyId: 1, invoiceId: 1 }, { unique: true });
SalesInvoiceSchema.index({ companyId: 1, orderId: 1 });

export const SalesInvoiceModel: Model<SalesInvoiceDocument> =
  mongoose.models.SalesInvoice ||
  mongoose.model<SalesInvoiceDocument>('SalesInvoice', SalesInvoiceSchema);
