import { randomUUID } from 'crypto';
import mongoose, { ClientSession } from 'mongoose';
import { Money } from '@hvac/money';
import {
  SupplierLedgerModel,
  ISupplierLedgerEntry,
  SupplierLedgerEntryType,
} from './supplier-ledger.model.js';

export interface RecordSupplierLedgerInput {
  companyId: string;
  supplierId: string;
  branchId: string;
  entryType: SupplierLedgerEntryType;
  debit: number | string;
  credit: number | string;
  referenceId: string;
  referenceType: string;
  description: string;
  performedBy: string;
  entryDate?: Date;
}

export class SupplierLedgerService {
  public static async recordEntry(
    input: RecordSupplierLedgerInput,
    session?: ClientSession
  ): Promise<ISupplierLedgerEntry> {
    const debitMoney = Money.from(input.debit || 0, 'EGP');
    const creditMoney = Money.from(input.credit || 0, 'EGP');

    // Find the latest ledger entry to get the previous running balance
    const lastEntryQuery = SupplierLedgerModel.findOne({
      companyId: input.companyId,
      supplierId: input.supplierId,
    }).sort({ entryDate: -1, createdAt: -1 });

    const lastEntry = session ? await lastEntryQuery.session(session) : await lastEntryQuery;

    const previousBalance = lastEntry && lastEntry.runningBalance
      ? Money.from(lastEntry.runningBalance.toString(), 'EGP')
      : Money.from(0, 'EGP');

    // New balance = previous + credit (bills we owe) - debit (payments made to supplier)
    const newRunningBalance = previousBalance.add(creditMoney).subtract(debitMoney);

    const entryId = randomUUID();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const entryNumber = `SL-${new Date().getFullYear()}-${randomSuffix}`;

    const [entry] = await SupplierLedgerModel.create(
      [
        {
          companyId: input.companyId,
          supplierId: input.supplierId,
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

  public static async getSupplierStatement(
    companyId: string,
    supplierId: string,
    fromDate?: Date,
    toDate?: Date
  ): Promise<{
    supplierId: string;
    openingBalance: number;
    currentBalance: number;
    entries: ISupplierLedgerEntry[];
  }> {
    const query: Record<string, unknown> = { companyId, supplierId };

    if (fromDate || toDate) {
      const dateQuery: Record<string, unknown> = {};
      if (fromDate) dateQuery.$gte = fromDate;
      if (toDate) dateQuery.$lte = toDate;
      query.entryDate = dateQuery;
    }

    const entries = await SupplierLedgerModel.find(query).sort({ entryDate: 1, createdAt: 1 });

    let openingBalance = 0;
    if (fromDate) {
      const priorEntry = await SupplierLedgerModel.findOne({
        companyId,
        supplierId,
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
      supplierId,
      openingBalance,
      currentBalance,
      entries,
    };
  }
}
