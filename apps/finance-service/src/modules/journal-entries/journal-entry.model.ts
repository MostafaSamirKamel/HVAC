import mongoose, { Schema, Document, Model } from 'mongoose';

export type JournalStatus = 'DRAFT' | 'POSTED' | 'VOIDED';
export type JournalSourceModule = 'SALES' | 'PURCHASING' | 'TREASURY' | 'PAYROLL' | 'MANUAL';

export interface IJournalLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: mongoose.Types.Decimal128;
  credit: mongoose.Types.Decimal128;
  description?: string;
  branchId?: string;
  costCenterId?: string;
}

export interface IJournalEntry extends Document {
  companyId: string;
  journalEntryId: string;
  entryNumber: string;
  entryDate: Date;
  status: JournalStatus;
  sourceModule: JournalSourceModule;
  sourceReferenceId?: string;
  description: string;
  lines: IJournalLine[];
  totalDebit: mongoose.Types.Decimal128;
  totalCredit: mongoose.Types.Decimal128;
  currency: string;
  postedBy: string;
  postedAt?: Date;
  reversedByEntryId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JournalLineSchema = new Schema<IJournalLine>(
  {
    accountId: { type: String, required: true },
    accountCode: { type: String, required: true },
    accountName: { type: String, required: true },
    debit: { type: Schema.Types.Decimal128, required: true, default: 0 },
    credit: { type: Schema.Types.Decimal128, required: true, default: 0 },
    description: { type: String },
    branchId: { type: String },
    costCenterId: { type: String },
  },
  { _id: false }
);

const JournalEntrySchema = new Schema<IJournalEntry>(
  {
    companyId: { type: String, required: true, index: true },
    journalEntryId: { type: String, required: true, unique: true },
    entryNumber: { type: String, required: true },
    entryDate: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'POSTED', 'VOIDED'],
      default: 'DRAFT',
    },
    sourceModule: {
      type: String,
      required: true,
      enum: ['SALES', 'PURCHASING', 'TREASURY', 'PAYROLL', 'MANUAL'],
    },
    sourceReferenceId: { type: String, index: true },
    description: { type: String, required: true },
    lines: { type: [JournalLineSchema], required: true },
    totalDebit: { type: Schema.Types.Decimal128, required: true },
    totalCredit: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, required: true, default: 'EGP' },
    postedBy: { type: String, required: true },
    postedAt: { type: Date },
    reversedByEntryId: { type: String },
  },
  {
    timestamps: true,
    collection: 'journal_entries',
  }
);

// Multi-tenant unique index on entry number
JournalEntrySchema.index({ companyId: 1, entryNumber: 1 }, { unique: true });
JournalEntrySchema.index({ companyId: 1, status: 1, entryDate: -1 });
JournalEntrySchema.index({ companyId: 1, sourceReferenceId: 1 });

export const JournalEntryModel: Model<IJournalEntry> =
  mongoose.models.JournalEntry || mongoose.model<IJournalEntry>('JournalEntry', JournalEntrySchema);
