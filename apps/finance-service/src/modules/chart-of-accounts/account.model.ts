import mongoose, { Schema, Document, Model } from 'mongoose';

export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';

export interface IAccount extends Document {
  companyId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  parentAccountId?: string;
  currency: string;
  isActive: boolean;
  isSystemAccount: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AccountSchema = new Schema<IAccount>(
  {
    companyId: { type: String, required: true, index: true },
    accountId: { type: String, required: true, unique: true },
    accountCode: { type: String, required: true },
    accountName: { type: String, required: true },
    accountType: {
      type: String,
      required: true,
      enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
    },
    normalBalance: {
      type: String,
      required: true,
      enum: ['DEBIT', 'CREDIT'],
    },
    parentAccountId: { type: String },
    currency: { type: String, required: true, default: 'EGP' },
    isActive: { type: Boolean, default: true },
    isSystemAccount: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'chart_of_accounts',
  }
);

// Multi-tenant unique index on code
AccountSchema.index({ companyId: 1, accountCode: 1 }, { unique: true });
AccountSchema.index({ companyId: 1, accountType: 1 });

export const AccountModel: Model<IAccount> =
  mongoose.models.Account || mongoose.model<IAccount>('Account', AccountSchema);
