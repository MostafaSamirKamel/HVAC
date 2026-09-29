import mongoose, { Schema, Document, Model } from 'mongoose';

export type RescheduleType = 'EARLY_SETTLEMENT' | 'TENOR_EXTENSION';
export type RescheduleStatus = 'PENDING' | 'EXECUTED' | 'REJECTED';

export interface IInstallmentReschedule extends Document {
  companyId: string;
  rescheduleId: string;
  contractId: string;
  type: RescheduleType;
  originalRemainingBalance: mongoose.Types.Decimal128;
  waivedInterest: mongoose.Types.Decimal128;
  finalAmount: mongoose.Types.Decimal128;
  newTenorMonths?: number;
  newMonthlyInstallment?: mongoose.Types.Decimal128;
  reason: string;
  status: RescheduleStatus;
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: Date;
  receiptId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InstallmentRescheduleSchema = new Schema<IInstallmentReschedule>(
  {
    companyId: { type: String, required: true, index: true },
    rescheduleId: { type: String, required: true, unique: true },
    contractId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ['EARLY_SETTLEMENT', 'TENOR_EXTENSION'],
    },
    originalRemainingBalance: { type: Schema.Types.Decimal128, required: true },
    waivedInterest: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    finalAmount: { type: Schema.Types.Decimal128, required: true },
    newTenorMonths: { type: Number },
    newMonthlyInstallment: { type: Schema.Types.Decimal128 },
    reason: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'EXECUTED', 'REJECTED'],
      default: 'EXECUTED',
    },
    requestedBy: { type: String, required: true },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    receiptId: { type: String },
  },
  {
    timestamps: true,
    collection: 'installment_reschedules',
  }
);

InstallmentRescheduleSchema.index({ companyId: 1, contractId: 1 });

export const InstallmentRescheduleModel: Model<IInstallmentReschedule> =
  mongoose.models.InstallmentReschedule ||
  mongoose.model<IInstallmentReschedule>(
    'InstallmentReschedule',
    InstallmentRescheduleSchema
  );
