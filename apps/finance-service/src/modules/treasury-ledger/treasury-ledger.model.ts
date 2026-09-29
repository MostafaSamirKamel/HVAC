import mongoose, { Schema, Document, Model } from 'mongoose';

export type MovementType = 'INFLOW' | 'OUTFLOW';
export type TreasuryReferenceType =
  | 'CASH_SALE'
  | 'VENDOR_PAYMENT'
  | 'EXPENSE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'CUSTOMER_RECEIPT'
  | 'ADJUSTMENT';

export interface ITreasuryLedger extends Document {
  companyId: string;
  movementId: string;
  treasuryId: string;
  branchId: string;
  movementType: MovementType;
  amount: mongoose.Types.Decimal128;
  balanceAfter: mongoose.Types.Decimal128;
  referenceType: TreasuryReferenceType;
  referenceId: string;
  description: string;
  performedBy: string;
  journalEntryId?: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TreasuryLedgerSchema = new Schema<ITreasuryLedger>(
  {
    companyId: { type: String, required: true, index: true },
    movementId: { type: String, required: true, unique: true },
    treasuryId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    movementType: {
      type: String,
      required: true,
      enum: ['INFLOW', 'OUTFLOW'],
    },
    amount: { type: Schema.Types.Decimal128, required: true },
    balanceAfter: { type: Schema.Types.Decimal128, required: true },
    referenceType: {
      type: String,
      required: true,
      enum: [
        'CASH_SALE',
        'VENDOR_PAYMENT',
        'EXPENSE',
        'TRANSFER_IN',
        'TRANSFER_OUT',
        'CUSTOMER_RECEIPT',
        'ADJUSTMENT',
      ],
    },
    referenceId: { type: String, required: true, index: true },
    description: { type: String, required: true },
    performedBy: { type: String, required: true },
    journalEntryId: { type: String },
    timestamp: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'treasury_ledgers',
  }
);

// Indexes
TreasuryLedgerSchema.index({ companyId: 1, treasuryId: 1, timestamp: -1 });
TreasuryLedgerSchema.index({ companyId: 1, referenceType: 1, referenceId: 1 });

export const TreasuryLedgerModel: Model<ITreasuryLedger> =
  mongoose.models.TreasuryLedger ||
  mongoose.model<ITreasuryLedger>('TreasuryLedger', TreasuryLedgerSchema);
