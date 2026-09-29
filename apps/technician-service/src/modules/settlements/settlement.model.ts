import mongoose, { Schema, Document, Model } from 'mongoose';

export type SettlementStatus = 'SUBMITTED' | 'VERIFIED' | 'REJECTED';

export interface IUsedPart {
  productId: string;
  quantity: number;
}

export interface ITechnicianSettlement extends Document {
  companyId: string;
  settlementId: string;
  settlementNumber: string;
  technicianId: string;
  branchId: string;
  treasuryId?: string;
  cashCollected: mongoose.Types.Decimal128;
  usedSpareParts: IUsedPart[];
  returnedSpareParts: IUsedPart[];
  status: SettlementStatus;
  notes?: string;
  submittedAt: Date;
  verifiedBy?: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UsedPartSchema = new Schema<IUsedPart>(
  {
    productId: { type: String, required: true },
    quantity: { type: Number, required: true },
  },
  { _id: false }
);

const TechnicianSettlementSchema = new Schema<ITechnicianSettlement>(
  {
    companyId: { type: String, required: true, index: true },
    settlementId: { type: String, required: true, unique: true },
    settlementNumber: { type: String, required: true },
    technicianId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    treasuryId: { type: String },
    cashCollected: {
      type: Schema.Types.Decimal128,
      required: true,
      default: () => mongoose.Types.Decimal128.fromString('0.00'),
    },
    usedSpareParts: { type: [UsedPartSchema], default: [] },
    returnedSpareParts: { type: [UsedPartSchema], default: [] },
    status: {
      type: String,
      required: true,
      enum: ['SUBMITTED', 'VERIFIED', 'REJECTED'],
      default: 'SUBMITTED',
    },
    notes: { type: String },
    submittedAt: { type: Date, required: true, default: Date.now },
    verifiedBy: { type: String },
    verifiedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'technician_settlements',
  }
);

// Multi-tenant unique index on settlement number
TechnicianSettlementSchema.index({ companyId: 1, settlementNumber: 1 }, { unique: true });
TechnicianSettlementSchema.index({ companyId: 1, technicianId: 1, submittedAt: -1 });

export const TechnicianSettlementModel: Model<ITechnicianSettlement> =
  mongoose.models.TechnicianSettlement ||
  mongoose.model<ITechnicianSettlement>('TechnicianSettlement', TechnicianSettlementSchema);
