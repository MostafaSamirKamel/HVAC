import mongoose, { Schema, Document, Model } from 'mongoose';

export type SaleType = 'CASH' | 'INSTALLMENT' | 'COMMERCIAL';
export type OrderStatus =
  | 'PENDING'
  | 'STOCK_RESERVED'
  | 'INVOICED'
  | 'PAID'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface SalesOrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: mongoose.Types.Decimal128;
  discountAmount: mongoose.Types.Decimal128;
  totalPrice: mongoose.Types.Decimal128;
  serialNumbers?: string[];
}

export interface SalesOrderDocument extends Document {
  companyId: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  branchId: string;
  warehouseId: string;
  saleType: SaleType;
  status: OrderStatus;
  items: SalesOrderItem[];
  totalAmount: mongoose.Types.Decimal128;
  discountAmount: mongoose.Types.Decimal128;
  taxAmount: mongoose.Types.Decimal128;
  netAmount: mongoose.Types.Decimal128;
  invoiceId?: string;
  reservationId?: string;
  salesRepresentativeId: string;
  notes?: string;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const SalesOrderItemSchema = new Schema<SalesOrderItem>(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Schema.Types.Decimal128, required: true },
    discountAmount: { type: Schema.Types.Decimal128, required: true, default: 0 },
    totalPrice: { type: Schema.Types.Decimal128, required: true },
    serialNumbers: [{ type: String }],
  },
  { _id: false },
);

export const SalesOrderSchema = new Schema<SalesOrderDocument>(
  {
    companyId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true, trim: true, uppercase: true },
    customerId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    warehouseId: { type: String, required: true, index: true },
    saleType: {
      type: String,
      enum: ['CASH', 'INSTALLMENT', 'COMMERCIAL'],
      required: true,
      default: 'CASH',
    },
    status: {
      type: String,
      enum: ['PENDING', 'STOCK_RESERVED', 'INVOICED', 'PAID', 'DELIVERED', 'COMPLETED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    items: [SalesOrderItemSchema],
    totalAmount: { type: Schema.Types.Decimal128, required: true },
    discountAmount: { type: Schema.Types.Decimal128, required: true, default: 0 },
    taxAmount: { type: Schema.Types.Decimal128, required: true, default: 0 },
    netAmount: { type: Schema.Types.Decimal128, required: true },
    invoiceId: { type: String },
    reservationId: { type: String },
    salesRepresentativeId: { type: String, required: true },
    notes: { type: String },
    schemaVersion: { type: Number, default: 1, required: true },
  },
  {
    timestamps: true,
    collection: 'sales_orders',
  },
);

// Rule 5: Tenant-aware unique index
SalesOrderSchema.index({ companyId: 1, orderNumber: 1 }, { unique: true });
SalesOrderSchema.index({ companyId: 1, orderId: 1 }, { unique: true });
SalesOrderSchema.index({ companyId: 1, branchId: 1, status: 1 });

export const SalesOrderModel: Model<SalesOrderDocument> =
  mongoose.models.SalesOrder || mongoose.model<SalesOrderDocument>('SalesOrder', SalesOrderSchema);
