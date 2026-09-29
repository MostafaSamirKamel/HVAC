import mongoose, { Schema, Document, Model } from 'mongoose';

export type PaymentSourceType = 'TREASURY' | 'BANK';
export type ExpenseApprovalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface IExpense extends Document {
  companyId: string;
  branchId: string;
  expenseId: string;
  expenseNumber: string;
  categoryId: string;
  categoryName: string;
  amount: mongoose.Types.Decimal128;
  expenseDate: Date;
  paymentSourceType: PaymentSourceType;
  treasuryId?: string;
  bankAccountId?: string;
  employeeId?: string;
  description: string;
  approvalStatus: ExpenseApprovalStatus;
  expenseAccountId: string;
  journalEntryId?: string;
  approvedBy?: string;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    companyId: { type: String, required: true, index: true },
    branchId: { type: String, required: true, index: true },
    expenseId: { type: String, required: true, unique: true },
    expenseNumber: { type: String, required: true },
    categoryId: { type: String, required: true, index: true },
    categoryName: { type: String, required: true },
    amount: { type: Schema.Types.Decimal128, required: true },
    expenseDate: { type: Date, required: true, default: Date.now },
    paymentSourceType: {
      type: String,
      required: true,
      enum: ['TREASURY', 'BANK'],
      default: 'TREASURY',
    },
    treasuryId: { type: String },
    bankAccountId: { type: String },
    employeeId: { type: String },
    description: { type: String, required: true },
    approvalStatus: {
      type: String,
      required: true,
      enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
      default: 'APPROVED',
      index: true,
    },
    expenseAccountId: { type: String, required: true },
    journalEntryId: { type: String },
    approvedBy: { type: String },
    approvedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'expenses',
  }
);

ExpenseSchema.index({ companyId: 1, expenseNumber: 1 }, { unique: true });
ExpenseSchema.index({ companyId: 1, branchId: 1, expenseDate: -1 });
ExpenseSchema.index({ companyId: 1, categoryId: 1 });

export const ExpenseModel: Model<IExpense> =
  mongoose.models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema);
