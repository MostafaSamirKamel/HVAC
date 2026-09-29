import mongoose, { Schema, Document, Model } from 'mongoose';

export interface RoleDocument extends Document {
  companyId: string;
  name: string;
  displayName: string;
  permissions: string[];
  isSystemRole: boolean;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export const RoleSchema = new Schema<RoleDocument>(
  {
    companyId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, uppercase: true },
    displayName: { type: String, required: true, trim: true },
    permissions: [{ type: String, required: true }],
    isSystemRole: { type: Boolean, default: false },
    schemaVersion: { type: Number, default: 1, required: true },
  },
  {
    timestamps: true,
    collection: 'roles',
  },
);

// Tenant-aware unique index
RoleSchema.index({ companyId: 1, name: 1 }, { unique: true });

export const RoleModel: Model<RoleDocument> =
  mongoose.models.Role || mongoose.model<RoleDocument>('Role', RoleSchema);
