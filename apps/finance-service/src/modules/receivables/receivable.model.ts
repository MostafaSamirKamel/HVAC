import mongoose, { Schema, Document, Model } from 'mongoose';

export type ReceivableStatus = 'OUTSTANDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';

export interface IReceivable extends Document {
  companyId: string;
  receivableId: string;
  customerId: string;
  orderId?: string;
  invoiceId: string;
  invoiceNumber: string;
  originalAmount: mongoose.Types.Decimal128;
  paidAmount: mongoose.Types.Decimal128;
  remainingAmount: mongoose.Types.Decimal128;
  dueDate: Date;
  status: ReceivableStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ReceivableSchema = new Schema<IReceivable>(
  {
    companyId: { type: String, required: true, index: true },
    receivableId: { type: String, required: true, unique: true },
    customerId: { type: String, required: true, index: true },
    orderId: { type: String, index: true },
    invoiceId: { type: String, required: true },
    invoiceNumber: { type: String, required: true },
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
    collection: 'accounts_receivable',
  }
);

// Multi-tenant unique index
ReceivableSchema.index({ companyId: 1, invoiceId: 1 }, { unique: true });
ReceivableSchema.index({ companyId: 1, customerId: 1, status: 1 });

export const ReceivableModel: Model<IReceivable> =
  mongoose.models.Receivable ||
  mongoose.model<IReceivable>('Receivable', ReceivableSchema);
