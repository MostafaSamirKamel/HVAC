import mongoose, { Schema, Document, Model } from 'mongoose';

export type GoodsReceiptStatus = 'RECEIVED' | 'CANCELLED';

export interface IGoodsReceiptItem {
  productId: string;
  receivedQuantity: number;
  unitCost: mongoose.Types.Decimal128;
  serialNumbers?: string[];
}

export interface IGoodsReceipt extends Document {
  companyId: string;
  goodsReceiptId: string;
  receiptNumber: string;
  purchaseOrderId: string;
  supplierId: string;
  warehouseId: string;
  branchId: string;
  status: GoodsReceiptStatus;
  items: IGoodsReceiptItem[];
  notes?: string;
  receivedBy: string;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const GoodsReceiptItemSchema = new Schema<IGoodsReceiptItem>(
  {
    productId: { type: String, required: true },
    receivedQuantity: { type: Number, required: true },
    unitCost: { type: Schema.Types.Decimal128, required: true },
    serialNumbers: { type: [String], default: [] },
  },
  { _id: false }
);

const GoodsReceiptSchema = new Schema<IGoodsReceipt>(
  {
    companyId: { type: String, required: true, index: true },
    goodsReceiptId: { type: String, required: true, unique: true },
    receiptNumber: { type: String, required: true },
    purchaseOrderId: { type: String, required: true, index: true },
    supplierId: { type: String, required: true },
    warehouseId: { type: String, required: true },
    branchId: { type: String, required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ['RECEIVED', 'CANCELLED'],
      default: 'RECEIVED',
    },
    items: { type: [GoodsReceiptItemSchema], required: true },
    notes: { type: String },
    receivedBy: { type: String, required: true },
    receivedAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'goods_receipts',
  }
);

// Multi-tenant unique index on receipt number
GoodsReceiptSchema.index({ companyId: 1, receiptNumber: 1 }, { unique: true });
GoodsReceiptSchema.index({ companyId: 1, purchaseOrderId: 1 });

export const GoodsReceiptModel: Model<IGoodsReceipt> =
  mongoose.models.GoodsReceipt ||
  mongoose.model<IGoodsReceipt>('GoodsReceipt', GoodsReceiptSchema);
