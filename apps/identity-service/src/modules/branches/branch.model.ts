import mongoose, { Schema, Document, Model } from 'mongoose';

export interface BranchDocument extends Document {
  companyId: string;
  branchId: string;
  name: string;
  code: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
  };
  isMainBranch: boolean;
  isActive: boolean;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export const BranchSchema = new Schema<BranchDocument>(
  {
    companyId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    phone: { type: String, trim: true },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
    },
    isMainBranch: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    schemaVersion: { type: Number, default: 1, required: true },
  },
  {
    timestamps: true,
    collection: 'branches',
  },
);

// Tenant-aware unique indexes
BranchSchema.index({ companyId: 1, code: 1 }, { unique: true });
BranchSchema.index({ companyId: 1, branchId: 1 }, { unique: true });

export const BranchModel: Model<BranchDocument> =
  mongoose.models.Branch || mongoose.model<BranchDocument>('Branch', BranchSchema);
