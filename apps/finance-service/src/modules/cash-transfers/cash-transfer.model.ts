import mongoose, { Schema, Document, Model } from 'mongoose';

export type CashTransferStatus = 'INITIATED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';

export interface ICashTransfer extends Document {
  companyId: string;
  transferId: string;
  transferNumber: string;
  sourceTreasuryId: string;
  targetTreasuryId: string;
  sourceBranchId: string;
  targetBranchId: string;
  amount: mongoose.Types.Decimal128;
  status: CashTransferStatus;
  description?: string;
  initiatedBy: string;
  receivedBy?: string;
  outflowMovementId?: string;
  inflowMovementId?: string;
  journalEntryId?: string;
  initiatedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CashTransferSchema = new Schema<ICashTransfer>(
  {
    companyId: { type: String, required: true, index: true },
    transferId: { type: String, required: true, unique: true },
    transferNumber: { type: String, required: true },
    sourceTreasuryId: { type: String, required: true, index: true },
    targetTreasuryId: { type: String, required: true, index: true },
    sourceBranchId: { type: String, required: true },
    targetBranchId: { type: String, required: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    status: {
      type: String,
      required: true,
      enum: ['INITIATED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'],
      default: 'INITIATED',
    },
    description: { type: String },
    initiatedBy: { type: String, required: true },
    receivedBy: { type: String },
    outflowMovementId: { type: String },
    inflowMovementId: { type: String },
    journalEntryId: { type: String },
    initiatedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'cash_transfers',
  }
);

// Multi-tenant unique index on transfer number
CashTransferSchema.index({ companyId: 1, transferNumber: 1 }, { unique: true });

export const CashTransferModel: Model<ICashTransfer> =
  mongoose.models.CashTransfer ||
  mongoose.model<ICashTransfer>('CashTransfer', CashTransferSchema);
