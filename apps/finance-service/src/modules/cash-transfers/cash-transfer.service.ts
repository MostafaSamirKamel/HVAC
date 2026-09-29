import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { NotFoundError, ValidationError, ConflictError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { withTransaction } from '@hvac/database';
import { CashTransferModel, ICashTransfer } from './cash-transfer.model.js';
import { TreasuryService } from '../treasuries/treasury.service.js';
import { TreasuryModel } from '../treasuries/treasury.model.js';
import { JournalEntryService } from '../journal-entries/journal-entry.service.js';
import { AccountService } from '../chart-of-accounts/account.service.js';

export interface InitiateTransferInput {
  companyId: string;
  sourceTreasuryId: string;
  targetTreasuryId: string;
  amount: number | string;
  description?: string;
  initiatedBy: string;
}

export class CashTransferService {
  /**
   * Step 1: Initiates a cash transfer by deducting from source treasury vault
   */
  public static async initiateTransfer(
    input: InitiateTransferInput,
    existingSession?: ClientSession
  ): Promise<ICashTransfer> {
    if (input.sourceTreasuryId === input.targetTreasuryId) {
      throw new ValidationError('Source and target treasuries cannot be identical');
    }

    const runner = async (session: ClientSession) => {
      const source = await TreasuryModel.findOne({
        companyId: input.companyId,
        treasuryId: input.sourceTreasuryId,
      }).session(session);

      const target = await TreasuryModel.findOne({
        companyId: input.companyId,
        treasuryId: input.targetTreasuryId,
      }).session(session);

      if (!source) throw new NotFoundError('Source treasury not found');
      if (!target) throw new NotFoundError('Target treasury not found');

      const transferMoney = Money.from(input.amount, source.currency);
      const transferId = randomUUID();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const transferNumber = `TRF-${new Date().getFullYear()}-${randomSuffix}`;

      // Source OUTFLOW
      const { movement: outflowMovement } = await TreasuryService.recordMovement(
        {
          companyId: input.companyId,
          treasuryId: source.treasuryId,
          movementType: 'OUTFLOW',
          amount: transferMoney.toString(),
          referenceType: 'TRANSFER_OUT',
          referenceId: transferId,
          description: `Transfer Out to ${target.name} (${target.code})`,
          performedBy: input.initiatedBy,
        },
        session
      );

      const [transfer] = await CashTransferModel.create(
        [
          {
            companyId: input.companyId,
            transferId,
            transferNumber,
            sourceTreasuryId: source.treasuryId,
            targetTreasuryId: target.treasuryId,
            sourceBranchId: source.branchId,
            targetBranchId: target.branchId,
            amount: mongoose.Types.Decimal128.fromString(transferMoney.toString()),
            status: 'IN_TRANSIT',
            description: input.description,
            initiatedBy: input.initiatedBy,
            outflowMovementId: outflowMovement.movementId,
            initiatedAt: new Date(),
          },
        ],
        { session }
      );

      return transfer;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  /**
   * Step 2: Confirms receipt of cash at target treasury and balances General Ledger
   */
  public static async completeTransfer(
    companyId: string,
    transferId: string,
    receivedBy: string,
    existingSession?: ClientSession
  ): Promise<ICashTransfer> {
    const runner = async (session: ClientSession) => {
      const transfer = await CashTransferModel.findOne({ companyId, transferId }).session(session);
      if (!transfer) {
        throw new NotFoundError(`Cash transfer ${transferId} not found`);
      }

      if (transfer.status !== 'IN_TRANSIT') {
        throw new ValidationError(`Transfer is in status ${transfer.status}, cannot complete`);
      }

      const target = await TreasuryModel.findOne({
        companyId,
        treasuryId: transfer.targetTreasuryId,
      }).session(session);

      if (!target) throw new NotFoundError('Target treasury not found');

      // Target INFLOW
      const { movement: inflowMovement } = await TreasuryService.recordMovement(
        {
          companyId,
          treasuryId: target.treasuryId,
          movementType: 'INFLOW',
          amount: transfer.amount.toString(),
          referenceType: 'TRANSFER_IN',
          referenceId: transfer.transferId,
          description: `Transfer In from ${transfer.sourceTreasuryId}`,
          performedBy: receivedBy,
        },
        session
      );

      // Post Balanced Journal Entry (Inter-branch Cash Transfer)
      await AccountService.ensureStandardAccounts(companyId, session);
      const cashAccount = await AccountService.getAccountByCode(companyId, '101001', session);

      const journalEntry = await JournalEntryService.createAndPostEntry(
        {
          companyId,
          sourceModule: 'TREASURY',
          sourceReferenceId: transfer.transferId,
          description: `Inter-branch cash transfer ${transfer.transferNumber}`,
          lines: [
            {
              accountId: cashAccount.accountId,
              accountCode: cashAccount.accountCode,
              accountName: cashAccount.accountName,
              debit: transfer.amount.toString(),
              credit: '0.00',
              branchId: transfer.targetBranchId,
              description: `Cash safe receipt at target branch ${transfer.targetBranchId}`,
            },
            {
              accountId: cashAccount.accountId,
              accountCode: cashAccount.accountCode,
              accountName: cashAccount.accountName,
              debit: '0.00',
              credit: transfer.amount.toString(),
              branchId: transfer.sourceBranchId,
              description: `Cash safe disbursement from source branch ${transfer.sourceBranchId}`,
            },
          ],
          postedBy: receivedBy,
        },
        session
      );

      transfer.status = 'COMPLETED';
      transfer.receivedBy = receivedBy;
      transfer.inflowMovementId = inflowMovement.movementId;
      transfer.journalEntryId = journalEntry.journalEntryId;
      transfer.completedAt = new Date();
      await transfer.save({ session });

      return transfer;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }
}
