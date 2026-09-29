import mongoose, { Schema, Document, Model } from 'mongoose';

export type SerialState =
  | 'IN_STOCK'
  | 'RESERVED'
  | 'SOLD'
  | 'DEFECTIVE'
  | 'UNDER_MAINTENANCE'
  | 'RETURNED';

export interface SerialNumberDocument extends Document {
  companyId: string;
  serialNumber: string;
  productId: string;
  warehouseId: string;
  state: SerialState;
  reservationId?: string;
  orderId?: string;
  soldInvoiceId?: string;
  receivedDate: Date;
  soldDate?: Date;
  notes?: string;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export const SerialNumberSchema = new Schema<SerialNumberDocument>(
  {
    companyId: { type: String, required: true, index: true },
    serialNumber: { type: String, required: true, trim: true, uppercase: true },
    productId: { type: String, required: true, index: true },
    warehouseId: { type: String, required: true, index: true },
    state: {
      type: String,
      enum: ['IN_STOCK', 'RESERVED', 'SOLD', 'DEFECTIVE', 'UNDER_MAINTENANCE', 'RETURNED'],
      default: 'IN_STOCK',
      index: true,
    },
    reservationId: { type: String, index: true },
    orderId: { type: String, index: true },
    soldInvoiceId: { type: String, index: true },
    receivedDate: { type: Date, default: Date.now },
    soldDate: { type: Date },
    notes: { type: String },
    schemaVersion: { type: Number, default: 1, required: true },
  },
  {
    timestamps: true,
    collection: 'serial_numbers',
  },
);

// Rule 5: Tenant-aware unique serial number index
SerialNumberSchema.index({ companyId: 1, serialNumber: 1 }, { unique: true });
SerialNumberSchema.index({ companyId: 1, productId: 1, warehouseId: 1, state: 1 });

export const SerialNumberModel: Model<SerialNumberDocument> =
  mongoose.models.SerialNumber ||
  mongoose.model<SerialNumberDocument>('SerialNumber', SerialNumberSchema);
