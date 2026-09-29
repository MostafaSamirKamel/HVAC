import mongoose, { Schema, Document } from 'mongoose';

export type ApprovalHistoryAction =
  | 'REQUEST_CREATED'
  | 'STEP_APPROVED'
  | 'STEP_REJECTED'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'REQUEST_CANCELLED';

export interface IApprovalHistory extends Document {
  companyId: string;
  historyId: string;
  requestId: string;
  action: ApprovalHistoryAction | string;
  actorId: string;
  actorRole?: string;
  stepNumber?: number;
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const ApprovalHistorySchema = new Schema<IApprovalHistory>(
  {
    companyId: { type: String, required: true, index: true },
    historyId: { type: String, required: true },
    requestId: { type: String, required: true, index: true },
    action: { type: String, required: true },
    actorId: { type: String, required: true },
    actorRole: { type: String },
    stepNumber: { type: Number },
    notes: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    collection: 'approval_history',
  }
);

// Compound tenant-aware indexes
ApprovalHistorySchema.index({ companyId: 1, historyId: 1 }, { unique: true });
ApprovalHistorySchema.index({ companyId: 1, requestId: 1, createdAt: -1 });
ApprovalHistorySchema.index({ companyId: 1, actorId: 1 });

export const ApprovalHistoryModel = mongoose.model<IApprovalHistory>(
  'ApprovalHistory',
  ApprovalHistorySchema
);
