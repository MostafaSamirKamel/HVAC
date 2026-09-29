import mongoose, { Schema, Document, Model } from 'mongoose';

export type CustomerLedgerEntryType =
  | 'SALE_INVOICE'
  | 'PAYMENT'
  | 'INSTALLMENT'
  | 'RETURN'
  | 'REFUND'
  | 'CREDIT'
  | 'ADJUSTMENT';

export interface ICustomerLedgerEntry extends Document {
  companyId: string;
  customerId: string;
  branchId: string;
  entryId: string;
  entryNumber: string;
  entryDate: Date;
  entryType: CustomerLedgerEntryType;
  debit: mongoose.Types.Decimal128; // Invoiced amounts (receivable increases)
  credit: mongoose.Types.Decimal128; // Collected amounts (receivable decreases)
  runningBalance: mongoose.Types.Decimal128; // Net balance customer owes company
  referenceId: string;
  referenceType: string;
  description: string;
  performedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerLedgerSchema = new Schema<ICustomerLedgerEntry>(
  {
    companyId: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    entryId: { type: String, required: true, unique: true },
    entryNumber: { type: String, required: true },
    entryDate: { type: Date, required: true, default: Date.now },
    entryType: {
      type: String,
      required: true,
      enum: ['SALE_INVOICE', 'PAYMENT', 'INSTALLMENT', 'RETURN', 'REFUND', 'CREDIT', 'ADJUSTMENT'],
    },
    debit: { type: Schema.Types.Decimal128, required: true, default: 0 },
    credit: { type: Schema.Types.Decimal128, required: true, default: 0 },
    runningBalance: { type: Schema.Types.Decimal128, required: true },
    referenceId: { type: String, required: true, index: true },
    referenceType: { type: String, required: true },
    description: { type: String, required: true },
    performedBy: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'customer_ledgers',
  }
);

CustomerLedgerSchema.index({ companyId: 1, customerId: 1, entryDate: -1 });
CustomerLedgerSchema.index({ companyId: 1, entryNumber: 1 }, { unique: true });

export const CustomerLedgerModel: Model<ICustomerLedgerEntry> =
  mongoose.models.CustomerLedger ||
  mongoose.model<ICustomerLedgerEntry>('CustomerLedger', CustomerLedgerSchema);
