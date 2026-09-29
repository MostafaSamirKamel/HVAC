import mongoose, { Schema, Document, Model } from 'mongoose';

export interface RefreshTokenDocument extends Document {
  tokenId: string;
  userId: string;
  companyId: string;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const RefreshTokenSchema = new Schema<RefreshTokenDocument>(
  {
    tokenId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    companyId: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false, index: true },
  },
  {
    timestamps: true,
    collection: 'refresh_tokens',
  },
);

// TTL index to automatically purge expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel: Model<RefreshTokenDocument> =
  mongoose.models.RefreshToken ||
  mongoose.model<RefreshTokenDocument>('RefreshToken', RefreshTokenSchema);
