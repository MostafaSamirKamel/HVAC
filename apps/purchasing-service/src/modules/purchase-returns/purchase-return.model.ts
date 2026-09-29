import mongoose, { Schema, Document, Model } from 'mongoose';

export type PurchaseReturnStatus = 'DRAFT' | 'APPROVED' | 'COMPLETED' | 'CANCELLED';

export interface IPurchaseReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  unitCost: mongoose.Types.Decimal128;
  totalCost: mongoose.Types.Decimal128;
  serialNumbers?: string[];
  reason: string;
}

export interface IPurchaseReturn extends Document {
  companyId: string;
  branchId: string;
  warehouseId: string;
  returnId: string;
  returnNumber: string;
  supplierId: string;
  purchaseOrderId?: string;
  vendorBillId?: string;
  status: PurchaseReturnStatus;
  items: IPurchaseReturnItem[];
  totalAmount: mongoose.Types.Decimal128;
  currency: string;
  notes?: string;
  returnedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseReturnItemSchema = new Schema<IPurchaseReturnItem>(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Schema.Types.Decimal128, required: true },
    totalCost: { type: Schema.Types.Decimal128, required: true },
    serialNumbers: [{ type: String }],
    reason: { type: String, required: true },
  },
  { _id: false }
);

const PurchaseReturnSchema = new Schema<IPurchaseReturn>(
  {
    companyId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    warehouseId: { type: String, required: true, index: true },
    returnId: { type: String, required: true, unique: true },
    returnNumber: { type: String, required: true },
    supplierId: { type: String, required: true, index: true },
    purchaseOrderId: { type: String },
    vendorBillId: { type: String },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'APPROVED', 'COMPLETED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    items: { type: [PurchaseReturnItemSchema], required: true },
    totalAmount: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, required: true, default: 'EGP' },
    notes: { type: String },
    returnedBy: { type: String, required: true },
    approvedBy: { type: String },
    approvedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'purchase_returns',
  }
);

PurchaseReturnSchema.index({ companyId: 1, returnNumber: 1 }, { unique: true });
PurchaseReturnSchema.index({ companyId: 1, supplierId: 1, status: 1 });

export const PurchaseReturnModel: Model<IPurchaseReturn> =
  mongoose.models.PurchaseReturn ||
  mongoose.model<IPurchaseReturn>('PurchaseReturn', PurchaseReturnSchema);
