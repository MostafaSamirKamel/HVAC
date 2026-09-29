import mongoose, { Schema, Document, Model } from 'mongoose';

export interface CompanyDocument extends Document {
  companyId: string;
  name: string;
  commercialRegistrationNumber?: string;
  taxNumber?: string;
  currency: string;
  isActive: boolean;
  schemaVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export const CompanySchema = new Schema<CompanyDocument>(
  {
    companyId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    commercialRegistrationNumber: { type: String, trim: true },
    taxNumber: { type: String, trim: true },
    currency: { type: String, required: true, default: 'EGP' },
    isActive: { type: Boolean, default: true, index: true },
    schemaVersion: { type: Number, default: 1, required: true },
  },
  {
    timestamps: true,
    collection: 'companies',
  },
);

export const CompanyModel: Model<CompanyDocument> =
  mongoose.models.Company || mongoose.model<CompanyDocument>('Company', CompanySchema);
