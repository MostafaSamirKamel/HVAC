import mongoose, { Schema, Document, Model } from 'mongoose';

export type TechnicianStatus = 'IDLE' | 'ON_DUTY' | 'BUSY' | 'OFF_DUTY';

export interface ITechnician extends Document {
  companyId: string;
  technicianId: string;
  userId?: string;
  code: string;
  name: string;
  phone: string;
  branchId: string;
  skills: string[];
  status: TechnicianStatus;
  vanWarehouseId?: string;
  totalCommissionEarned: mongoose.Types.Decimal128;
  currentCashCustody: mongoose.Types.Decimal128;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TechnicianSchema = new Schema<ITechnician>(
  {
    companyId: { type: String, required: true, index: true },
    technicianId: { type: String, required: true, unique: true },
    userId: { type: String, index: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    branchId: { type: String, required: true, index: true },
    skills: { type: [String], default: [] },
    status: {
      type: String,
      required: true,
      enum: ['IDLE', 'ON_DUTY', 'BUSY', 'OFF_DUTY'],
      default: 'IDLE',
    },
    vanWarehouseId: { type: String },
    totalCommissionEarned: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    currentCashCustody: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'technicians',
  }
);

// Multi-tenant unique index
TechnicianSchema.index({ companyId: 1, code: 1 }, { unique: true });
TechnicianSchema.index({ companyId: 1, branchId: 1, status: 1 });

export const TechnicianModel: Model<ITechnician> =
  mongoose.models.Technician || mongoose.model<ITechnician>('Technician', TechnicianSchema);
