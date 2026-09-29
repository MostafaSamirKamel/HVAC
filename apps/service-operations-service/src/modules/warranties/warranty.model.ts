import mongoose, { Schema, Document, Model } from 'mongoose';

export type WarrantyStatus = 'ACTIVE' | 'EXPIRED' | 'VOIDED';

export interface IWarranty extends Document {
  companyId: string;
  warrantyId: string;
  serialNumber: string;
  productId: string;
  customerId: string;
  workOrderId?: string;
  startDate: Date;
  machineExpiryDate: Date;
  compressorExpiryDate: Date;
  status: WarrantyStatus;
  terms?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WarrantySchema = new Schema<IWarranty>(
  {
    companyId: { type: String, required: true, index: true },
    warrantyId: { type: String, required: true, unique: true },
    serialNumber: { type: String, required: true },
    productId: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    workOrderId: { type: String },
    startDate: { type: Date, required: true },
    machineExpiryDate: { type: Date, required: true },
    compressorExpiryDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'EXPIRED', 'VOIDED'],
      default: 'ACTIVE',
    },
    terms: { type: String },
  },
  {
    timestamps: true,
    collection: 'warranties',
  }
);

// Multi-tenant unique index on serial number
WarrantySchema.index({ companyId: 1, serialNumber: 1 }, { unique: true });

export const WarrantyModel: Model<IWarranty> =
  mongoose.models.Warranty || mongoose.model<IWarranty>('Warranty', WarrantySchema);
