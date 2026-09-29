import mongoose, { Schema, Document, Model } from 'mongoose';

export type CreditRating = 'A' | 'B' | 'C' | 'D' | 'BLACKLISTED';
export type CreditStatus = 'ACTIVE' | 'ON_HOLD' | 'BLOCKED';

export interface ICustomerCreditProfile extends Document {
  companyId: string;
  customerId: string;
  creditRating: CreditRating;
  creditStatus: CreditStatus;
  approvedCreditLimit: mongoose.Types.Decimal128;
  usedCredit: mongoose.Types.Decimal128;
  paymentTermsDays: number;
  guarantees: {
    bankGuarantee: boolean;
    chequeSecurity: boolean;
    promissoryNote: boolean;
  };
  blockReason?: string;
  blockedAt?: Date;
  blockedBy?: string;
  lastReviewDate?: Date;
  reviewedBy?: string;
  riskNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerCreditProfileSchema = new Schema<ICustomerCreditProfile>(
  {
    companyId: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    creditRating: {
      type: String,
      required: true,
      enum: ['A', 'B', 'C', 'D', 'BLACKLISTED'],
      default: 'B',
      index: true,
    },
    creditStatus: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'ON_HOLD', 'BLOCKED'],
      default: 'ACTIVE',
      index: true,
    },
    approvedCreditLimit: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    usedCredit: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    paymentTermsDays: { type: Number, required: true, default: 30 },
    guarantees: {
      bankGuarantee: { type: Boolean, default: false },
      chequeSecurity: { type: Boolean, default: false },
      promissoryNote: { type: Boolean, default: false },
    },
    blockReason: { type: String },
    blockedAt: { type: Date },
    blockedBy: { type: String },
    lastReviewDate: { type: Date },
    reviewedBy: { type: String },
    riskNotes: { type: String },
  },
  {
    timestamps: true,
    collection: 'customer_credit_profiles',
  }
);

CustomerCreditProfileSchema.index({ companyId: 1, customerId: 1 }, { unique: true });
CustomerCreditProfileSchema.index({ companyId: 1, creditStatus: 1 });
CustomerCreditProfileSchema.index({ companyId: 1, creditRating: 1 });

export const CustomerCreditProfileModel: Model<ICustomerCreditProfile> =
  mongoose.models.CustomerCreditProfile ||
  mongoose.model<ICustomerCreditProfile>(
    'CustomerCreditProfile',
    CustomerCreditProfileSchema
  );
