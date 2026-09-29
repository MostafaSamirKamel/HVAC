import mongoose, { Schema, Document, Model } from 'mongoose';

export type ScheduleStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export interface IInstallmentSchedule extends Document {
  companyId: string;
  scheduleId: string;
  contractId: string;
  installmentNumber: number;
  dueDate: Date;
  principalAmount: mongoose.Types.Decimal128;
  interestAmount: mongoose.Types.Decimal128;
  totalAmount: mongoose.Types.Decimal128;
  paidAmount: mongoose.Types.Decimal128;
  remainingAmount: mongoose.Types.Decimal128;
  lateFeeAmount: mongoose.Types.Decimal128;
  status: ScheduleStatus;
  paidAt?: Date;
  receiptId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InstallmentScheduleSchema = new Schema<IInstallmentSchedule>(
  {
    companyId: { type: String, required: true, index: true },
    scheduleId: { type: String, required: true, unique: true },
    contractId: { type: String, required: true, index: true },
    installmentNumber: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    principalAmount: { type: Schema.Types.Decimal128, required: true },
    interestAmount: { type: Schema.Types.Decimal128, required: true },
    totalAmount: { type: Schema.Types.Decimal128, required: true },
    paidAmount: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    remainingAmount: { type: Schema.Types.Decimal128, required: true },
    lateFeeAmount: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'],
      default: 'PENDING',
    },
    paidAt: { type: Date },
    receiptId: { type: String },
  },
  {
    timestamps: true,
    collection: 'installment_schedules',
  }
);

// Multi-tenant unique index on contract + installmentNumber
InstallmentScheduleSchema.index(
  { companyId: 1, contractId: 1, installmentNumber: 1 },
  { unique: true }
);
InstallmentScheduleSchema.index({ companyId: 1, status: 1, dueDate: 1 });

export const InstallmentScheduleModel: Model<IInstallmentSchedule> =
  mongoose.models.InstallmentSchedule ||
  mongoose.model<IInstallmentSchedule>('InstallmentSchedule', InstallmentScheduleSchema);
