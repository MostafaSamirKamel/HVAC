import { Money } from '@hvac/money';
import { TreasuryModel } from '../treasuries/treasury.model.js';
import { BankAccountModel } from '../bank-accounts/bank-account.model.js';
import { ReceivablesService } from '../receivables/receivables.service.js';
import { PayablesService } from '../payables/payables.service.js';
import { ProfitLossService } from '../profit-loss/profit-loss.service.js';
import { CashFlowService } from '../cash-flow/cash-flow.service.js';

export interface FinanceDashboardData {
  companyId: string;
  cashBalance: number;
  bankBalance: number;
  totalReceivables: number;
  totalPayables: number;
  salesRevenue: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  netCashFlow: number;
}

export class FinanceDashboardService {
  public static async getDashboardSummary(
    companyId: string,
    filter: { branchId?: string; fromDate?: Date; toDate?: Date } = {}
  ): Promise<FinanceDashboardData> {
    // 1. Calculate total active cash in safe
    const treasuryQuery: Record<string, unknown> = { companyId, isActive: true, type: 'CASH_SAFE' };
    if (filter.branchId) treasuryQuery.branchId = filter.branchId;
    const treasuries = await TreasuryModel.find(treasuryQuery);

    let cashMoney = Money.from(0, 'EGP');
    for (const t of treasuries) {
      cashMoney = cashMoney.add(Money.from(t.currentBalance.toString(), 'EGP'));
    }

    // 2. Calculate bank balances
    const bankQuery: Record<string, unknown> = { companyId, isActive: true };
    if (filter.branchId) bankQuery.branchId = filter.branchId;
    const bankAccounts = await BankAccountModel.find(bankQuery);

    let bankMoney = Money.from(0, 'EGP');
    for (const b of bankAccounts) {
      bankMoney = bankMoney.add(Money.from(b.currentBalance.toString(), 'EGP'));
    }

    // 3. Receivables & Payables
    const [recSummary, paySummary, pnl, cashflow] = await Promise.all([
      ReceivablesService.getAgingSummary(companyId),
      PayablesService.getAgingSummary(companyId),
      ProfitLossService.generateReport(companyId, filter),
      CashFlowService.generateReport(companyId, filter),
    ]);

    return {
      companyId,
      cashBalance: cashMoney.toNumber(),
      bankBalance: bankMoney.toNumber(),
      totalReceivables: recSummary.totalReceivables,
      totalPayables: paySummary.totalPayables,
      salesRevenue: pnl.revenue,
      grossProfit: pnl.grossProfit,
      totalExpenses: pnl.totalExpenses,
      netProfit: pnl.netProfit,
      netCashFlow: cashflow.netTotalCashMovement,
    };
  }
}
