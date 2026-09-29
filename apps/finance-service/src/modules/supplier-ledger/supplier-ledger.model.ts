import mongoose, { Schema, Document, Model } from 'mongoose';

export type SupplierLedgerEntryType =
  | 'PURCHASE_INVOICE'
  | 'PAYMENT'
  | 'ADVANCE_PAYMENT'
  | 'PURCHASE_RETURN'
  | 'ADJUSTMENT';

export interface ISupplierLedgerEntry extends Document {
  companyId: string;
  supplierId: string;
  branchId: string;
  entryId: string;
  entryNumber: string;
  entryDate: Date;
  entryType: SupplierLedgerEntryType;
  debit: mongoose.Types.Decimal128; // Payments made to supplier (payable decreases)
  credit: mongoose.Types.Decimal128; // Invoiced bills from supplier (payable increases)
  runningBalance: mongoose.Types.Decimal128; // Net balance company owes supplier
  referenceId: string;
  referenceType: string;
  description: string;
  performedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierLedgerSchema = new Schema<ISupplierLedgerEntry>(
  {
    companyId: { type: String, required: true, index: true },
    supplierId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    entryId: { type: String, required: true, unique: true },
    entryNumber: { type: String, required: true },
    entryDate: { type: Date, required: true, default: Date.now },
    entryType: {
      type: String,
      required: true,
      enum: ['PURCHASE_INVOICE', 'PAYMENT', 'ADVANCE_PAYMENT', 'PURCHASE_RETURN', 'ADJUSTMENT'],
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
    collection: 'supplier_ledgers',
  }
);

SupplierLedgerSchema.index({ companyId: 1, supplierId: 1, entryDate: -1 });
SupplierLedgerSchema.index({ companyId: 1, entryNumber: 1 }, { unique: true });

export const SupplierLedgerModel: Model<ISupplierLedgerEntry> =
  mongoose.models.SupplierLedger ||
  mongoose.model<ISupplierLedgerEntry>('SupplierLedger', SupplierLedgerSchema);
