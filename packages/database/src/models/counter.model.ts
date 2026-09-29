import mongoose, { Schema, Document, Model } from 'mongoose';

export interface NumberCounterDocument extends Document {
  companyId: string;
  documentType: string;
  year: number;
  branchId?: string;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
}

export const NumberCounterSchema = new Schema<NumberCounterDocument>(
  {
    companyId: { type: String, required: true, index: true },
    documentType: { type: String, required: true },
    year: { type: Number, required: true },
    branchId: { type: String, default: null },
    sequence: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
    collection: 'number_counters',
  },
);

NumberCounterSchema.index(
  { companyId: 1, documentType: 1, year: 1, branchId: 1 },
  { unique: true },
);

export const NumberCounterModel: Model<NumberCounterDocument> =
  mongoose.models.NumberCounter || mongoose.model<NumberCounterDocument>('NumberCounter', NumberCounterSchema);
