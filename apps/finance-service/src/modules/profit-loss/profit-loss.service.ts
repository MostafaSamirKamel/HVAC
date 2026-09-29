import { Money } from '@hvac/money';
import { JournalEntryModel } from '../journal-entries/journal-entry.model.js';
import { AccountModel } from '../chart-of-accounts/account.model.js';

export interface ProfitAndLossReport {
  companyId: string;
  period: { fromDate?: Date; toDate?: Date };
  revenue: number;
  cogs: number;
  grossProfit: number;
  expensesByCategory: Record<string, number>;
  totalExpenses: number;
  netProfit: number;
}

export class ProfitLossService {
  public static async generateReport(
    companyId: string,
    filter: { branchId?: string; fromDate?: Date; toDate?: Date } = {}
  ): Promise<ProfitAndLossReport> {
    const query: Record<string, unknown> = { companyId, status: 'POSTED' };

    if (filter.fromDate || filter.toDate) {
      const dateQuery: Record<string, unknown> = {};
      if (filter.fromDate) dateQuery.$gte = filter.fromDate;
      if (filter.toDate) dateQuery.$lte = filter.toDate;
      query.entryDate = dateQuery;
    }

    const postedEntries = await JournalEntryModel.find(query);

    // Fetch accounts to categorize by AccountType
    const accounts = await AccountModel.find({ companyId });
    const accountMap = new Map(accounts.map((a) => [a.accountId, a]));

    let revenueMoney = Money.from(0, 'EGP');
    let cogsMoney = Money.from(0, 'EGP');
    let totalExpenseMoney = Money.from(0, 'EGP');
    const expensesByCategory: Record<string, Money> = {};

    for (const entry of postedEntries) {
      for (const line of entry.lines) {
        if (filter.branchId && line.branchId && line.branchId !== filter.branchId) {
          continue;
        }

        const acc = accountMap.get(line.accountId);
        const debit = Money.from(line.debit.toString(), 'EGP');
        const credit = Money.from(line.credit.toString(), 'EGP');

        if (acc?.accountType === 'REVENUE') {
          // Revenue is credited
          revenueMoney = revenueMoney.add(credit).subtract(debit);
        } else if (acc?.accountType === 'EXPENSE') {
          // Check if COGS or Operating Expense
          const isCOGS = acc.accountCode.startsWith('50') || acc.accountName.toLowerCase().includes('cogs');
          if (isCOGS) {
            cogsMoney = cogsMoney.add(debit).subtract(credit);
          } else {
            const category = acc.accountName || 'General Expenses';
            if (!expensesByCategory[category]) {
              expensesByCategory[category] = Money.from(0, 'EGP');
            }
            expensesByCategory[category] = expensesByCategory[category].add(debit).subtract(credit);
            totalExpenseMoney = totalExpenseMoney.add(debit).subtract(credit);
          }
        }
      }
    }

    const grossProfitMoney = revenueMoney.subtract(cogsMoney);
    const netProfitMoney = grossProfitMoney.subtract(totalExpenseMoney);

    const expensesFormatted: Record<string, number> = {};
    for (const [cat, m] of Object.entries(expensesByCategory)) {
      expensesFormatted[cat] = m.toNumber();
    }

    return {
      companyId,
      period: { fromDate: filter.fromDate, toDate: filter.toDate },
      revenue: revenueMoney.toNumber(),
      cogs: cogsMoney.toNumber(),
      grossProfit: grossProfitMoney.toNumber(),
      expensesByCategory: expensesFormatted,
      totalExpenses: totalExpenseMoney.toNumber(),
      netProfit: netProfitMoney.toNumber(),
    };
  }
}
