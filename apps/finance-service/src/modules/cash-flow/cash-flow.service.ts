import { Money } from '@hvac/money';
import { TreasuryLedgerModel } from '../treasury-ledger/treasury-ledger.model.js';

export interface CashFlowReport {
  companyId: string;
  period: { fromDate?: Date; toDate?: Date };
  operatingCashIn: number;
  operatingCashOut: number;
  transfersIn: number;
  transfersOut: number;
  netOperatingCashFlow: number;
  netTotalCashMovement: number;
}

export class CashFlowService {
  public static async generateReport(
    companyId: string,
    filter: { branchId?: string; fromDate?: Date; toDate?: Date } = {}
  ): Promise<CashFlowReport> {
    const query: Record<string, unknown> = { companyId };
    if (filter.branchId) query.branchId = filter.branchId;

    if (filter.fromDate || filter.toDate) {
      const dateQuery: Record<string, unknown> = {};
      if (filter.fromDate) dateQuery.$gte = filter.fromDate;
      if (filter.toDate) dateQuery.$lte = filter.toDate;
      query.timestamp = dateQuery;
    }

    const movements = await TreasuryLedgerModel.find(query);

    let operatingCashInMoney = Money.from(0, 'EGP');
    let operatingCashOutMoney = Money.from(0, 'EGP');
    let transfersInMoney = Money.from(0, 'EGP');
    let transfersOutMoney = Money.from(0, 'EGP');

    for (const mov of movements) {
      const amount = Money.from(mov.amount.toString(), 'EGP');

      if (mov.referenceType === 'TRANSFER_IN') {
        transfersInMoney = transfersInMoney.add(amount);
      } else if (mov.referenceType === 'TRANSFER_OUT') {
        transfersOutMoney = transfersOutMoney.add(amount);
      } else if (mov.movementType === 'INFLOW') {
        operatingCashInMoney = operatingCashInMoney.add(amount);
      } else if (mov.movementType === 'OUTFLOW') {
        operatingCashOutMoney = operatingCashOutMoney.add(amount);
      }
    }

    const netOperating = operatingCashInMoney.subtract(operatingCashOutMoney);
    const netTotal = operatingCashInMoney
      .add(transfersInMoney)
      .subtract(operatingCashOutMoney)
      .subtract(transfersOutMoney);

    return {
      companyId,
      period: { fromDate: filter.fromDate, toDate: filter.toDate },
      operatingCashIn: operatingCashInMoney.toNumber(),
      operatingCashOut: operatingCashOutMoney.toNumber(),
      transfersIn: transfersInMoney.toNumber(),
      transfersOut: transfersOutMoney.toNumber(),
      netOperatingCashFlow: netOperating.toNumber(),
      netTotalCashMovement: netTotal.toNumber(),
    };
  }
}
