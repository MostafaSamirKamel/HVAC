import mongoose, { Schema, Document } from 'mongoose';

export type ClosingStatus = 'BALANCED' | 'DEFICIT' | 'SURPLUS' | 'PENDING_APPROVAL';

export interface IDailyClosing extends Document {
  companyId: string;
  branchId: string;
  closingId: string;
  treasuryId: string;
  closingDate: Date;
  openingBalance: mongoose.Types.Decimal128;
  totalCashIn: mongoose.Types.Decimal128;
  totalCashOut: mongoose.Types.Decimal128;
  systemBalance: mongoose.Types.Decimal128;
  actualBalance: mongoose.Types.Decimal128;
  variance: mongoose.Types.Decimal128;
  status: ClosingStatus;
  closedBy: string;
  approvedBy?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DailyClosingSchema = new Schema<IDailyClosing>(
  {
    companyId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    closingId: { type: String, required: true },
    treasuryId: { type: String, required: true },
    closingDate: { type: Date, required: true },
    openingBalance: { type: Schema.Types.Decimal128, required: true },
    totalCashIn: { type: Schema.Types.Decimal128, required: true },
    totalCashOut: { type: Schema.Types.Decimal128, required: true },
    systemBalance: { type: Schema.Types.Decimal128, required: true },
    actualBalance: { type: Schema.Types.Decimal128, required: true },
    variance: { type: Schema.Types.Decimal128, required: true },
    status: {
      type: String,
      enum: ['BALANCED', 'DEFICIT', 'SURPLUS', 'PENDING_APPROVAL'],
      required: true,
      index: true,
    },
    closedBy: { type: String, required: true },
    approvedBy: { type: String },
    notes: { type: String },
  },
  {
    timestamps: true,
    collection: 'daily_closings',
  }
);

// Multi-tenant unique index for branch closing per day per safe
DailyClosingSchema.index(
  { companyId: 1, branchId: 1, treasuryId: 1, closingDate: 1 },
  { unique: true }
);

export const DailyClosingModel = mongoose.model<IDailyClosing>(
  'DailyClosing',
  DailyClosingSchema
);
