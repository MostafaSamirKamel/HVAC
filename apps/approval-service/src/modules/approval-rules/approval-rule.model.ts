import mongoose, { Schema, Document } from 'mongoose';

export interface IApprovalRule extends Document {
  companyId: string;
  branchId?: string;
  ruleId: string;
  ruleName: string;
  requestType: string;
  minAmount?: mongoose.Types.Decimal128;
  maxAmount?: mongoose.Types.Decimal128;
  minDiscountPercent?: number;
  maxDiscountPercent?: number;
  requiredRole: string;
  approvalLevel: number;
  autoApproveBelowMin: boolean;
  isActive: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ApprovalRuleSchema = new Schema<IApprovalRule>(
  {
    companyId: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    ruleId: { type: String, required: true },
    ruleName: { type: String, required: true },
    requestType: { type: String, required: true, index: true },
    minAmount: { type: Schema.Types.Decimal128 },
    maxAmount: { type: Schema.Types.Decimal128 },
    minDiscountPercent: { type: Number },
    maxDiscountPercent: { type: Number },
    requiredRole: { type: String, required: true },
    approvalLevel: { type: Number, required: true, default: 1 },
    autoApproveBelowMin: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    description: { type: String },
  },
  {
    timestamps: true,
    collection: 'approval_rules',
  }
);

// Tenant-aware compound indexes
ApprovalRuleSchema.index({ companyId: 1, ruleId: 1 }, { unique: true });
ApprovalRuleSchema.index({ companyId: 1, requestType: 1, approvalLevel: 1 });
ApprovalRuleSchema.index({ companyId: 1, isActive: 1 });

export const ApprovalRuleModel = mongoose.model<IApprovalRule>('ApprovalRule', ApprovalRuleSchema);
