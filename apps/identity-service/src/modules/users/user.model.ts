import mongoose, { Schema, Document, Model } from 'mongoose';

export interface UserDocument extends Document {
  companyId: string;
  userId: string;
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string;
  roles: string[];
  userBranchId?: string;
  allowedBranchIds: string[];
  isSuperAdmin: boolean;
  isActive: boolean;
  permissionVersion: number;
  lastLoginAt?: Date;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = new Schema<UserDocument>(
  {
    companyId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true, trim: true, lowercase: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    roles: [{ type: String, required: true }],
    userBranchId: { type: String },
    allowedBranchIds: [{ type: String }],
    isSuperAdmin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    permissionVersion: { type: Number, default: 1 },
    lastLoginAt: { type: Date },
    schemaVersion: { type: Number, default: 1, required: true },
  },
  {
    timestamps: true,
    collection: 'users',
  },
);

// Tenant-aware unique indexes
UserSchema.index({ companyId: 1, email: 1 }, { unique: true });
UserSchema.index({ companyId: 1, username: 1 }, { unique: true });
UserSchema.index({ companyId: 1, userId: 1 }, { unique: true });

export const UserModel: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>('User', UserSchema);
