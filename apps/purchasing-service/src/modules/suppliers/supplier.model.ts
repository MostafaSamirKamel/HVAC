import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISupplier extends Document {
  companyId: string;
  supplierId: string;
  code: string;
  name: string;
  taxNumber?: string;
  commercialRegister?: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: string;
  paymentTermsDays: number;
  currency: string;
  creditLimit: mongoose.Types.Decimal128;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
  {
    companyId: { type: String, required: true, index: true },
    supplierId: { type: String, required: true, unique: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    taxNumber: { type: String },
    commercialRegister: { type: String },
    contactPerson: { type: String },
    phone: { type: String, required: true },
    email: { type: String },
    address: { type: String },
    paymentTermsDays: { type: Number, default: 30 },
    currency: { type: String, default: 'EGP' },
    creditLimit: {
      type: Schema.Types.Decimal128,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'suppliers',
  }
);

// Multi-tenant unique index on supplier code
SupplierSchema.index({ companyId: 1, code: 1 }, { unique: true });
SupplierSchema.index({ companyId: 1, name: 1 });

export const SupplierModel: Model<ISupplier> =
  mongoose.models.Supplier || mongoose.model<ISupplier>('Supplier', SupplierSchema);
