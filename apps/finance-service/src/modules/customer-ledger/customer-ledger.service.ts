import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { Money } from '@hvac/money';
import {
  CustomerLedgerModel,
  ICustomerLedgerEntry,
  CustomerLedgerEntryType,
} from './customer-ledger.model.js';

export interface RecordCustomerLedgerInput {
  companyId: string;
  customerId: string;
  branchId: string;
  entryType: CustomerLedgerEntryType;
  debit: number | string;
  credit: number | string;
  referenceId: string;
  referenceType: string;
  description: string;
  performedBy: string;
  entryDate?: Date;
}

export class CustomerLedgerService {
  public static async recordEntry(
    input: RecordCustomerLedgerInput,
    session?: ClientSession
  ): Promise<ICustomerLedgerEntry> {
    const debitMoney = Money.from(input.debit || 0, 'EGP');
    const creditMoney = Money.from(input.credit || 0, 'EGP');

    // Find the latest ledger entry to get the previous running balance
    const lastEntryQuery = CustomerLedgerModel.findOne({
      companyId: input.companyId,
      customerId: input.customerId,
    }).sort({ entryDate: -1, createdAt: -1 });

    const lastEntry = session ? await lastEntryQuery.session(session) : await lastEntryQuery;

    const previousBalance = lastEntry && lastEntry.runningBalance
      ? Money.from(lastEntry.runningBalance.toString(), 'EGP')
      : Money.from(0, 'EGP');

    // New balance = previous + debit (owed to us) - credit (paid by customer)
    const newRunningBalance = previousBalance.add(debitMoney).subtract(creditMoney);

    const entryId = randomUUID();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const entryNumber = `CL-${new Date().getFullYear()}-${randomSuffix}`;

    const [entry] = await CustomerLedgerModel.create(
      [
        {
          companyId: input.companyId,
          customerId: input.customerId,
          branchId: input.branchId,
          entryId,
          entryNumber,
          entryDate: input.entryDate || new Date(),
          entryType: input.entryType,
          debit: mongoose.Types.Decimal128.fromString(debitMoney.toFixed(2)),
          credit: mongoose.Types.Decimal128.fromString(creditMoney.toFixed(2)),
          runningBalance: mongoose.Types.Decimal128.fromString(newRunningBalance.toFixed(2)),
          referenceId: input.referenceId,
          referenceType: input.referenceType,
          description: input.description,
          performedBy: input.performedBy,
        },
      ],
      { session }
    );

    return entry;
  }

  public static async getCustomerStatement(
    companyId: string,
    customerId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<{
    customerId: string;
    openingBalance: number;
    currentBalance: number;
    entries: ICustomerLedgerEntry[];
  }> {
    const query: Record<string, unknown> = { companyId, customerId };

    if (fromDate || toDate) {
      const dateQuery: Record<string, unknown> = {};
      if (fromDate) dateQuery.$gte = fromDate;
      if (toDate) dateQuery.$lte = toDate;
      query.entryDate = dateQuery;
    }

    const entries = await CustomerLedgerModel.find(query).sort({ entryDate: 1, createdAt: 1 });

    // Calculate opening balance prior to fromDate if fromDate is provided
    let openingBalance = 0;
    if (fromDate) {
      const priorEntry = await CustomerLedgerModel.findOne({
        companyId,
        customerId,
        entryDate: { $lt: fromDate },
      }).sort({ entryDate: -1, createdAt: -1 });

      if (priorEntry) {
        openingBalance = Money.from(priorEntry.runningBalance.toString(), 'EGP').toNumber();
      }
    }

    const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;
    const currentBalance = lastEntry
      ? Money.from(lastEntry.runningBalance.toString(), 'EGP').toNumber()
      : openingBalance;

    return {
      customerId,
      openingBalance,
      currentBalance,
      entries,
    };
  }
}
