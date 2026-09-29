import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBankAccount extends Document {
  companyId: string;
  bankAccountId: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban?: string;
  branchId?: string;
  currency: string;
  currentBalance: mongoose.Types.Decimal128;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BankAccountSchema = new Schema<IBankAccount>(
  {
    companyId: { type: String, required: true, index: true },
    bankAccountId: { type: String, required: true, unique: true },
    bankName: { type: String, required: true },
    accountName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    iban: { type: String },
    branchId: { type: String, index: true },
    currency: { type: String, required: true, default: 'EGP' },
    currentBalance: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'bank_accounts',
  }
);

BankAccountSchema.index({ companyId: 1, accountNumber: 1 }, { unique: true });

export const BankAccountModel: Model<IBankAccount> =
  mongoose.models.BankAccount || mongoose.model<IBankAccount>('BankAccount', BankAccountSchema);
