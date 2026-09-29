import mongoose, { Schema, Document, Model } from 'mongoose';

export type CustomerType = 'INDIVIDUAL' | 'COMMERCIAL';

export interface ICustomer extends Document {
  companyId: string;
  customerId: string;
  customerNumber: string;
  name: string;
  type: CustomerType;
  nationalId?: string;
  taxNumber?: string;
  commercialRegister?: string;
  phone: string;
  secondaryPhone?: string;
  email?: string;
  branchId: string;
  creditLimit: mongoose.Types.Decimal128;
  outstandingBalance: mongoose.Types.Decimal128;
  isActive: boolean;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    companyId: { type: String, required: true, index: true },
    customerId: { type: String, required: true, unique: true },
    customerNumber: { type: String, required: true },
    name: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['INDIVIDUAL', 'COMMERCIAL'],
      default: 'INDIVIDUAL',
    },
    nationalId: { type: String },
    taxNumber: { type: String },
    commercialRegister: { type: String },
    phone: { type: String, required: true },
    secondaryPhone: { type: String },
    email: { type: String },
    branchId: { type: String, required: true, index: true },
    creditLimit: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    outstandingBalance: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    isActive: { type: Boolean, default: true },
    tags: { type: [String], default: [] },
  },
  {
    timestamps: true,
    collection: 'customers',
  }
);

// Multi-tenant unique indexes
CustomerSchema.index({ companyId: 1, customerNumber: 1 }, { unique: true });
CustomerSchema.index({ companyId: 1, phone: 1 }, { unique: true });
CustomerSchema.index({ companyId: 1, name: 1 });

export const CustomerModel: Model<ICustomer> =
  mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);
