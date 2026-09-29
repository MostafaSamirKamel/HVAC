import mongoose, { Schema, Document, Model } from 'mongoose';

export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED';

export interface IInstallmentContract extends Document {
  companyId: string;
  contractId: string;
  contractNumber: string;
  customerId: string;
  orderId?: string;
  branchId: string;
  totalFinancedAmount: mongoose.Types.Decimal128;
  downPayment: mongoose.Types.Decimal128;
  annualInterestRate: mongoose.Types.Decimal128;
  totalInterest: mongoose.Types.Decimal128;
  totalPayable: mongoose.Types.Decimal128;
  totalPaid: mongoose.Types.Decimal128;
  remainingBalance: mongoose.Types.Decimal128;
  tenorMonths: number;
  monthlyInstallment: mongoose.Types.Decimal128;
  startDate: Date;
  status: ContractStatus;
  currency: string;
  createdBy: string;
  activatedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InstallmentContractSchema = new Schema<IInstallmentContract>(
  {
    companyId: { type: String, required: true, index: true },
    contractId: { type: String, required: true, unique: true },
    contractNumber: { type: String, required: true },
    customerId: { type: String, required: true, index: true },
    orderId: { type: String, index: true },
    branchId: { type: String, required: true, index: true },
    totalFinancedAmount: { type: Schema.Types.Decimal128, required: true },
    downPayment: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    annualInterestRate: { type: Schema.Types.Decimal128, required: true },
    totalInterest: { type: Schema.Types.Decimal128, required: true },
    totalPayable: { type: Schema.Types.Decimal128, required: true },
    totalPaid: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    remainingBalance: { type: Schema.Types.Decimal128, required: true },
    tenorMonths: { type: Number, required: true },
    monthlyInstallment: { type: Schema.Types.Decimal128, required: true },
    startDate: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'ACTIVE', 'COMPLETED', 'DEFAULTED', 'CANCELLED'],
      default: 'DRAFT',
    },
    currency: { type: String, required: true, default: 'EGP' },
    createdBy: { type: String, required: true },
    activatedAt: { type: Date },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'installment_contracts',
  }
);

// Multi-tenant unique index on contract number
InstallmentContractSchema.index({ companyId: 1, contractNumber: 1 }, { unique: true });
InstallmentContractSchema.index({ companyId: 1, customerId: 1, status: 1 });

export const InstallmentContractModel: Model<IInstallmentContract> =
  mongoose.models.InstallmentContract ||
  mongoose.model<IInstallmentContract>('InstallmentContract', InstallmentContractSchema);
