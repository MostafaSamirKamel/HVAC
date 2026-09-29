import mongoose, { Schema, Document, Model } from 'mongoose';

export interface WarehouseDocument extends Document {
  companyId: string;
  warehouseId: string;
  code: string;
  name: string;
  branchId: string;
  address?: string;
  isDefault: boolean;
  isActive: boolean;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export const WarehouseSchema = new Schema<WarehouseDocument>(
  {
    companyId: { type: String, required: true, index: true },
    warehouseId: { type: String, required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    branchId: { type: String, required: true, index: true },
    address: { type: String, trim: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    schemaVersion: { type: Number, default: 1, required: true },
  },
  {
    timestamps: true,
    collection: 'warehouses',
  },
);

// Rule 5: Tenant-aware unique indexes
WarehouseSchema.index({ companyId: 1, code: 1 }, { unique: true });
WarehouseSchema.index({ companyId: 1, warehouseId: 1 }, { unique: true });
WarehouseSchema.index({ companyId: 1, branchId: 1 });

export const WarehouseModel: Model<WarehouseDocument> =
  mongoose.models.Warehouse || mongoose.model<WarehouseDocument>('Warehouse', WarehouseSchema);
