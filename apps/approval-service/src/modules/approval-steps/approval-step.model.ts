import mongoose, { Schema, Document } from 'mongoose';

export type StepStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';

export interface IApprovalStep extends Document {
  companyId: string;
  stepId: string;
  requestId: string;
  stepNumber: number;
  requiredRole: string;
  status: StepStatus;
  approverId?: string;
  actionAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApprovalStepSchema = new Schema<IApprovalStep>(
  {
    companyId: { type: String, required: true, index: true },
    stepId: { type: String, required: true },
    requestId: { type: String, required: true, index: true },
    stepNumber: { type: Number, required: true },
    requiredRole: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'SKIPPED'],
      default: 'PENDING',
      index: true,
    },
    approverId: { type: String },
    actionAt: { type: Date },
    notes: { type: String },
  },
  {
    timestamps: true,
    collection: 'approval_steps',
  }
);

// Compound tenant-aware indexes
ApprovalStepSchema.index({ companyId: 1, stepId: 1 }, { unique: true });
ApprovalStepSchema.index({ companyId: 1, requestId: 1, stepNumber: 1 }, { unique: true });
ApprovalStepSchema.index({ companyId: 1, requestId: 1, status: 1 });

export const ApprovalStepModel = mongoose.model<IApprovalStep>(
  'ApprovalStep',
  ApprovalStepSchema
);
