import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { ValidationError, NotFoundError } from '@hvac/errors';
import { Money } from '@hvac/money';
import { OutboxRepository, withTransaction } from '@hvac/database';
import { JournalEntryPostedEvent } from '@hvac/event-contracts';
import {
  JournalEntryModel,
  IJournalEntry,
  IJournalLine,
  JournalSourceModule,
} from './journal-entry.model.js';

export interface CreateJournalLineInput {
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number | string;
  credit: number | string;
  description?: string;
  branchId?: string;
  costCenterId?: string;
}

export interface CreateJournalEntryInput {
  companyId: string;
  sourceModule: JournalSourceModule;
  sourceReferenceId?: string;
  description: string;
  entryDate?: Date;
  lines: CreateJournalLineInput[];
  postedBy: string;
  currency?: string;
}

export class JournalEntryService {
  /**
   * Creates and immediately posts a balanced double-entry Journal Entry (Rule 10).
   * Validates sum(debit) === sum(credit) with exact Money arithmetic.
   */
  public static async createAndPostEntry(
    input: CreateJournalEntryInput,
    existingSession?: ClientSession
  ): Promise<IJournalEntry> {
    if (!input.lines || input.lines.length < 2) {
      throw new ValidationError('A journal entry must have at least 2 lines (debit and credit)');
    }

    const currency = input.currency || 'EGP';
    let totalDebitMoney = Money.from(0, currency);
    let totalCreditMoney = Money.from(0, currency);

    const mappedLines: IJournalLine[] = [];

    for (const line of input.lines) {
      const debitMoney = Money.from(line.debit || 0, currency);
      const creditMoney = Money.from(line.credit || 0, currency);

      if (debitMoney.isPositive() && creditMoney.isPositive()) {
        throw new ValidationError('A journal line cannot have both positive debit and credit');
      }
      if (debitMoney.isZero() && creditMoney.isZero()) {
        throw new ValidationError('A journal line must have either debit or credit greater than zero');
      }

      totalDebitMoney = totalDebitMoney.add(debitMoney);
      totalCreditMoney = totalCreditMoney.add(creditMoney);

      mappedLines.push({
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        debit: mongoose.Types.Decimal128.fromString(debitMoney.toString()),
        credit: mongoose.Types.Decimal128.fromString(creditMoney.toString()),
        description: line.description,
        branchId: line.branchId,
        costCenterId: line.costCenterId,
      });
    }

    // Invariant: sum(debit) MUST equal sum(credit)
    if (!totalDebitMoney.equals(totalCreditMoney)) {
      throw new ValidationError(
        `Journal entry is out of balance: Total Debit (${totalDebitMoney.toString()}) != Total Credit (${totalCreditMoney.toString()})`
      );
    }

    const runner = async (session: ClientSession) => {
      const journalEntryId = randomUUID();
      const randomSuffix = Math.floor(10000 + Math.random() * 90000);
      const entryNumber = `JE-${new Date().getFullYear()}-${randomSuffix}`;
      const postedAt = new Date();

      const [entry] = await JournalEntryModel.create(
        [
          {
            companyId: input.companyId,
            journalEntryId,
            entryNumber,
            entryDate: input.entryDate || postedAt,
            status: 'POSTED', // Rule 10: Posted directly
            sourceModule: input.sourceModule,
            sourceReferenceId: input.sourceReferenceId,
            description: input.description,
            lines: mappedLines,
            totalDebit: mongoose.Types.Decimal128.fromString(totalDebitMoney.toString()),
            totalCredit: mongoose.Types.Decimal128.fromString(totalCreditMoney.toString()),
            currency,
            postedBy: input.postedBy,
            postedAt,
          },
        ],
        { session }
      );

      // Publish Outbox Event inside transaction
      const event = new JournalEntryPostedEvent(
        {
          journalEntryId,
          entryNumber,
          sourceModule: input.sourceModule,
          sourceReferenceId: input.sourceReferenceId,
          totalDebit: totalDebitMoney.toNumber(),
          totalCredit: totalCreditMoney.toNumber(),
          currency,
        },
        {
          companyId: input.companyId,
          correlationId: randomUUID(),
          causationId: randomUUID(),
          actor: { userId: input.postedBy },
        }
      );

      await OutboxRepository.recordEvent(event, session);

      return entry;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  /**
   * Reverses a posted journal entry by swapping all debits and credits
   */
  public static async reverseJournalEntry(
    companyId: string,
    originalEntryId: string,
    reason: string,
    reversedBy: string,
    existingSession?: ClientSession
  ): Promise<IJournalEntry> {
    const runner = async (session: ClientSession) => {
      const original = await JournalEntryModel.findOne({
        companyId,
        journalEntryId: originalEntryId,
      }).session(session);

      if (!original) {
        throw new NotFoundError(`Journal entry ${originalEntryId} not found`);
      }

      if (original.status === 'VOIDED') {
        throw new ValidationError('Journal entry is already voided');
      }

      // Invert debits and credits
      const reversingLines: CreateJournalLineInput[] = original.lines.map((line) => ({
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        debit: line.credit.toString(), // Swap
        credit: line.debit.toString(), // Swap
        description: `Reversal of ${original.entryNumber}: ${line.description || ''}`,
        branchId: line.branchId,
        costCenterId: line.costCenterId,
      }));

      const reversalEntry = await JournalEntryService.createAndPostEntry(
        {
          companyId,
          sourceModule: original.sourceModule,
          sourceReferenceId: original.journalEntryId,
          description: `Reversal: ${reason} (ref: ${original.entryNumber})`,
          lines: reversingLines,
          postedBy: reversedBy,
          currency: original.currency,
        },
        session
      );

      original.status = 'VOIDED';
      original.reversedByEntryId = reversalEntry.journalEntryId;
      await original.save({ session });

      return reversalEntry;
    };

    if (existingSession) {
      return runner(existingSession);
    }
    return withTransaction(runner);
  }

  public static async getEntryById(companyId: string, journalEntryId: string): Promise<IJournalEntry> {
    const entry = await JournalEntryModel.findOne({ companyId, journalEntryId });
    if (!entry) {
      throw new NotFoundError(`Journal entry ${journalEntryId} not found`);
    }
    return entry;
  }
}
