import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { ValidationError, NotFoundError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { withTransaction } from '@hvac/database';
import { ExpenseModel, IExpense, ExpenseApprovalStatus } from './expense.model.js';
import { TreasuryModel } from '../treasuries/treasury.model.js';
import { TreasuryLedgerModel } from '../treasury-ledger/treasury-ledger.model.js';
import { JournalEntryService } from '../journal-entries/journal-entry.service.js';
import { AccountModel } from '../chart-of-accounts/account.model.js';

export interface RecordExpenseInput {
  companyId: string;
  branchId: string;
  categoryId: string;
  categoryName: string;
  amount: number | string;
  paymentSourceType: 'TREASURY' | 'BANK';
  treasuryId?: string;
  bankAccountId?: string;
  employeeId?: string;
  description: string;
  expenseAccountId: string;
  expenseDate?: Date;
  recordedBy: string;
  approvalThreshold?: number; // e.g. 5000 EGP
}

export class ExpenseService {
  public static async recordExpense(
    input: RecordExpenseInput,
    existingSession?: ClientSession
  ): Promise<IExpense> {
    const expenseMoney = Money.from(input.amount, 'EGP');
    if (!expenseMoney.isPositive()) {
      throw new ValidationError('Expense amount must be strictly greater than zero');
    }

    const runner = async (session: ClientSession) => {
      const expenseId = randomUUID();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const expenseNumber = `EXP-${new Date().getFullYear()}-${randomSuffix}`;

      const threshold = input.approvalThreshold || 5000;
      const requiresApproval = expenseMoney.toNumber() > threshold;
      const approvalStatus: ExpenseApprovalStatus = requiresApproval
        ? 'PENDING_APPROVAL'
        : 'APPROVED';

      let journalEntryId: string | undefined;

      // If immediately approved, execute treasury deduction and journal entry
      if (approvalStatus === 'APPROVED' && input.paymentSourceType === 'TREASURY') {
        if (!input.treasuryId) {
          throw new ValidationError('treasuryId is required for cash treasury payments');
        }

        const treasury = await TreasuryModel.findOne({
          companyId: input.companyId,
          treasuryId: input.treasuryId,
        }).session(session);

        if (!treasury) {
          throw new NotFoundError(`Treasury safe ${input.treasuryId} not found`);
        }

        const currentBalance = Money.from(treasury.currentBalance.toString(), 'EGP');
        if (currentBalance.isLessThan(expenseMoney)) {
          throw new ValidationError(
            `Insufficient funds in safe ${treasury.name}. Available: ${currentBalance.toFixed(2)}, Required: ${expenseMoney.toFixed(2)}`
          );
        }

        const newBalance = currentBalance.subtract(expenseMoney);
        treasury.currentBalance = mongoose.Types.Decimal128.fromString(newBalance.toFixed(2));
        await treasury.save({ session });

        // Record treasury ledger movement
        await TreasuryLedgerModel.create(
          [
            {
              companyId: input.companyId,
              movementId: randomUUID(),
              treasuryId: input.treasuryId,
              branchId: input.branchId,
              movementType: 'OUTFLOW',
              amount: mongoose.Types.Decimal128.fromString(expenseMoney.toFixed(2)),
              balanceAfter: treasury.currentBalance,
              referenceType: 'EXPENSE',
              referenceId: expenseId,
              description: `Expense: ${input.description}`,
              performedBy: input.recordedBy,
              timestamp: input.expenseDate || new Date(),
            },
          ],
          { session }
        );

        // Fetch expense account details
        const expenseAcc = await AccountModel.findOne({
          companyId: input.companyId,
          accountId: input.expenseAccountId,
        }).session(session);

        const expenseAccName = expenseAcc?.accountName || 'Operating Expense';
        const expenseAccCode = expenseAcc?.accountCode || '5100';
        const treasuryAccCode = '1111'; // Cash in hand / safe

        // Post balanced double-entry Journal Entry (Rule 10)
        const journal = await JournalEntryService.createAndPostEntry(
          {
            companyId: input.companyId,
            sourceModule: 'TREASURY',
            sourceReferenceId: expenseId,
            description: `Expense ${expenseNumber}: ${input.description}`,
            entryDate: input.expenseDate || new Date(),
            postedBy: input.recordedBy,
            lines: [
              {
                accountId: input.expenseAccountId,
                accountCode: expenseAccCode,
                accountName: expenseAccName,
                debit: expenseMoney.toNumber(),
                credit: 0,
                description: input.description,
                branchId: input.branchId,
              },
              {
                accountId: treasury.accountId || 'acc_cash_safe',
                accountCode: treasuryAccCode,
                accountName: treasury.name,
                debit: 0,
                credit: expenseMoney.toNumber(),
                description: `Payment for ${expenseNumber}`,
                branchId: input.branchId,
              },
            ],
          },
          session
        );

        journalEntryId = journal.journalEntryId;
      }

      const [expense] = await ExpenseModel.create(
        [
          {
            companyId: input.companyId,
            branchId: input.branchId,
            expenseId,
            expenseNumber,
            categoryId: input.categoryId,
            categoryName: input.categoryName,
            amount: mongoose.Types.Decimal128.fromString(expenseMoney.toFixed(2)),
            expenseDate: input.expenseDate || new Date(),
            paymentSourceType: input.paymentSourceType,
            treasuryId: input.treasuryId,
            bankAccountId: input.bankAccountId,
            employeeId: input.employeeId,
            description: input.description,
            approvalStatus,
            expenseAccountId: input.expenseAccountId,
            journalEntryId,
            approvedBy: approvalStatus === 'APPROVED' ? input.recordedBy : undefined,
            approvedAt: approvalStatus === 'APPROVED' ? new Date() : undefined,
          },
        ],
        { session }
      );

      return expense;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async listExpenses(
    companyId: string,
    filter: {
      branchId?: string;
      categoryId?: string;
      approvalStatus?: ExpenseApprovalStatus;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ): Promise<IExpense[]> {
    const query: Record<string, unknown> = { companyId };
    if (filter.branchId) query.branchId = filter.branchId;
    if (filter.categoryId) query.categoryId = filter.categoryId;
    if (filter.approvalStatus) query.approvalStatus = filter.approvalStatus;

    if (filter.fromDate || filter.toDate) {
      const dateQuery: Record<string, unknown> = {};
      if (filter.fromDate) dateQuery.$gte = filter.fromDate;
      if (filter.toDate) dateQuery.$lte = filter.toDate;
      query.expenseDate = dateQuery;
    }

    return ExpenseModel.find(query).sort({ expenseDate: -1 });
  }
}
