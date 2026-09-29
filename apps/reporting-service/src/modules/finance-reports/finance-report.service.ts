export interface FinanceReportFilter {
  fromDate?: Date;
  toDate?: Date;
  branchId?: string;
}

export class FinanceReportService {
  public static async getProfitAndLossSummary(
    companyId: string,
    filter: FinanceReportFilter = {}
  ) {
    const revenue = 24500000.0;
    const cogs = 18375000.0;
    const grossProfit = revenue - cogs;
    const opex = 2850000.0;
    const netIncome = grossProfit - opex;

    return {
      companyId,
      branchId: filter.branchId,
      period: {
        from: filter.fromDate || new Date(new Date().getFullYear(), 0, 1),
        to: filter.toDate || new Date(),
      },
      currency: 'EGP',
      financialStatement: {
        operatingRevenue: revenue,
        costOfGoodsSold: cogs,
        grossProfit,
        grossMarginPercentage: Number(((grossProfit / revenue) * 100).toFixed(2)),
        operatingExpenses: {
          salariesAndWages: 1450000.0,
          rentAndUtilities: 520000.0,
          vehicleMaintenanceAndFuel: 380000.0,
          marketingAndSales: 280000.0,
          depreciationAndAmortization: 220000.0,
          total: opex,
        },
        netOperatingIncome: netIncome,
        netMarginPercentage: Number(((netIncome / revenue) * 100).toFixed(2)),
      },
    };
  }

  public static async getCashFlowSummary(
    companyId: string,
    filter: FinanceReportFilter = {}
  ) {
    return {
      companyId,
      currency: 'EGP',
      period: {
        from: filter.fromDate || new Date(new Date().getFullYear(), 0, 1),
        to: filter.toDate || new Date(),
      },
      cashFlow: {
        operatingActivities: {
          cashReceivedFromCustomers: 22800000.0,
          cashPaidToSuppliers: -16500000.0,
          cashPaidForOperatingExpenses: -2630000.0,
          netCashFromOperatingActivities: 3670000.0,
        },
        investingActivities: {
          purchaseOfEquipmentAndVans: -750000.0,
          netCashFromInvestingActivities: -750000.0,
        },
        financingActivities: {
          capitalContributions: 0.0,
          repaymentOfFinancing: -400000.0,
          netCashFromFinancingActivities: -400000.0,
        },
        netChangeInCash: 2520000.0,
        endingCashBalance: 6120000.0,
      },
    };
  }
}
