import mongoose, { Schema, Document, Model } from 'mongoose';

export type MovementType =
  | 'INBOUND_PURCHASE'
  | 'OUTBOUND_SALE'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'ADJUSTMENT_ADD'
  | 'ADJUSTMENT_SUB'
  | 'RESERVATION_HOLD'
  | 'RESERVATION_RELEASE'
  | 'COMPENSATION_RETURN';

export type MovementDirection = 'IN' | 'OUT';

export interface StockMovementDocument extends Document {
  companyId: string;
  movementId: string;
  movementType: MovementType;
  productId: string;
  warehouseId: string;
  toWarehouseId?: string;
  quantity: number;
  direction: MovementDirection;
  serialNumbers?: string[];
  referenceType: string;
  referenceId: string;
  costPerUnit?: mongoose.Types.Decimal128;
  performedBy: string;
  notes?: string;
  createdAt: Date;
}

export const StockMovementSchema = new Schema<StockMovementDocument>(
  {
    companyId: { type: String, required: true, index: true },
    movementId: { type: String, required: true, index: true },
    movementType: {
      type: String,
      enum: [
        'INBOUND_PURCHASE',
        'OUTBOUND_SALE',
        'TRANSFER_OUT',
        'TRANSFER_IN',
        'ADJUSTMENT_ADD',
        'ADJUSTMENT_SUB',
        'RESERVATION_HOLD',
        'RESERVATION_RELEASE',
        'COMPENSATION_RETURN',
      ],
      required: true,
      index: true,
    },
    productId: { type: String, required: true, index: true },
    warehouseId: { type: String, required: true, index: true },
    toWarehouseId: { type: String },
    quantity: { type: Number, required: true, min: 1 },
    direction: { type: String, enum: ['IN', 'OUT'], required: true },
    serialNumbers: [{ type: String }],
    referenceType: { type: String, required: true },
    referenceId: { type: String, required: true, index: true },
    costPerUnit: { type: Schema.Types.Decimal128 },
    performedBy: { type: String, required: true },
    notes: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable Ledger: No updates permitted!
    collection: 'stock_movements',
  },
);

// Rule 9: Query index for historical ledger audit
StockMovementSchema.index({ companyId: 1, warehouseId: 1, productId: 1, createdAt: -1 });
StockMovementSchema.index({ companyId: 1, movementId: 1 }, { unique: true });

export const StockMovementModel: Model<StockMovementDocument> =
  mongoose.models.StockMovement ||
  mongoose.model<StockMovementDocument>('StockMovement', StockMovementSchema);
