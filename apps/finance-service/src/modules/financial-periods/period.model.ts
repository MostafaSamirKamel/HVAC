import mongoose, { Schema, Document, Model } from 'mongoose';

export type PeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED';

export interface IFinancialPeriod extends Document {
  companyId: string;
  periodId: string;
  periodName: string; // e.g. "2026-09"
  startDate: Date;
  endDate: Date;
  status: PeriodStatus;
  closedBy?: string;
  closedAt?: Date;
  reopenedBy?: string;
  reopenedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FinancialPeriodSchema = new Schema<IFinancialPeriod>(
  {
    companyId: { type: String, required: true, index: true },
    periodId: { type: String, required: true, unique: true },
    periodName: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ['OPEN', 'CLOSED', 'LOCKED'],
      default: 'OPEN',
      index: true,
    },
    closedBy: { type: String },
    closedAt: { type: Date },
    reopenedBy: { type: String },
    reopenedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'financial_periods',
  }
);

FinancialPeriodSchema.index({ companyId: 1, periodName: 1 }, { unique: true });
FinancialPeriodSchema.index({ companyId: 1, startDate: 1, endDate: 1 });

export const FinancialPeriodModel: Model<IFinancialPeriod> =
  mongoose.models.FinancialPeriod ||
  mongoose.model<IFinancialPeriod>('FinancialPeriod', FinancialPeriodSchema);
