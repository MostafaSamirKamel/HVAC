import mongoose, { Schema, Document } from 'mongoose';

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type ApprovalRequestType =
  | 'DISCOUNT_OVERRIDE'
  | 'PRICE_OVERRIDE'
  | 'INVOICE_CANCELLATION'
  | 'REFUND'
  | 'CASH_TRANSFER'
  | 'STOCK_TRANSFER'
  | 'STOCK_ADJUSTMENT'
  | 'INSTALLMENT_RESCHEDULE'
  | 'PURCHASE_ORDER'
  | 'CREDIT_LIMIT_EXTENSION'
  | 'EXPENSE';

export interface IApprovalRequest extends Document {
  companyId: string;
  branchId: string;
  requestId: string;
  requestNumber: string;
  requestType: ApprovalRequestType | string;
  referenceType: string;
  referenceId: string;
  requestedBy: string;
  approverId?: string;
  status: ApprovalStatus;
  currentLevel: number;
  totalLevels: number;
  amount?: mongoose.Types.Decimal128;
  metadata?: Record<string, unknown>;
  notes?: string;
  rejectionReason?: string;
  cancellationReason?: string;
  approvedAt?: Date;
  rejectedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApprovalRequestSchema = new Schema<IApprovalRequest>(
  {
    companyId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    requestId: { type: String, required: true },
    requestNumber: { type: String, required: true },
    requestType: { type: String, required: true, index: true },
    referenceType: { type: String, required: true },
    referenceId: { type: String, required: true },
    requestedBy: { type: String, required: true },
    approverId: { type: String },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    currentLevel: { type: Number, default: 1 },
    totalLevels: { type: Number, default: 1 },
    amount: { type: Schema.Types.Decimal128 },
    metadata: { type: Schema.Types.Mixed },
    notes: { type: String },
    rejectionReason: { type: String },
    cancellationReason: { type: String },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    cancelledAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'approval_requests',
  }
);

// Compound tenant-aware indexes
ApprovalRequestSchema.index({ companyId: 1, requestId: 1 }, { unique: true });
ApprovalRequestSchema.index({ companyId: 1, requestNumber: 1 }, { unique: true });
ApprovalRequestSchema.index({ companyId: 1, referenceType: 1, referenceId: 1 });
ApprovalRequestSchema.index({ companyId: 1, status: 1 });
ApprovalRequestSchema.index({ companyId: 1, branchId: 1 });
ApprovalRequestSchema.index({ companyId: 1, requestType: 1 });

export const ApprovalRequestModel = mongoose.model<IApprovalRequest>(
  'ApprovalRequest',
  ApprovalRequestSchema
);
