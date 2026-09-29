import mongoose, { Schema, Document, Model } from 'mongoose';

export type PayableStatus = 'OUTSTANDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export interface IPayable extends Document {
  companyId: string;
  payableId: string;
  supplierId: string;
  vendorBillId: string;
  billNumber: string;
  originalAmount: mongoose.Types.Decimal128;
  paidAmount: mongoose.Types.Decimal128;
  remainingAmount: mongoose.Types.Decimal128;
  dueDate: Date;
  status: PayableStatus;
  createdAt: Date;
  updatedAt: Date;
}

const PayableSchema = new Schema<IPayable>(
  {
    companyId: { type: String, required: true, index: true },
    payableId: { type: String, required: true, unique: true },
    supplierId: { type: String, required: true, index: true },
    vendorBillId: { type: String, required: true },
    billNumber: { type: String, required: true },
    originalAmount: { type: Schema.Types.Decimal128, required: true },
    paidAmount: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    remainingAmount: { type: Schema.Types.Decimal128, required: true },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      required: true,
      enum: ['OUTSTANDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'],
      default: 'OUTSTANDING',
    },
  },
  {
    timestamps: true,
    collection: 'accounts_payable',
  }
);

// Multi-tenant unique index
PayableSchema.index({ companyId: 1, vendorBillId: 1 }, { unique: true });
PayableSchema.index({ companyId: 1, supplierId: 1, status: 1 });

export const PayableModel: Model<IPayable> =
  mongoose.models.Payable ||
  mongoose.model<IPayable>('Payable', PayableSchema);
