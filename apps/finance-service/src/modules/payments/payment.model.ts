import mongoose, { Schema, Document, Model } from 'mongoose';

export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE';
export type PaymentStatus = 'COLLECTED' | 'REFUNDED' | 'VOIDED';

export interface IPayment extends Document {
  companyId: string;
  paymentId: string;
  paymentNumber: string;
  customerId?: string;
  orderId?: string;
  invoiceId?: string;
  treasuryId: string;
  branchId: string;
  amount: mongoose.Types.Decimal128;
  currency: string;
  paymentMethod: PaymentMethod;
  status: PaymentStatus;
  treasuryMovementId?: string;
  journalEntryId?: string;
  refundMovementId?: string;
  collectedBy: string;
  collectedAt: Date;
  refundedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    companyId: { type: String, required: true, index: true },
    paymentId: { type: String, required: true, unique: true },
    paymentNumber: { type: String, required: true },
    customerId: { type: String, index: true },
    orderId: { type: String, index: true },
    invoiceId: { type: String, index: true },
    treasuryId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, required: true, default: 'EGP' },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['CASH', 'CARD', 'BANK_TRANSFER', 'CHEQUE'],
      default: 'CASH',
    },
    status: {
      type: String,
      required: true,
      enum: ['COLLECTED', 'REFUNDED', 'VOIDED'],
      default: 'COLLECTED',
    },
    treasuryMovementId: { type: String },
    journalEntryId: { type: String },
    refundMovementId: { type: String },
    collectedBy: { type: String, required: true },
    collectedAt: { type: Date, required: true, default: Date.now },
    refundedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'payments',
  }
);

// Multi-tenant unique index on payment number
PaymentSchema.index({ companyId: 1, paymentNumber: 1 }, { unique: true });
PaymentSchema.index({ companyId: 1, invoiceId: 1 });
PaymentSchema.index({ companyId: 1, orderId: 1 });

export const PaymentModel: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);
