import mongoose, { Schema, Document, Model } from 'mongoose';

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface IPurchaseOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  receivedQuantity: number;
  unitCost: mongoose.Types.Decimal128;
  totalCost: mongoose.Types.Decimal128;
}

export interface IPurchaseOrder extends Document {
  companyId: string;
  purchaseOrderId: string;
  orderNumber: string;
  supplierId: string;
  branchId: string;
  warehouseId: string;
  status: PurchaseOrderStatus;
  items: IPurchaseOrderItem[];
  totalAmount: mongoose.Types.Decimal128;
  currency: string;
  expectedDeliveryDate?: Date;
  notes?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseOrderItemSchema = new Schema<IPurchaseOrderItem>(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true },
    receivedQuantity: { type: Number, required: true, default: 0 },
    unitCost: { type: Schema.Types.Decimal128, required: true },
    totalCost: { type: Schema.Types.Decimal128, required: true },
  },
  { _id: false }
);

const PurchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    companyId: { type: String, required: true, index: true },
    purchaseOrderId: { type: String, required: true, unique: true },
    orderNumber: { type: String, required: true },
    supplierId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    warehouseId: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
      default: 'DRAFT',
    },
    items: { type: [PurchaseOrderItemSchema], required: true },
    totalAmount: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, required: true, default: 'EGP' },
    expectedDeliveryDate: { type: Date },
    notes: { type: String },
    createdBy: { type: String, required: true },
    approvedBy: { type: String },
    approvedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'purchase_orders',
  }
);

// Multi-tenant unique index on order number
PurchaseOrderSchema.index({ companyId: 1, orderNumber: 1 }, { unique: true });
PurchaseOrderSchema.index({ companyId: 1, supplierId: 1, status: 1 });

export const PurchaseOrderModel: Model<IPurchaseOrder> =
  mongoose.models.PurchaseOrder ||
  mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
