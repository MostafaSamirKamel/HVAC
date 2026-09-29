import mongoose, { Schema, Document, Model } from 'mongoose';

export type TreasuryType = 'CASH_SAFE' | 'BANK_ACCOUNT' | 'PETTY_CASH';

export interface ITreasury extends Document {
  companyId: string;
  treasuryId: string;
  code: string;
  name: string;
  type: TreasuryType;
  branchId: string;
  custodianUserId?: string;
  accountId?: string; // Associated general ledger account in Chart of Accounts
  currency: string;
  currentBalance: mongoose.Types.Decimal128; // Materialized balance (Rule 10)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TreasurySchema = new Schema<ITreasury>(
  {
    companyId: { type: String, required: true, index: true },
    treasuryId: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['CASH_SAFE', 'BANK_ACCOUNT', 'PETTY_CASH'],
      default: 'CASH_SAFE',
    },
    branchId: { type: String, required: true },
    custodianUserId: { type: String },
    accountId: { type: String },
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
    collection: 'treasuries',
  }
);

// Multi-tenant unique index on code
TreasurySchema.index({ companyId: 1, code: 1 }, { unique: true });
TreasurySchema.index({ companyId: 1, branchId: 1 });

export const TreasuryModel: Model<ITreasury> =
  mongoose.models.Treasury || mongoose.model<ITreasury>('Treasury', TreasurySchema);
