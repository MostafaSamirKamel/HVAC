import mongoose, { Schema, Document, Model } from 'mongoose';

export type PurchaseRequestPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type PurchaseRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONVERTED_TO_PO'
  | 'CANCELLED';

export interface IPurchaseRequestItem {
  productId: string;
  productName: string;
  requestedQuantity: number;
  estimatedUnitCost: mongoose.Types.Decimal128;
  estimatedTotalCost: mongoose.Types.Decimal128;
  purpose?: string;
}

export interface IPurchaseRequest extends Document {
  companyId: string;
  branchId: string;
  requestId: string;
  requestNumber: string;
  department: string;
  requestedBy: string;
  priority: PurchaseRequestPriority;
  status: PurchaseRequestStatus;
  requiredDate?: Date;
  items: IPurchaseRequestItem[];
  totalEstimatedAmount: mongoose.Types.Decimal128;
  currency: string;
  notes?: string;
  approvedBy?: string;
  approvedAt?: Date;
  rejectionReason?: string;
  purchaseOrderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseRequestItemSchema = new Schema<IPurchaseRequestItem>(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    requestedQuantity: { type: Number, required: true, min: 1 },
    estimatedUnitCost: { type: Schema.Types.Decimal128, required: true },
    estimatedTotalCost: { type: Schema.Types.Decimal128, required: true },
    purpose: { type: String },
  },
  { _id: false }
);

const PurchaseRequestSchema = new Schema<IPurchaseRequest>(
  {
    companyId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    requestId: { type: String, required: true, unique: true },
    requestNumber: { type: String, required: true },
    department: { type: String, required: true },
    requestedBy: { type: String, required: true, index: true },
    priority: {
      type: String,
      required: true,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED_TO_PO', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    requiredDate: { type: Date },
    items: { type: [PurchaseRequestItemSchema], required: true },
    totalEstimatedAmount: { type: Schema.Types.Decimal128, required: true },
    currency: { type: String, required: true, default: 'EGP' },
    notes: { type: String },
    approvedBy: { type: String },
    approvedAt: { type: Date },
    rejectionReason: { type: String },
    purchaseOrderId: { type: String },
  },
  {
    timestamps: true,
    collection: 'purchase_requests',
  }
);

PurchaseRequestSchema.index({ companyId: 1, requestNumber: 1 }, { unique: true });
PurchaseRequestSchema.index({ companyId: 1, branchId: 1, status: 1 });
PurchaseRequestSchema.index({ companyId: 1, requestedBy: 1 });

export const PurchaseRequestModel: Model<IPurchaseRequest> =
  mongoose.models.PurchaseRequest ||
  mongoose.model<IPurchaseRequest>('PurchaseRequest', PurchaseRequestSchema);
