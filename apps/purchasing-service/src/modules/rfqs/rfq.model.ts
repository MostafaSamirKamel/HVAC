import mongoose, { Schema, Document, Model } from 'mongoose';

export type RFQStatus = 'DRAFT' | 'SENT' | 'CLOSED' | 'AWARDED' | 'CANCELLED';

export interface IRFQItem {
  productId: string;
  productName: string;
  quantity: number;
  targetUnitCost?: mongoose.Types.Decimal128;
}

export interface ISupplierQuotationItem {
  productId: string;
  unitCost: mongoose.Types.Decimal128;
  totalCost: mongoose.Types.Decimal128;
  leadTimeDays?: number;
}

export interface ISupplierQuotation {
  quotationId: string;
  supplierId: string;
  supplierName: string;
  quotationReference?: string;
  receivedDate: Date;
  items: ISupplierQuotationItem[];
  totalAmount: mongoose.Types.Decimal128;
  currency: string;
  paymentTermsDays?: number;
  isAwarded: boolean;
  notes?: string;
}

export interface IRFQ extends Document {
  companyId: string;
  branchId: string;
  rfqId: string;
  rfqNumber: string;
  purchaseRequestId?: string;
  title: string;
  status: RFQStatus;
  deadline?: Date;
  items: IRFQItem[];
  invitedSuppliers: string[];
  quotations: ISupplierQuotation[];
  awardedSupplierId?: string;
  awardedPurchaseOrderId?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const RFQItemSchema = new Schema<IRFQItem>(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    targetUnitCost: { type: Schema.Types.Decimal128 },
  },
  { _id: false }
);

const SupplierQuotationItemSchema = new Schema<ISupplierQuotationItem>(
  {
    productId: { type: String, required: true },
    unitCost: { type: Schema.Types.Decimal128, required: true },
    totalCost: { type: Schema.Types.Decimal128, required: true },
    leadTimeDays: { type: Number },
  },
  { _id: false }
);

const SupplierQuotationSchema = new Schema<ISupplierQuotation>(
  {
    quotationId: { type: String, required: true },
    supplierId: { type: String, required: true },
    supplierName: { type: String, required: true },
    quotationReference: { type: String },
    receivedDate: { type: Date, default: Date.now },
    items: { type: [SupplierQuotationItemSchema], required: true },
    totalAmount: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, required: true, default: 'EGP' },
    paymentTermsDays: { type: Number },
    isAwarded: { type: Boolean, default: false },
    notes: { type: String },
  },
  { _id: false }
);

const RFQSchema = new Schema<IRFQ>(
  {
    companyId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    rfqId: { type: String, required: true, unique: true },
    rfqNumber: { type: String, required: true },
    purchaseRequestId: { type: String },
    title: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'SENT', 'CLOSED', 'AWARDED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    deadline: { type: Date },
    items: { type: [RFQItemSchema], required: true },
    invitedSuppliers: [{ type: String }],
    quotations: { type: [SupplierQuotationSchema], default: [] },
    awardedSupplierId: { type: String },
    awardedPurchaseOrderId: { type: String },
    notes: { type: String },
    createdBy: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'rfqs',
  }
);

RFQSchema.index({ companyId: 1, rfqNumber: 1 }, { unique: true });
RFQSchema.index({ companyId: 1, branchId: 1, status: 1 });

export const RFQModel: Model<IRFQ> =
  mongoose.models.RFQ || mongoose.model<IRFQ>('RFQ', RFQSchema);
