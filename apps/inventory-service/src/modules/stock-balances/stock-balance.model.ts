import mongoose, { Schema, Document, Model } from 'mongoose';

export interface StockBalanceDocument extends Document {
  companyId: string;
  warehouseId: string;
  productId: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lastMovementId?: string;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export const StockBalanceSchema = new Schema<StockBalanceDocument>(
  {
    companyId: { type: String, required: true, index: true },
    warehouseId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    onHandQuantity: { type: Number, required: true, default: 0, min: 0 },
    reservedQuantity: { type: Number, required: true, default: 0, min: 0 },
    availableQuantity: { type: Number, required: true, default: 0, min: 0 },
    lastMovementId: { type: String },
    schemaVersion: { type: Number, default: 1, required: true },
  },
  {
    timestamps: true,
    collection: 'stock_balances',
  },
);

// Rule 5: Tenant-aware compound unique index for materialized balance
StockBalanceSchema.index(
  { companyId: 1, warehouseId: 1, productId: 1 },
  { unique: true },
);

export const StockBalanceModel: Model<StockBalanceDocument> =
  mongoose.models.StockBalance ||
  mongoose.model<StockBalanceDocument>('StockBalance', StockBalanceSchema);
