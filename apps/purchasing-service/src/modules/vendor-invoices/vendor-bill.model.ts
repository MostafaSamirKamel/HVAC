import mongoose, { Schema, Document, Model } from 'mongoose';

export type VendorBillStatus = 'DRAFT' | 'POSTED' | 'PAID' | 'CANCELLED';

export interface IVendorBillItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: mongoose.Types.Decimal128;
  totalCost: mongoose.Types.Decimal128;
}

export interface IVendorBill extends Document {
  companyId: string;
  vendorBillId: string;
  billNumber: string;
  supplierId: string;
  purchaseOrderId?: string;
  goodsReceiptId?: string;
  branchId: string;
  status: VendorBillStatus;
  billDate: Date;
  dueDate: Date;
  subtotal: mongoose.Types.Decimal128;
  taxAmount: mongoose.Types.Decimal128;
  discountAmount: mongoose.Types.Decimal128;
  netAmount: mongoose.Types.Decimal128;
  currency: string;
  items: IVendorBillItem[];
  postedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const VendorBillItemSchema = new Schema<IVendorBillItem>(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitCost: { type: Schema.Types.Decimal128, required: true },
    totalCost: { type: Schema.Types.Decimal128, required: true },
  },
  { _id: false }
);

const VendorBillSchema = new Schema<IVendorBill>(
  {
    companyId: { type: String, required: true, index: true },
    vendorBillId: { type: String, required: true, unique: true },
    billNumber: { type: String, required: true },
    supplierId: { type: String, required: true, index: true },
    purchaseOrderId: { type: String, index: true },
    goodsReceiptId: { type: String, index: true },
    branchId: { type: String, required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'POSTED', 'PAID', 'CANCELLED'],
      default: 'DRAFT',
    },
    billDate: { type: Date, required: true, default: Date.now },
    dueDate: { type: Date, required: true },
    subtotal: { type: Schema.Types.Decimal128, required: true },
    taxAmount: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    discountAmount: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    netAmount: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, required: true, default: 'EGP' },
    items: { type: [VendorBillItemSchema], required: true },
    postedAt: { type: Date },
    createdBy: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'vendor_bills',
  }
);

// Multi-tenant unique index on bill number
VendorBillSchema.index({ companyId: 1, billNumber: 1 }, { unique: true });
VendorBillSchema.index({ companyId: 1, supplierId: 1, status: 1 });

export const VendorBillModel: Model<IVendorBill> =
  mongoose.models.VendorBill ||
  mongoose.model<IVendorBill>('VendorBill', VendorBillSchema);
